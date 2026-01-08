let audioContext;
let analyser;
let microphone;
let isMonitoring = false;
let dataArray;
let bufferLength;
let peakLevel = 0;
let levelHistory = [];
const MAX_HISTORY = 16;
const bilanBtn = document.getElementById('bilanBtn');

let exceedanceCount = 0;
let exceedanceDuration = 0;
let exceedanceStartTime = null;
let lastExceedanceThreshold = 0;

let dailyStats = {
    date: new Date().toLocaleDateString('fr-FR'),
    minLevel: 130,
    maxLevel: 0,
    avgLevel: 0,
    totalReadings: 0,
    levelSum: 0,
    exceedanceCount: 0,
    exceedanceDuration: 0,
    peakLevel: 0
};

const dbValue = document.getElementById('dbValue');
const statusIndicator = document.getElementById('statusIndicator');
const statusLabel = document.getElementById('statusLabel');
const visualization = document.getElementById('visualization');
const logSection = document.getElementById('logSection');
const permissionPrompt = document.getElementById('permissionPrompt');
const peakValueEl = document.getElementById('peakValue');
const averageValueEl = document.getElementById('averageValue');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exceedanceCountEl = document.getElementById('exceedanceCount');
const exceedanceDurationEl = document.getElementById('exceedanceDuration');


function interpolateColor(color1, color2, factor) {
    const c1 = color1.match(/\w\w/g).map(x => parseInt(x, 16));
    const c2 = color2.match(/\w\w/g).map(x => parseInt(x, 16));

    const result = c1.map((v, i) =>
        Math.round(v + factor * (c2[i] - v))
    );

    return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
}

function getBackgroundColor(db, safe, warn, danger) {
    if (warn <= safe) warn = safe + 1;
    if (danger <= warn) danger = warn + 1;

    if (db <= safe) {
        return '#7ed6df';
    }

    if (db <= warn) {
        const factor = (db - safe) / (warn - safe);
        return interpolateColor('#7ed6df', '#f9ca24', factor);
    }

    if (db <= danger) {
        const factor = (db - warn) / (danger - warn);
        return interpolateColor('#f9ca24', '#f33734', factor);
    }

    return '#f33734';
}

for (let i = 0; i < MAX_HISTORY; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    visualization.appendChild(bar);
}

function addLog(message, isAlert = false) {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const logItem = document.createElement('div');
    logItem.className = isAlert ? 'log-item alert' : 'log-item';
    logItem.textContent = `[${timestamp}] ${message}`;
    logSection.insertBefore(logItem, logSection.firstChild);
    if (logSection.children.length > 30) {
        logSection.removeChild(logSection.lastChild);
    }
}

function updateThresholdValues() {
    const safeThreshold = parseInt(document.getElementById('safeThreshold').value);
    const warningThreshold = parseInt(document.getElementById('warningThreshold').value);
    const dangerThreshold = parseInt(document.getElementById('dangerThreshold').value);
    document.getElementById('thresholdSafe').textContent = safeThreshold;
    document.getElementById('thresholdWarning').textContent = warningThreshold;
    document.getElementById('thresholdDanger').textContent = dangerThreshold;
}

document.getElementById('warningThreshold').addEventListener('change', updateThresholdValues);
document.getElementById('dangerThreshold').addEventListener('change', updateThresholdValues);
document.getElementById('safeThreshold').addEventListener('change', updateThresholdValues);

async function startMonitoring() {
    bilanBtn.disabled = true;
    try {
        permissionPrompt.classList.remove('active');
        startBtn.disabled = true;
        stopBtn.disabled = false;

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            addLog('🔊 AudioContext repris');
        }

        if (!microphone) {
            const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                }
            });

            microphone = audioContext.createMediaStreamSource(stream);
            
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.3;
            
            microphone.connect(analyser);
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }

        isMonitoring = true;
        addLog('✅ Monitoring démarré');
        monitor();
    } catch (error) {
        addLog(`❌ Erreur: ${error.message}`, true);
        startBtn.disabled = false;
        stopBtn.disabled = true;
        if (error.name === 'NotAllowedError') {
            permissionPrompt.classList.add('active');
        }
    }
}

