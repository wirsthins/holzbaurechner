/* Auswahl von Land und Bundesland auf /baugenehmigung/. Ohne JavaScript bleibt die komplette Liste sichtbar. */
(function(){
  const picker=document.querySelector('.bo-picker'); if(!picker) return;
  const tabs=[...picker.querySelectorAll('[data-tab]')], sel=picker.querySelector('select');
  const cards=[...document.querySelectorAll('.bo-card')], lands=[...document.querySelectorAll('.bo-land')];
  let land='de';
  document.body.classList.add('bo-js'); picker.hidden=false;

  function fill(){
    sel.innerHTML=cards.filter(c=>c.dataset.land===land).map(c=>`<option value="${c.id}">${c.querySelector('h3').textContent}</option>`).join('');
  }
  function show(id,push){
    const card=document.getElementById(id); if(!card) return;
    land=card.dataset.land;
    tabs.forEach(t=>t.setAttribute('aria-selected',String(t.dataset.tab===land)));
    fill(); sel.value=id;
    lands.forEach(l=>l.classList.toggle('bo-active',l.dataset.land===land));
    cards.forEach(c=>c.classList.toggle('bo-active',c.id===id));
    if(push) history.replaceState(null,'','#'+id);
  }
  tabs.forEach(t=>t.addEventListener('click',()=>{
    const first=cards.find(c=>c.dataset.land===t.dataset.tab); show(first.id,true);
  }));
  tabs.forEach((t,i)=>t.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const n=tabs[(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];n.focus();n.click();}
  }));
  sel.addEventListener('change',()=>show(sel.value,true));
  window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);const c=document.getElementById(h);if(c&&c.classList.contains('bo-card'))show(h,false);});
  const start=location.hash.slice(1);
  show(document.getElementById(start)&&document.getElementById(start).classList.contains('bo-card')?start:cards[0].id,false);
})();
