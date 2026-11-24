/* Plug-in solar planner (nur englische Seite /en/plug-in-solar-planner/).
   Prüft eine geplante Anlage gegen die Regeln in England ab 27.08.2026 (SI 2026/848, SI 2026/896, Interim Product Specification)
   und zeichnet eine Seitenansicht. Texte bewusst nur Englisch, die deutsche Seite lädt dieses Skript nicht. */
(function(){
  const root=document.getElementById('solar-planner'); if(!root) return;
  const DEG=Math.PI/180, f2=n=>n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
  const s={country:'england',property:'house',place:'garden',n:2,L:1.72,W:1.13,orient:'portrait',tilt:30,clear:.3,watts:900,va:800,
    within5:false,forward:false,protectedArea:false,listed:false,road:false,timber:false,party:false};

  const sel=(id,label,opts)=>`<div class="field wide"><label for="sp-${id}">${label}</label><div class="inputbox"><select id="sp-${id}" data-k="${id}">${opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div></div>`;
  const num=(id,label,unit,min,max,step,wide)=>`<div class="field${wide?' wide':''}" data-f="${id}"><label for="sp-${id}">${label}</label><div class="inputbox"><input id="sp-${id}" data-k="${id}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${s[id]}"><span class="unit">${unit}</span></div></div>`;
  const chk=(id,label)=>`<label class="check" data-f="${id}"><input type="checkbox" id="sp-${id}" data-k="${id}"> ${label}</label>`;

  root.innerHTML=`<div class="tool">
  <section aria-label="Inputs">
    <h2>Your planned set-up</h2>
    <div class="fields">
      ${sel('country','Where do you live?',[['england','England'],['wales','Wales'],['scotland','Scotland'],['ni','Northern Ireland']])}
      ${sel('property','Property',[['house','House'],['flat','Flat or maisonette']])}
      ${sel('place','Where will the panels go?',[['garden','Stand in the garden'],['wall','On a wall or balcony'],['roof','On a flat roof']])}
      ${num('n','Number of panels','pcs',1,6,1)}
      ${num('watts','Total panel power','W',100,3000,10)}
      ${num('L','Panel length','m',.5,2.5,.01)}
      ${num('W','Panel width','m',.3,1.5,.01)}
      ${sel('orient','Panel orientation',[['portrait','Portrait (long side up the slope)'],['landscape','Landscape (short side up the slope)']])}
      ${num('tilt','Tilt from horizontal','°',0,90,1)}
      ${num('clear','Height of lower edge','m',0,2,.05)}
      ${num('va','Inverter output','VA',100,2000,10,true)}
      ${chk('within5','Within 5 m of the property boundary')}
      ${chk('forward','In front of the house (between the house and the road)')}
      ${chk('road','The wall or balcony faces a road')}
      ${chk('protectedArea','Conservation area, National Park, National Landscape, the Broads or World Heritage Site')}
      ${chk('listed','Listed building')}
      ${chk('timber','Any part fixed to a wooden fence, gate, wall, balcony or timber cladding')}
      ${chk('party','Fixed to a wall shared with a neighbouring home')}
    </div>
    <div class="plan"><h2 class="side-title first">Side view</h2><div class="sp-svg"></div></div>
  </section>
  <section aria-label="Result" aria-live="polite">
    <h2>Check</h2>
    <div class="total sp-verdict"></div><p class="sub sp-sub"></p>
    <dl class="stats sp-stats"></dl>
    <h3 class="sp-h">Planning (where the panels go)</h3><ul class="sp-list sp-plan"></ul>
    <h3 class="sp-h">Kit and electrics</h3><ul class="sp-list sp-elec"></ul>
    <h3 class="sp-h">Before you plug in</h3><ul class="sp-list sp-todo"></ul>
    <div class="actions"><button class="btn ghost print" type="button">Print or save as PDF</button></div>
  </section></div>`;

  const q=x=>root.querySelector(x), qa=x=>root.querySelectorAll(x);
  qa('[data-k]').forEach(el=>{
    if(el.type==='checkbox'){ el.checked=s[el.dataset.k]; el.addEventListener('change',()=>{s[el.dataset.k]=el.checked;update();}); }
    else if(el.tagName==='SELECT'){ el.value=s[el.dataset.k]; el.addEventListener('change',()=>{s[el.dataset.k]=el.value;update();}); }
    else{ const go=()=>{const x=parseFloat(el.value); if(!isNaN(x)){s[el.dataset.k]=Math.min(+el.max,Math.max(+el.min,x));update();}};
      el.addEventListener('input',go); el.addEventListener('change',()=>{go(); el.value=s[el.dataset.k];}); }
  });
  q('.print').addEventListener('click',()=>window.print());

  const item=(st,t)=>`<li class="sp-${st}"><span class="sp-ico" aria-hidden="true">${st==='ok'?'✓':st==='warn'?'!':'✕'}</span><span><span class="sp-sr">${st==='ok'?'OK: ':st==='warn'?'Check: ':'Problem: '}</span>${t}</span></li>`;

  function update(){
    const along=s.orient==='portrait'?s.L:s.W, area=s.n*s.L*s.W, a=s.tilt*DEG;
    const rise=along*Math.sin(a), proj=along*Math.cos(a), gap=.05;
    const garden=s.place==='garden', wall=s.place==='wall', roof=s.place==='roof', house=s.property==='house';
    /* Felder ein-/ausblenden, die für den Ort keine Rolle spielen */
    const show={clear:!wall, within5:garden, forward:garden, road:wall, party:wall};
    Object.entries(show).forEach(([k,v])=>{const el=q(`[data-f="${k}"]`); if(el) el.hidden=!v;});

    const plan=[], elec=[], stats=[];
    let bad=0, warn=0; const P=(st,t)=>{plan.push(item(st,t)); if(st==='bad')bad++; if(st==='warn')warn++;};
    const E=(st,t)=>{elec.push(item(st,t)); if(st==='bad')bad++; if(st==='warn')warn++;};

    /* ---------- Planung ---------- */
    if(s.country==='ni') P('bad','Plug-in solar is not yet permitted in Northern Ireland.');
    else if(s.country!=='england') P('warn',`The permitted development rules checked here are for England. ${s.country==='wales'?'Wales':'Scotland'} has its own planning rules, so check with your council.`);
    if(s.country==='england'||s.country==='wales'||s.country==='scotland'){
      if(s.timber) P('bad','Under the 2026 rules in England, plug-in solar fixed to a wooden fence, gate, wall, balcony or timber-clad wall is not permitted development. The product rules also exclude timber cladding and timber balconies.');
      if(s.listed) P('bad','On or in the grounds of a listed building, solar panels are no longer permitted development. You need consent.');
      if(garden){
        stats.push([`${f2(area)} m²`,'Panel area'],[`${f2(s.clear+rise)} m`,'Height at the top']);
        P(area<=9?'ok':'bad',`Panel area ${f2(area)} m². Garden installations may have no more than 9 m² of panels in total.`);
        if(house){
          const lim=s.within5?(s.forward?1:2):(s.protectedArea&&s.forward?2:4);
          const why=s.within5?(s.forward?'within 5 m of the boundary and in front of the house':'within 5 m of the boundary'):(s.protectedArea&&s.forward?'in a protected area and closer to the road than the house':'elsewhere in the garden');
          const top=s.clear+rise;
          P(top<=lim+1e-9?'ok':'bad',`Highest point ${f2(top)} m. Limit ${why}: ${lim} m.`);
          if(top>lim){ const tmax=Math.asin(Math.max(-1,Math.min(1,(lim-s.clear)/along)))/DEG;
            if(lim-s.clear>0&&isFinite(tmax)) P('warn',`To stay under ${lim} m with this lower edge height, tilt the panels to ${Math.floor(tmax)}° or less, lower the stand, or turn the panels to landscape.`); }
          if(s.protectedArea&&s.within5) P('warn','In protected areas, panels within 5 m of the boundary need prior approval from the council before you install them.');
        } else {
          P(s.within5?'bad':'ok', s.within5?'For flats, stand-alone panels must be at least 5 m from the boundary.':'At least 5 m from the boundary, as required for flats.');
          P(s.clear+rise<=4?'ok':'bad',`Highest point ${f2(s.clear+rise)} m (limit 4 m).`);
          P('warn','You need permission from the freeholder or managing agent to use shared gardens.');
        }
      }
      if(wall){
        const out=proj+gap, lim=s.road?.2:.4;
        stats.push([`${f2(out)} m`,'Sticks out from the wall'],[`${s.tilt}°`,'Tilt']);
        if(s.party) P('bad','The product rules do not allow fixing panels to a wall that forms the boundary between two homes.');
        if(house){
          P(out<=lim+1e-9?'ok':'bad',`The panels stick out about ${f2(out)} m from the wall (incl. about 5 cm for the bracket). Limit ${s.road?'on a wall facing a road':'on other walls and balconies'}: ${f2(lim)} m.`);
          if(out>lim){ const tmin=Math.ceil(Math.acos(Math.min(1,(lim-gap)/along))/DEG);
            P('warn',`With a ${f2(along)} m panel you need a tilt of at least ${tmin}° (close to vertical) to stay within ${f2(lim)} m. Turning the panel to landscape shortens the slope and helps.`); }
        } else {
          if(s.road&&s.protectedArea) P('bad','For flats in a conservation area or World Heritage Site, panels on a wall facing the road are not permitted development.');
          P('warn',`The panels stick out about ${f2(out)} m. The flats rule has no projection limit like the one for houses, so check with the council and the freeholder.`);
        }
        if(s.tilt>=80) P('ok','Near-vertical panels produce noticeably less than panels tilted at about 30 to 35°, but they are often the only option on a wall.');
      }
      if(roof){
        const h=s.clear+rise; stats.push([`${f2(h)} m`,'Height above the roof'],[`${f2(area)} m²`,'Panel area']);
        P(h<=.6+1e-9?'ok':'bad',`The panels reach ${f2(h)} m above the roof. On a flat roof they may stand no more than 0.6 m above the highest part of the roof (chimneys excluded).`);
        P('warn','Ballast or fixings on a flat roof must not damage the roof covering. Check the load the roof can take.');
      }
    }

    /* ---------- Kit und Elektrik ---------- */
    E(s.va<=800?'ok':'bad',`Inverter output ${s.va} VA. Plug-in kits may feed in no more than 800 VA.`);
    E(s.watts<=2000&&s.n<=4?'ok':'bad',`${s.n} panel${s.n>1?'s':''} with ${s.watts} W in total. Kits may have up to 2,000 W across up to four panels, with no more than two in series.`);
    if(s.watts>960&&s.watts<=2000) E('warn','Above 960 W of panel power, Which? advises getting professional input.');
    if(s.watts>s.va*1.6) E('warn',`Your panels can produce well over ${s.va} VA at midday, but the inverter cuts the extra off. More panels mainly help in the morning, evening and in poor light.`);

    const todo=[
      'Buy a complete kit that is listed as compliant on the ENA type test register (G98). Kits not on the list are not legal to install.',
      'Plug it straight into a fixed wall socket. Never use an extension lead or a multi-socket adaptor.',
      'Use a weatherproof outdoor socket if the plug is outside.',
      'Only one plug-in kit per home. Do not connect kits together.',
      'Have older wiring checked first (an EICR). Look for an RCD or RCBO protecting the circuit.',
      'Register the kit within 28 days at myplugin.solar.',
      'Renting or leasehold: get written permission from the landlord or freeholder before fixing anything outside.',
      'Tell your home insurer.',
      'Ask your council whether permitted development rights have been removed for your home (Article 4 direction or a condition on an earlier planning permission).',
      'Plug-in batteries are not allowed under the current rules.'
    ].map(t=>item('warn',t).replace('sp-warn','sp-todo'));

    q('.sp-plan').innerHTML=plan.join('');
    q('.sp-elec').innerHTML=elec.join('');
    q('.sp-todo').innerHTML=todo.join('');
    q('.sp-stats').hidden=!stats.length;
    q('.sp-stats').innerHTML=stats.map(([v,l])=>`<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');
    const v=q('.sp-verdict');
    v.textContent=bad?'Not within the rules':warn?'Within the rules, with checks':'Within the rules';
    v.className='total sp-verdict '+(bad?'sp-v-bad':warn?'sp-v-warn':'sp-v-ok');
    q('.sp-sub').textContent=bad?`${bad} point${bad>1?'s':''} would need changing or a planning application.`:'Based on what you entered. This is a guide, not legal advice. If in doubt, ask your council for a certificate of lawfulness.';
    q('.sp-svg').innerHTML=svg(along,s.tilt,garden?s.clear:roof?s.clear:0,wall,s.road?.2:.4);
  }

  /* Seitenansicht: Boden bzw. Wand, Modul als geneigter Balken, Maße */
  function svg(along,tilt,clear,wall,lim){
    const a=tilt*DEG, rise=along*Math.sin(a), proj=along*Math.cos(a);
    const W=wall?Math.max(proj+.6,1.2):Math.max(proj+.8,1.6), H=Math.max((wall?rise+.75:clear+rise)+.3,1.2);
    const sc=Math.min(320/W,200/H), pad=38, X=x=>pad+x*sc, Y=z=>pad+(H-z)*sc, th=.05;
    let g='';
    const st='stroke="var(--muted)"', t='font-size="12" fill="var(--ink)" font-family="Barlow, system-ui, sans-serif"';
    if(wall){
      const z0=.45, wx=.3; // Wand links; Modul oben an der Wand, unten mit Stütze nach außen
      g+=`<rect x="${X(0)}" y="${Y(H)}" width="${wx*sc}" height="${(H)*sc}" fill="var(--rule)"/>`;
      const p1=[wx+.05,z0+rise], p2=[wx+.05+proj,z0];
      g+=`<path d="M${X(0)} ${Y(0)}H${X(W)}" stroke="var(--muted)" stroke-width="1.5"/>`;
      /* erlaubte Ausladung als gestrichelte Linie */
      g+=`<path d="M${X(wx+lim)} ${Y(H-.05)}V${Y(0)}" stroke="var(--plan)" stroke-dasharray="4 3"/>`;
      g+=`<text x="${X(wx+lim)+4}" y="${Y(H-.05)+10}" font-size="11" fill="var(--plan)" font-family="Barlow, system-ui, sans-serif">limit ${f2(lim)} m</text>`;
      /* Halter: oben an der Wand, unten Stütze zurück zur Wand */
      g+=`<path d="M${X(wx)} ${Y(z0+rise)}H${X(wx+.05)}M${X(wx)} ${Y(z0)}H${X(wx+.05+proj)}" stroke="var(--plan)" stroke-width="2.5"/>`;
      g+=poly(p1,p2,th,X,Y);
      g+=`<path d="M${X(wx)} ${Y(z0-.15)}H${X(wx+.05+proj)}M${X(wx)} ${Y(z0-.1)}V${Y(z0-.2)}M${X(wx+.05+proj)} ${Y(z0-.1)}V${Y(z0-.2)}" ${st}/>`;
      g+=`<text x="${(X(wx)+X(wx+.05+proj))/2}" y="${Y(z0-.15)+14}" text-anchor="middle" ${t}>${f2(proj+.05)} m</text>`;
      g+=`<text x="${X(wx/2)}" y="${Y(H/2)}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="Barlow, system-ui, sans-serif" transform="rotate(-90 ${X(wx/2)} ${Y(H/2)})">Wall</text>`;
    } else {
      const x0=.4;
      g+=`<path d="M${X(0)} ${Y(0)}H${X(W)}" stroke="var(--muted)" stroke-width="1.5"/>`;
      let hatch=''; for(let x=X(0)+4;x<=X(W);x+=8) hatch+=`M${x.toFixed(1)} ${Y(0)}l-5 6`;
      g+=`<path d="${hatch}" stroke="var(--muted)" stroke-width=".7"/>`;
      const p1=[x0,clear], p2=[x0+proj,clear+rise];
      g+=poly(p1,p2,th,X,Y);
      if(clear>.02) g+=`<rect x="${X(x0)-2}" y="${Y(clear)}" width="4" height="${clear*sc}" fill="var(--plan)"/>`;
      g+=`<rect x="${X(x0+proj)-2}" y="${Y(clear+rise)}" width="4" height="${(clear+rise)*sc}" fill="var(--plan)"/>`;
      const xr=X(x0+proj)+22;
      g+=`<path d="M${xr} ${Y(0)}V${Y(clear+rise)}M${xr-5} ${Y(0)}H${xr+5}M${xr-5} ${Y(clear+rise)}H${xr+5}" ${st}/>`;
      g+=`<text x="${xr+8}" y="${(Y(0)+Y(clear+rise))/2}" ${t} dominant-baseline="central">${f2(clear+rise)} m</text>`;
    }
    const ax=wall?X(.35+.05+proj)-34:X(.4)+30, ay=wall?Y(.45)-6:Y(clear)-6;
    g+=`<text x="${ax}" y="${ay}" font-size="11" fill="var(--muted)" font-family="Barlow, system-ui, sans-serif">${tilt}°</text>`;
    return `<svg viewBox="0 0 ${(W*sc+pad*2+40).toFixed(0)} ${(H*sc+pad*2).toFixed(0)}" role="img" aria-label="Side view of the planned panels">${g}</svg>`;
  }
  function poly(p1,p2,th,X,Y){const dx=p2[0]-p1[0],dz=p2[1]-p1[1],l=Math.hypot(dx,dz)||1,nx=-dz/l*th,nz=dx/l*th;
    const pts=[[p1[0],p1[1]],[p2[0],p2[1]],[p2[0]+nx,p2[1]+nz],[p1[0]+nx,p1[1]+nz]];
    return `<polygon points="${pts.map(([x,z])=>X(x).toFixed(1)+','+Y(z).toFixed(1)).join(' ')}" fill="#3E4A55" stroke="#1F2A33" stroke-width=".8"/>`;}

  update();
})();