function stopMonitoring() {
    bilanBtn.disabled = false;
    isMonitoring = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (exceedanceStartTime !== null) {
        exceedanceDuration += Date.now() - exceedanceStartTime;
        exceedanceStartTime = null;
    }
    
    const email = document.getElementById('emailInput').value;
    if (email && dailyStats.totalReadings > 0) {
        sendDailyReport(email);
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusIndicator.className = 'status-indicator safe';
    statusLabel.textContent = 'Arrêté';
    addLog('⏹️ Monitoring arrêté');
}

function calculateDecibels() {
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / bufferLength);
    const db = 20 * Math.log10(Math.max(rms, 0.00001)) + 94;
    return Math.max(0, Math.min(db, 130));
}

async function sendDailyReport(email) {
    if (!email) return;
    const now = new Date();
    const reportContent = `Rapport Journalier Insonea - ${dailyStats.date}\n\n📊 Statistiques:\n• Min: ${dailyStats.minLevel.toFixed(1)} dB\n• Max: ${dailyStats.maxLevel.toFixed(1)} dB\n• Moy: ${dailyStats.avgLevel.toFixed(1)} dB\n• Pic: ${dailyStats.peakLevel.toFixed(1)} dB\n\n🔔 Dépassements: ${dailyStats.exceedanceCount}\n⏱️ Durée: ${Math.floor(dailyStats.exceedanceDuration / 1000)}s`;
    try {
        await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, subject: `📊 Rapport Insonea - ${dailyStats.date}`, message: reportContent, timestamp: new Date().toISOString() })
        });
        addLog(`📧 Rapport envoyé à ${email}`);
    } catch (error) {
        console.error('Erreur rapport:', error);
    }
}

let lastNotificationTime = {};
let animationFrameId = null;
let notificationPending = false;

