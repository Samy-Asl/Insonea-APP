export function level(power) {
    return Math.min(94, Math.max(0, 94 + 10 * Math.log10(power)));
}
export function newSession(place, name, threshold, start = Date.now()) {
    const date = new Date(start);
    const day = date.toLocaleDateString('fr-FR', {day:'numeric',month:'short'});
    const time = date.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
    return {
        id: crypto.randomUUID(), start, place, name: name || [place, day, time].join(' · '), threshold,
        seconds:0, energy:0, peak:0, episodes:0, wasAbove:false, histogram:Array(95).fill(0),
        buckets:[], blocks:0, status:'interrompue'
    };
}
export function record(session, power, seconds) {
    const db = level(power);
    const above = db >= session.threshold;
    if (above && !session.wasAbove) session.episodes++;
    session.wasAbove = above;
    session.seconds += seconds;
    session.energy += power * seconds;
    session.peak = Math.max(session.peak, db);
    session.histogram[Math.floor(db)] += seconds;
    // Each group holds duration, integrated power, and maximum quarter-second level.
    if (session.blocks++ % 20 === 0) session.buckets.push([0,0,0]);
    const bucket = session.buckets.at(-1);
    bucket[0] += seconds;
    bucket[1] += power * seconds;
    bucket[2] = Math.max(bucket[2], db);
    return db;
}
export const average = session => level(session.energy / session.seconds);
export const timeAbove = (session, threshold) => session.histogram.slice(threshold).reduce((a,b) => a+b,0);
export const number = value => value.toLocaleString('fr-FR',{maximumFractionDigits:1});
export function duration(seconds) {
    if (seconds > 0 && seconds < 1) return '< 1 s';
    const s = Math.floor(seconds);
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min' + (s%60 ? ' ' + s%60 + ' s' : '');
    return Math.floor(m/60) + ' h ' + String(m%60).padStart(2,'0') + ' min';
}
export function points(session, peak = false) {
    let t = 0;
    return session.buckets.map(([seconds,energy,maximum]) => {
        t += seconds;
        return [t,peak ? maximum : level(energy/seconds)];
    });
}