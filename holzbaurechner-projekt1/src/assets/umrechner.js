/* Umrechner Kubikmeter <-> Laufmeter und €/m³ <-> €/lfm auf der Holzpreise-Seite */
(function(){
  const box=document.getElementById('umrechner'); if(!box) return;
  const $=id=>document.getElementById(id);
  const b=$('cv-b'), h=$('cv-h'), m3=$('cv-m3'), lfm=$('cv-lfm'), pm3=$('cv-pm3'), plfm=$('cv-plfm'), wood=$('cv-wood'), out=box.querySelector('.conv-out');
  const H=(window.HOLZPREISE||{}).hoelzer||{};
  const fmt=(n,d)=>n.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
  const num=el=>{const x=parseFloat(String(el.value).replace(',','.'));return isFinite(x)?x:NaN;};
  const set=(el,x,d)=>{el.value=isFinite(x)?String(Math.round(x*10**d)/10**d):'';};
  let qSrc='m3', pSrc='pm3';

  wood.innerHTML=Object.entries(H).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')+'<option value="">Eigener Preis</option>';
  if(H.kvh){wood.value='kvh'; pm3.value=H.kvh.preis;}

  function calc(){
    const q=num(b)/100*num(h)/100; // m³ pro Laufmeter
    if(!(q>0)){out.textContent='Bitte einen Querschnitt eingeben.';return;}
    if(qSrc==='m3') set(lfm,num(m3)/q,2); else set(m3,num(lfm)*q,4);
    if(pSrc==='pm3') set(plfm,num(pm3)*q,2); else set(pm3,num(plfm)/q,0);
    const tot=num(m3)*num(pm3);
    out.innerHTML=`1 lfm = <strong>${fmt(q,q<.01?5:4)} m³</strong> · 1 m³ = <strong>${fmt(1/q,1)} lfm</strong>`+(isFinite(tot)&&tot>0?` · Gesamt rund <strong>${fmt(Math.round(tot),0)} €</strong>`:'');
    box.querySelectorAll('.conv-chips button').forEach(btn=>{const [x,y]=btn.dataset.q.split('x').map(Number);btn.setAttribute('aria-pressed',String(x===num(b)&&y===num(h)));});
  }
  [b,h].forEach(el=>el.addEventListener('input',calc));
  m3.addEventListener('input',()=>{qSrc='m3';calc();});
  lfm.addEventListener('input',()=>{qSrc='lfm';calc();});
  pm3.addEventListener('input',()=>{pSrc='pm3';wood.value='';calc();});
  plfm.addEventListener('input',()=>{pSrc='plfm';wood.value='';calc();});
  wood.addEventListener('change',()=>{if(H[wood.value]){pm3.value=H[wood.value].preis;pSrc='pm3';calc();}});
  box.querySelectorAll('.conv-chips button').forEach(btn=>btn.addEventListener('click',()=>{const [x,y]=btn.dataset.q.split('x');b.value=x;h.value=y;calc();}));
  calc();
})();
