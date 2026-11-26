import {duration} from './script.js';
export const colors = {level:'#c2a0ff',peak:'#8ddbc9',threshold:'#ffc390'};

export function chart(host, series, threshold, end, description, start = 0) {
    let canvas = host.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'plot';
        canvas.setAttribute('role','img');
        host.classList.add('chart-wrap');
        host.append(canvas);
    }
    canvas.setAttribute('aria-label',description);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1,2);
    if (canvas.width !== Math.round(w*ratio) || canvas.height !== Math.round(h*ratio)) {
        canvas.width = Math.round(w*ratio);
        canvas.height = Math.round(h*ratio);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,w,h);
    const left=30,right=w-6,top=20,bottom=h-28;
    const x = t => left + (right-left)*(t-start)/(end-start || 1);
    const y = d => bottom - d*(bottom-top)/100;
    ctx.font='11px system-ui';
    ctx.lineWidth=1;
    ctx.textAlign='right';
    for (const db of [0,25,50,75,100]) {
        ctx.fillStyle='#b7aebf';ctx.fillText(String(db),left-6,y(db)+3);
        ctx.strokeStyle='#373140';ctx.beginPath();ctx.moveTo(left,y(db));ctx.lineTo(right,y(db));ctx.stroke();
    }
    ctx.fillStyle='#b7aebf';
    for (let i=0;i<=2;i++) {
        const t = start+(end-start)*i/2;
        ctx.textAlign=['left','center','right'][i];ctx.fillText(duration(t),x(t),h-7);
    }
    ctx.save();
    ctx.beginPath();ctx.rect(left-2,top-2,right-left+4,bottom-top+4);ctx.clip();
    for (const line of series) {
        if (!line.data.length) continue;
        ctx.strokeStyle=line.color;ctx.lineWidth=2;ctx.lineJoin='round';
        ctx.beginPath();
        // A single bucket still spans its entire measured interval.
        ctx.moveTo(x(line.from ?? 0),y(line.data[0][1]));
        for (const [t,d] of line.data) ctx.lineTo(x(t),y(d));
        ctx.stroke();
    }
    ctx.strokeStyle=colors.threshold;ctx.lineWidth=1.4;ctx.setLineDash([5,5]);
    ctx.beginPath();ctx.moveTo(left,y(threshold));ctx.lineTo(right,y(threshold));ctx.stroke();
    ctx.restore();
}