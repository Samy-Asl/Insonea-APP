import {average, duration, number, points, timeAbove} from './script.js';
import {chart, colors} from './chart.js';

export function node(tag, text, className) {
    const el=document.createElement(tag);
    if (text !== undefined) el.textContent=text;
    if (className) el.className=className;
    return el;
}
function card(...children) {
    const el=node('article',undefined,'panel stack');
    el.append(...children);
    return el;
}
function empty(host,title,description) {
    const link=node('a','Ouvrir la mesure','quiet');
    link.href='#mesure';
    const panel=card(node('h2',title),node('p',description,'meta'),link);
    panel.classList.add('empty');
    host.replaceChildren(panel);
}
const date = s => new Date(s.start).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});
const db = n => number(n)+' dB';
const pct = (s,t) => number(100*timeAbove(s,t)/s.seconds)+' %';
function legend(labels) {
    const line=node('div',undefined,'legend');
    for (const [name,color] of labels) {
        const item=node('span',name);
        item.style.setProperty('--key',color);
        line.append(item);
    }
    return line;
}
function metric(label,value) {
    const strong=node('strong',value);
    const el=node('div',undefined,'panel metric');el.append(strong,label);
    return el;
}
export function report(host,s) {
    if (!s) return empty(host,'Votre premier bilan','Terminez une session pour retrouver sa courbe et le temps passé au-dessus du seuil.');
    const above=timeAbove(s,s.threshold);
    const message=above ? duration(above)+' au seuil ou au-dessus sur '+duration(s.seconds)+' mesurées.' : 'Toute la session sous le seuil.';
    const summary=card(node('p',s.place+' · '+date(s),'eyebrow'),node('h2',s.name),
        node('p',message,'headline'),node('p','Seuil de '+db(s.threshold)+' · '+pct(s,s.threshold)+' du temps mesuré','meta'));
    summary.classList.add('summary');
    const distribution=node('div',undefined,'distribution');
    distribution.setAttribute('aria-hidden','true');
    const portion=node('i');
    portion.style.width=(100*above/s.seconds)+'%';
    distribution.append(portion);
    summary.append(distribution,legend([['Sous le seuil',colors.level],['Au seuil ou au-dessus',colors.threshold]]));
    if (s.status!=='terminée') summary.append(node('p','Session interrompue · bilan des données recueillies.','meta'));
    const metrics=node('div',undefined,'metrics');
    metrics.append(metric('Moyenne énergétique',db(average(s))),metric('Pic sur 0,25 s',db(s.peak)),metric('Épisodes au seuil',String(s.episodes)));
    const graph=node('div');
    const curve=card(node('h2','Le bruit pendant la session'),node('p','Niveaux estimés en dB · temps depuis le départ','meta'),graph,
        legend([['Moyenne par 5 s',colors.level],['Pic par 5 s',colors.peak],['Seuil · '+db(s.threshold),colors.threshold]]));
    curve.classList.add('curve');
    const how=node('details');
    how.append(node('summary','Comment lire ces chiffres ?'),node('p','La moyenne tient compte de l’énergie sonore sur toute la durée mesurée. Le pic est le quart de seconde le plus fort. Un épisode commence dès que le niveau atteint le seuil et se termine quand il redescend. Les valeurs dépendent du microphone et de son réglage.'));
    host.replaceChildren(summary,metrics,curve,how);
    chart(graph,[{data:points(s,true),color:colors.peak},{data:points(s),color:colors.level}],s.threshold,s.seconds,'Courbe du niveau moyen et des pics, en décibels estimés.');
}
export function history(host,sessions,onSelect,selection) {
    if (!sessions.length) return empty(host,'Aucune session enregistrée','Les cours mesurés sur cet appareil apparaîtront ici.');
    const list=card(node('h2','Sessions enregistrées'));
    for (const s of sessions) {
        const button=node('button',undefined,'hist-row');
        const label=node('span');
        label.append(node('strong',s.name),node('small',[s.place,date(s),duration(s.seconds)].join(' · ')));
        button.append(label,node('span','Bilan →'));
        button.onclick=()=>onSelect(s.id);
        list.append(button);
    }
    if (sessions.length<2) {
        host.replaceChildren(list,card(node('h2','Comparer deux sessions'),node('p','Enregistrez un deuxième cours pour comparer les lieux.','meta')));
        return;
    }
    const panel=card(node('h2','Comparer deux sessions'),node('p','Utilisez le même téléphone et placez-le de façon similaire dans chaque lieu.','meta'));
    panel.classList.add('compare');
    const pair=node('div',undefined,'pair');
    const selects=['Session A','Session B'].map((name,index)=>{
        const select=node('select');
        for (const s of sessions) select.add(new Option(s.name,s.id));
        select.value=sessions.some(s=>s.id===selection[index]) ? selection[index] : sessions[index].id;
        const label=node('label',name);label.append(select);pair.append(label);
        return select;
    });
    const common=node('input');
    Object.assign(common,{type:'number',min:'1',max:'94',step:'1',value:String(selection[2] ?? sessions[0].threshold)});
    const limit=node('label','Seuil commun (dB)','threshold');
    const field=node('div');field.append(common);limit.append(field);
    const comparison=node('div');
    panel.append(pair,limit,comparison);host.replaceChildren(panel,list);
    function update(changed) {
        if (selects[0].value===selects[1].value) {
            const other=changed===0 ? 1 : 0;
            selects[other].value=sessions.find(s=>s.id!==selects[1-other].value).id;
        }
        const [a,b]=selects.map(select=>sessions.find(s=>s.id===select.value));
        selection[0]=a.id;selection[1]=b.id;
        const t=common.valueAsNumber;
        if (!Number.isInteger(t)||t<1||t>94) {
            comparison.replaceChildren(node('p','Choisissez un seuil entier entre 1 et 94 dB.','meta'));return;
        }
        selection[2]=t;
        const diff=average(a)-average(b);
        const verdict=Math.abs(diff)<0.1 ? 'Les moyennes sont identiques à 0,1 dB près.' :
            'La session '+(diff>0?'A':'B')+' est plus bruyante en moyenne de '+db(Math.abs(diff))+'.';
        const table=node('table');
        const header=table.createTHead().insertRow();
        for (const h of ['Indicateur','Session A','Session B']) header.append(node('th',h));
        const tbody=table.createTBody();
        for (const [label,fn] of [['Durée',s=>duration(s.seconds)],['Moyenne',s=>db(average(s))],['Pic',s=>db(s.peak)],['Temps au seuil ou au-dessus',s=>pct(s,t)]]) {
            const row=tbody.insertRow();row.append(node('th',label),node('td',fn(a)),node('td',fn(b)));
        }
        const graph=node('div');
        comparison.replaceChildren(node('h3',verdict),table,graph,legend([['A · '+a.place,colors.level],['B · '+b.place,colors.peak],['Seuil commun',colors.threshold]]));
        chart(graph,[{data:points(a),color:colors.level},{data:points(b),color:colors.peak}],t,Math.max(a.seconds,b.seconds),'Comparaison des moyennes sur le même axe de temps écoulé.');
    }
    selects.forEach((select,i)=>select.onchange=()=>update(i));
    common.oninput=()=>update();
    update();
}
