let audioContext;
let audioStream;
let analyser;
let microphone;
let isMonitoring = false;
let dataArray;
let animationFrameId = null;
let lastNotificationTime = -Infinity;
const levelHistory = [];
const MAX_HISTORY = 16;
const LEVEL_REFERENCE = 94;
const bilanBtn = document.getElementById('bilanBtn');

let exceedanceCount = 0;
let exceedanceDuration = 0;
let exceedanceStartTime = null;
let sessionStats;

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
const safeThresholdInput = document.getElementById('safeThreshold');
const warningThresholdInput = document.getElementById('warningThreshold');
const dangerThresholdInput = document.getElementById('dangerThreshold');
let thresholds = {
    safe: safeThresholdInput.valueAsNumber,
    warning: warningThresholdInput.valueAsNumber,
    danger: dangerThresholdInput.valueAsNumber
};


function interpolateColor(color1, color2, factor) {
    const c1 = color1.match(/\w\w/g).map(x => parseInt(x, 16));
    const c2 = color2.match(/\w\w/g).map(x => parseInt(x, 16));

    const result = c1.map((v, i) =>
        Math.round(v + factor * (c2[i] - v))
    );

    return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
}

function getBackgroundColor(db, safe, warn, danger) {
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
    const safe = safeThresholdInput.valueAsNumber;
    const warning = warningThresholdInput.valueAsNumber;
    const danger = dangerThresholdInput.valueAsNumber;
    if (!(0 <= safe && safe < warning && warning < danger && danger <= LEVEL_REFERENCE)) {
        safeThresholdInput.value = thresholds.safe;
        warningThresholdInput.value = thresholds.warning;
        dangerThresholdInput.value = thresholds.danger;
        addLog('Les seuils doivent être croissants et compris entre 0 et 94.', true);
        return;
    }

    thresholds = { safe, warning, danger };
    document.getElementById('thresholdSafe').textContent = safe;
    document.getElementById('thresholdWarning').textContent = warning;
    document.getElementById('thresholdDanger').textContent = danger;
}

warningThresholdInput.addEventListener('change', updateThresholdValues);
dangerThresholdInput.addEventListener('change', updateThresholdValues);
safeThresholdInput.addEventListener('change', updateThresholdValues);

async function startMonitoring() {
    if (audioContext || document.hidden) return;

    let context;
    bilanBtn.disabled = true;
    permissionPrompt.classList.remove('active');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusLabel.textContent = 'Démarrage…';

    try {
        context = new (window.AudioContext || window.webkitAudioContext)();
        audioContext = context;

        if (context.state === 'suspended') await context.resume();
        if (audioContext !== context) return;

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        if (audioContext !== context) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        audioStream = stream;
        microphone = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        microphone.connect(analyser);
        dataArray = new Uint8Array(analyser.fftSize);

        sessionStats = { readings: 0, levelSum: 0, peak: 0 };
        levelHistory.length = 0;
        exceedanceCount = 0;
        exceedanceDuration = 0;
        exceedanceStartTime = null;
        lastNotificationTime = -Infinity;
        document.getElementById('bilanSection').style.display = 'none';

        isMonitoring = true;
        addLog('Mesure démarrée');
        monitor();
    } catch (error) {
        if (context && audioContext !== context) return;
        releaseMicrophone();
        addLog(`Erreur: ${error.message}`, true);
        startBtn.disabled = false;
        stopBtn.disabled = true;
        bilanBtn.disabled = !sessionStats?.readings;
        statusLabel.textContent = 'Micro indisponible';
        if (error.name === 'NotAllowedError') {
            permissionPrompt.classList.add('active');
        }
    }
}

function releaseMicrophone() {
    isMonitoring = false;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    const context = audioContext;
    audioContext = null;
    audioStream?.getTracks().forEach(track => track.stop());
    microphone?.disconnect();
    audioStream = microphone = analyser = dataArray = null;
    if (context && context.state !== 'closed') {
        context.close().catch(error => console.warn('Fermeture du contexte audio', error));
    }
}

