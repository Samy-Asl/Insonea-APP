import {newSession,record,number} from './script.js';
import {chart,colors} from './chart.js';
import {node,report,history} from './results.js';

const $=id=>document.getElementById(id);
const prefix='insonea.session.v2.';
const saved=new Map();
const comparison=[];
let active=null, selected=null, currentView='', live=[], installPrompt;
function notice(message='') {
    $('notice').textContent=message;
    $('notice').hidden=!message;
}
function loadHistory() {
    try {
        for (const key of Object.keys(localStorage).filter(k=>k.startsWith(prefix))) {
            try {
                const session=JSON.parse(localStorage.getItem(key));
                if (session?.seconds>0 && session.histogram?.length===95 && Array.isArray(session.buckets)) saved.set(session.id,session);
            } catch { /* Ignore a single unreadable session. */ }
        }
    } catch { notice('Le stockage local est indisponible. Les bilans seront accessibles dans cet onglet.'); }
}
function persist(s) {
    try {localStorage.setItem(prefix+s.id,JSON.stringify(s));return true;}
    catch {notice('Stockage local indisponible ou plein. Le bilan reste consultable dans cet onglet.');return false;}
}
const sessions=()=>[...saved.values()].sort((a,b)=>b.start-a.start);
function recentPlaces() {
    const places=[...new Set(sessions().map(s=>s.place))].slice(0,3);
    $('places').replaceChildren(...places.map(place=>{
        const btn=node('button',place,'chip');btn.type='button';
        btn.disabled=!!active;btn.onclick=()=>{$('place').value=place;};return btn;
    }));
}
function liveChart() {
    const s=active?.session;
    const end=Math.max(60,s?.seconds || 0);
    const start=end-60;
    chart($('live-chart'),[{data:live,color:colors.level,from:live[0]?.[0] ?? 0}],s?.threshold || Number($('limit').value) || 85,end,'Niveau sonore estimé des soixante dernières secondes.',start);
    let caption=$('live-chart').querySelector('.empty-graph');
    if (!live.length && !caption) $('live-chart').append(node('span','La courbe apparaîtra au démarrage.','empty-graph'));
    if (live.length) caption?.remove();
}
function showView() {
    const route=location.hash.slice(1);
    currentView=['mesure','bilan','historique'].includes(route)?route:'mesure';
    for (const id of ['mesure','bilan','historique']) $(id).hidden=id!==currentView;
    for (const link of document.querySelectorAll('nav a')) {
        if (link.hash==='#'+currentView) link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    }
    document.title='Insonea · '+currentView[0].toUpperCase()+currentView.slice(1);
    if (currentView==='bilan') report($('report'),saved.get(selected) || sessions()[0]);
    if (currentView==='historique') history($('history'),sessions(),id=>{selected=id;location.hash='bilan';},comparison);
    if (currentView==='mesure') liveChart();
}
function controls() {
    const a=active;
    for (const id of ['place','name','limit']) $(id).disabled=!!a;
    $('action').textContent=a ? (a.session?'Terminer et voir le bilan':'Annuler') : 'Démarrer la mesure';
    $('meter').classList.toggle('running',!!a?.session);
    $('state').textContent=a ? (a.session?'En direct':'Ouverture du micro') : 'Micro arrêté';
    if (!a) {
        $('meter').classList.remove('alert');$('level').textContent='—';$('clock').textContent='00:00';
        $('sound-label').textContent='En attente de mesure';$('neo').src='neo-idle.webp';
        $('scale-fill').style.width='0';
    }
    recentPlaces();
}
function finish(reason) {
    const a=active;
    if (!a) return;
    active=null;
    if (a.meter) a.meter.port.onmessage=null;
    a.stream?.getTracks().forEach(t=>t.stop());
    a.source?.disconnect();a.meter?.disconnect();
    if (a.context && a.context.state!=='closed') a.context.close().catch(()=>{});
    a.lock?.release().catch(()=>{});
    const s=a.session;
    live=[];
    controls();
    if (s?.seconds>0) {
        s.status=reason==='stop'?'terminée':'interrompue';
        saved.set(s.id,s);selected=s.id;
        const stored=persist(s);
        if (stored && reason!=='stop') notice('La mesure a été interrompue. Les données recueillies sont sauvegardées.');
        recentPlaces();
        if (location.hash!=='#bilan') location.hash='bilan'; else showView();
    } else {
        if (s && !s.seconds) notice('Aucune mesure complète recueillie. Relancez la session.');
        showView();
    }
}
function update(a,power,seconds) {
    if (active!==a || !a.session) return;
    const s=a.session,db=record(s,power,seconds);
    live.push([s.seconds,db]);while (live.length>241) live.shift();
    if (s.blocks===1 || s.blocks%20===0) persist(s);
    const elapsed=Math.floor(s.seconds);
    $('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');
    $('level').textContent=number(db);$('scale-fill').style.width=(db/94*100)+'%';
    const alert=db>=s.threshold;
    $('meter').classList.toggle('alert',alert);
    $('sound-label').textContent=alert?'Seuil atteint ou dépassé':'Sous le seuil';
    const pose=alert?'neo-alert.webp':'neo-idle.webp';
    if ($('neo').getAttribute('src')!==pose) $('neo').src=pose;
    if (currentView==='mesure') liveChart();
}
async function start() {
    if (document.hidden) return;
    const a={};active=a;live=[];notice();controls();
    try {
        const Audio=window.AudioContext || window.webkitAudioContext;
        if (!Audio || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const ctx=a.context=new Audio();
        if (!ctx.audioWorklet) throw new Error('unsupported');
        await ctx.resume();
        if (active!==a) return;
        const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        if (active!==a) {stream.getTracks().forEach(t=>t.stop());return;}
        a.stream=stream;
        await ctx.audioWorklet.addModule('./meter-processor.js');
        if (active!==a) return;
        a.source=ctx.createMediaStreamSource(stream);
        a.meter=new AudioWorkletNode(ctx,'insonea-meter',{channelCount:1,channelCountMode:'explicit',outputChannelCount:[1]});
        a.session=newSession($('place').value.trim() || 'Session libre',$('name').value.trim(),$('limit').valueAsNumber);
        a.meter.port.onmessage=({data})=>update(a,...data);
        const interrupt=()=>{if (active===a) finish('interruption');};
        a.meter.onprocessorerror=interrupt;
        const track=stream.getAudioTracks()[0];track.onended=interrupt;track.onmute=interrupt;
        ctx.onstatechange=()=>{if(ctx.state==='suspended'||ctx.state==='interrupted') interrupt();};
        a.source.connect(a.meter);a.meter.connect(ctx.destination); // The processor emits silence.
        controls();
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then(lock=>{
            if (active===a) a.lock=lock; else lock.release().catch(()=>{});
        }).catch(()=>{});
    } catch(error) {
        if (active!==a) return;
        finish('error');
        notice(error.name==='NotAllowedError'?'Accès au micro refusé. Autorisez le microphone pour ce site, puis réessayez.':
            error.message==='unsupported'?'Ce navigateur ne permet pas la mesure audio. Ouvrez Insonea en HTTPS dans un navigateur récent.':'Microphone indisponible. Vérifiez son accès, puis réessayez.');
    }
}
$('setup').onsubmit=e=>{e.preventDefault();if(active) finish('stop');else start();};
function thresholdMarker() {$('scale-limit').style.left=(Math.min(94,Math.max(0,Number($('limit').value)))/94*100)+'%';if(currentView==='mesure') liveChart();}
$('limit').oninput=thresholdMarker;
document.addEventListener('visibilitychange',()=>{if(document.hidden) finish('interruption');});
window.addEventListener('pagehide',()=>finish('interruption'));
window.addEventListener('storage',event=>{
    if (!event.key?.startsWith(prefix) || !event.newValue) return;
    try {
        const s=JSON.parse(event.newValue);
        if (s.status==='terminée' && s.seconds>0) {
            saved.set(s.id,s);
            recentPlaces();
            if (currentView==='historique') showView();
        }
    } catch { /* An unreadable entry must not interrupt a measurement. */ }
});
window.addEventListener('hashchange',()=>{showView();window.scrollTo(0,0);});
let width=window.innerWidth;
window.addEventListener('resize',()=>{if(width!==window.innerWidth){width=window.innerWidth;showView();}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});
$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('install').hidden=true;}};
window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
loadHistory();controls();thresholdMarker();showView();