function monitor() {
    if (!isMonitoring) return;

    const currentLevel = calculateDecibels();
    levelHistory.push(currentLevel);
    if (levelHistory.length > MAX_HISTORY) {
        levelHistory.shift();
    }

    const safeThreshold = parseInt(document.getElementById('safeThreshold').value);
    const warningThreshold = parseInt(document.getElementById('warningThreshold').value);
    const dangerThreshold = parseInt(document.getElementById('dangerThreshold').value);
    
    const bgColor = getBackgroundColor(
        currentLevel,
        safeThreshold,
        warningThreshold,
        dangerThreshold
    );

    
    const mainCard = document.querySelector('.main-card');

    mainCard.style.background = `linear-gradient(
        160deg,
        ${bgColor},
        rgba(0, 0, 0, 0.25)
    )`;

    mainCard.style.boxShadow = `
        0 0 25px ${bgColor}55,
        0 0 60px ${bgColor}22
    `;

    peakLevel = Math.max(...levelHistory);
    const average = levelHistory.reduce((a, b) => a + b) / levelHistory.length;

    dbValue.textContent = currentLevel.toFixed(1);
    peakValueEl.textContent = `${peakLevel.toFixed(1)} dB`;
    averageValueEl.textContent = `${average.toFixed(1)} dB`;
    
    exceedanceCountEl.textContent = exceedanceCount;
    const totalDuration = exceedanceDuration + (exceedanceStartTime !== null ? Date.now() - exceedanceStartTime : 0);
    const totalMs = Math.floor(totalDuration);
    const centiseconds = Math.floor((totalMs % 1000) / 10);
    const seconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        exceedanceDurationEl.textContent = `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        exceedanceDurationEl.textContent = `${minutes}m ${seconds % 60}s`;
    } else if (seconds > 0) {
        exceedanceDurationEl.textContent = `${seconds}.${String(centiseconds).padStart(2, '0')}s`;
    } else {
        exceedanceDurationEl.textContent = `${centiseconds}cs`;
    }
    
    dailyStats.totalReadings++;
    dailyStats.levelSum += currentLevel;
    dailyStats.minLevel = Math.min(dailyStats.minLevel, currentLevel);
    dailyStats.maxLevel = Math.max(dailyStats.maxLevel, currentLevel);
    dailyStats.peakLevel = Math.max(dailyStats.peakLevel, currentLevel);


    let status = 'safe';
    let label = '✅ Sûr';
    
    const isAboveThreshold = currentLevel >= warningThreshold;
    
    if (isAboveThreshold && exceedanceStartTime === null) {
        exceedanceStartTime = Date.now();
        if (currentLevel >= dangerThreshold) {
            exceedanceCount++;
            dailyStats.exceedanceCount = exceedanceCount;
            lastExceedanceThreshold = dangerThreshold;
        } else if (lastExceedanceThreshold !== dangerThreshold) {
            exceedanceCount++;
            dailyStats.exceedanceCount = exceedanceCount;
            lastExceedanceThreshold = warningThreshold;
        }
    } else if (!isAboveThreshold && exceedanceStartTime !== null) {
        exceedanceDuration += Date.now() - exceedanceStartTime;
        exceedanceStartTime = null;
    }
    if (currentLevel >= dangerThreshold) {
        mainCard.style.animation = 'pulse 1.2s infinite';
    } else {
        mainCard.style.animation = 'none';
    }
    if (currentLevel >= dangerThreshold) {
        status = 'danger';
        label = '🔴 DANGER';
        const now = Date.now();
        if (!lastNotificationTime['danger'] || now - lastNotificationTime['danger'] > 30000) {
            if (!notificationPending) {
                notificationPending = true;
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🔴 DANGER', { body: `${Math.round(currentLevel)} dB`, tag: 'insonea-alert' });
                }
                lastNotificationTime['danger'] = now;
                setTimeout(() => { notificationPending = false; }, 100);
            }
        }
    } else if (currentLevel >= warningThreshold) {
        status = 'warning';
        label = '🟠 ALERTE';
    }

    statusIndicator.className = `status-indicator ${status}`;
    statusLabel.textContent = label;

    const bars = visualization.querySelectorAll('.bar');
    bars.forEach((bar, index) => {
        const value = levelHistory[index] || 0;
        const percentage = (value / 130) * 100;
        bar.style.height = `${Math.max(5, percentage)}%`;
    });

    animationFrameId = requestAnimationFrame(monitor);
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

let deferredPrompt;
const installPrompt = document.getElementById('installPrompt');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installPrompt.classList.add('active');
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                addLog('✅ Insonea installée');
                installPrompt.classList.remove('active');
            }
            deferredPrompt = null;
        });
    }
}

function dismissInstall() {
    installPrompt.classList.remove('active');
    deferredPrompt = null;
}

function toggleSettings() {
    const settingsSection = document.getElementById('settingsSection');
    settingsSection.classList.toggle('open');
}

updateThresholdValues();
function generateBilan() {
    const durationMs = exceedanceDuration;
    const durationSec = Math.floor(durationMs / 1000);

    const avg = dailyStats.levelSum / Math.max(1, dailyStats.totalReadings);

    document.getElementById('bilanDuration').textContent = `${durationSec}s`;
    document.getElementById('bilanAverage').textContent = `${avg.toFixed(1)} dB`;
    document.getElementById('bilanPeak').textContent = `${dailyStats.peakLevel.toFixed(1)} dB`;
    document.getElementById('bilanExceedances').textContent = dailyStats.exceedanceCount;

    let verdict = '🟢 Exposition maîtrisée';
    if (dailyStats.exceedanceCount > 5) verdict = '🟠 Attention à l’exposition';
    if (dailyStats.exceedanceCount > 15) verdict = '🔴 Risque auditif élevé';

    document.getElementById('bilanVerdict').textContent = verdict;

    document.getElementById('bilanSection').style.display = 'block';
}