function stopMonitoring() {
    if (!audioContext) return;

    releaseMicrophone();
    if (exceedanceStartTime !== null) {
        exceedanceDuration += performance.now() - exceedanceStartTime;
        exceedanceStartTime = null;
    }
    exceedanceDurationEl.textContent = formatDuration(exceedanceDuration);

    bilanBtn.disabled = !sessionStats?.readings;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    document.querySelector('.main-card').style.animation = 'none';
    statusIndicator.className = 'status-indicator safe';
    statusLabel.textContent = 'Arrêté';
    addLog('Mesure arrêtée');
}

function calculateEstimatedLevel() {
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const db = 20 * Math.log10(Math.max(rms, 0.00001)) + LEVEL_REFERENCE;
    return Math.max(0, db);
}

function formatDuration(durationMs) {
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${(durationMs / 1000).toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const prefix = hours ? `${hours} h ` : '';
    return `${prefix}${minutes % 60} min ${seconds % 60} s`;
}

function monitor() {
    if (!isMonitoring) return;

    const currentLevel = calculateEstimatedLevel();
    const now = performance.now();
    levelHistory.push(currentLevel);
    if (levelHistory.length > MAX_HISTORY) levelHistory.shift();

    const { safe, warning, danger } = thresholds;
    const bgColor = getBackgroundColor(currentLevel, safe, warning, danger);
    const mainCard = document.querySelector('.main-card');
    mainCard.style.background = `linear-gradient(160deg, ${bgColor}, rgba(0, 0, 0, 0.25))`;
    mainCard.style.boxShadow = `0 0 25px ${bgColor}55, 0 0 60px ${bgColor}22`;

    const peakLevel = Math.max(...levelHistory);
    const average = levelHistory.reduce((sum, level) => sum + level, 0) / levelHistory.length;
    dbValue.textContent = currentLevel.toFixed(1);
    peakValueEl.textContent = `${peakLevel.toFixed(1)} dB`;
    averageValueEl.textContent = `${average.toFixed(1)} dB`;

    sessionStats.readings++;
    sessionStats.levelSum += currentLevel;
    sessionStats.peak = Math.max(sessionStats.peak, currentLevel);

    const isAboveThreshold = currentLevel >= warning;
    if (isAboveThreshold && exceedanceStartTime === null) {
        exceedanceStartTime = now;
        exceedanceCount++;
    } else if (!isAboveThreshold && exceedanceStartTime !== null) {
        exceedanceDuration += now - exceedanceStartTime;
        exceedanceStartTime = null;
    }
    const currentDuration = exceedanceStartTime === null ? 0 : now - exceedanceStartTime;
    exceedanceCountEl.textContent = exceedanceCount;
    exceedanceDurationEl.textContent = formatDuration(exceedanceDuration + currentDuration);

    let status = 'safe';
    let label = 'Sous le seuil';
    mainCard.style.animation = 'none';
    if (currentLevel >= danger) {
        mainCard.style.animation = 'pulse 1.2s infinite';
        status = 'danger';
        label = 'Seuil haut atteint';
        if ('Notification' in window && Notification.permission === 'granted' && now - lastNotificationTime >= 30000) {
            lastNotificationTime = now;
            try {
                new Notification('Seuil haut atteint', {
                    body: `Niveau sonore estimé : ${Math.round(currentLevel)} dB`,
                    tag: 'insonea-alert'
                });
            } catch (error) {
                console.warn('Notifications indisponibles', error);
            }
        }
    } else if (isAboveThreshold) {
        status = 'warning';
        label = 'Alerte';
    }

    statusIndicator.className = `status-indicator ${status}`;
    statusLabel.textContent = label;

    const bars = visualization.querySelectorAll('.bar');
    bars.forEach((bar, index) => {
        const value = levelHistory[index] || 0;
        const percentage = (value / LEVEL_REFERENCE) * 100;
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
                addLog('INsonea installee');
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
    if (audioContext || !sessionStats?.readings) return;

    const average = sessionStats.levelSum / sessionStats.readings;
    document.getElementById('bilanDuration').textContent = formatDuration(exceedanceDuration);
    document.getElementById('bilanAverage').textContent = `${average.toFixed(1)} dB`;
    document.getElementById('bilanPeak').textContent = `${sessionStats.peak.toFixed(1)} dB`;
    document.getElementById('bilanExceedances').textContent = exceedanceCount;
    document.getElementById('bilanSection').style.display = 'block';
}
