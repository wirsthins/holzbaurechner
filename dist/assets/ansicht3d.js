/* Holzbaurechner – 3D-Ansicht.
   Wird von rechner.js erst nachgeladen, wenn die Ansicht in Sichtweite kommt: create(host, {label}) → {update(model)}.
   Modell (aus rechner.js, Maße in m, z nach oben):
     {parts:[{n:'Pfosten', c:'post', box:[x0,y0,z0,x1,y1,z1]} oder {…, prism:{plane:'yz'|'xz', pts:[[u,v],…], holes, at, t}}],
      hull:'Beschriftung für den Umschalter', person:[x,y], front:'x' (Vorderseite an der Stirnseite)}
   hull:1 = Verkleidung/Eindeckung (abschaltbar), env:1 = Umgebung (Hauswand), nicht in der Legende. */
import * as T from './vendor/three-0.187.min.js';

const FARBE={post:'#86562A',purlin:'#A96B31',rafter:'#D29E62',brace:'#BC8044',plate:'#C38C4F',
  board:'#E3C899',osb:'#CFAC72',roof:'#4B504C',glass:'#BCD8E6',wall:'#CDC9BF',person:'#7D8A83'};
const DUNKEL={roof:'#2F3431',wall:'#56605A',person:'#8E9C94'};
const ANSICHTEN=[['schraeg','Schräg',[.85,.6,1]],['vorne','Vorne',[0,.13,1]],['seite','Seite',[1,.13,0]],['oben','Oben',[0,1,.001]]];
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

export function create(host,{label='Modell'}={}){
  const stage=host.querySelector('.v3d-stage');
  let renderer;
  try{
    renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  }catch(e){
    stage.querySelector('.v3d-msg').textContent='Dein Browser oder Gerät kann die 3D-Ansicht nicht darstellen. Draufsicht und Seitenansicht oben zeigen die Maße.';
    return {update(){}};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  const cv=renderer.domElement;
  cv.setAttribute('role','img');
  cv.setAttribute('aria-label',`3D-Ansicht ${label}, mit Maus oder Finger drehbar`);
  stage.innerHTML='';
  stage.appendChild(cv);

  /* Bedienelemente */
  const touch=window.matchMedia&&matchMedia('(pointer: coarse)').matches;
  const bar=document.createElement('div'); bar.className='v3d-bar';
  bar.innerHTML=`<div class="v3d-views" role="group" aria-label="Blickrichtung">${ANSICHTEN.map(([k,t])=>`<button type="button" data-view="${k}" aria-pressed="false">${t}</button>`).join('')}</div>
    <div class="v3d-opts"><label class="v3d-hull" hidden><input type="checkbox" checked> <span></span></label><label><input type="checkbox" class="v3d-person" checked> Person (1,80 m)</label></div>`;
  host.insertBefore(bar,stage);
  const legend=document.createElement('div'); legend.className='v3d-legend'; legend.setAttribute('role','group'); legend.setAttribute('aria-label','Bauteil hervorheben');
  const hint=document.createElement('p'); hint.className='v3d-hint';
  hint.textContent=(touch?'Mit einem Finger drehen, mit zwei Fingern zoomen und verschieben.':'Ziehen zum Drehen, Mausrad zum Zoomen, rechte Maustaste zum Verschieben.')+' Bauteil antippen, um es hervorzuheben. Bodenraster: 1 m.';
  host.appendChild(legend); host.appendChild(hint);
  const hullBox=bar.querySelector('.v3d-hull'), hullIn=hullBox.querySelector('input'), personIn=bar.querySelector('.v3d-person');

  /* Szene */
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(35,1,.05,600);
  const controls=new T.OrbitControls(camera,cv);
  controls.maxPolarAngle=Math.PI/2-.02;
  controls.screenSpacePanning=true;
  scene.add(new T.HemisphereLight('#ffffff','#9c8f7c',1.55));
  const sun=new T.DirectionalLight('#fff7ea',2.1);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-.0004; sun.shadow.normalBias=.02;
  scene.add(sun,sun.target);
  const ground=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshLambertMaterial());
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  let grid=null;

  let dark=false;
  const mats={}, edgeMat=new T.LineBasicMaterial({transparent:true});
  function mat(c){
    if(mats[c]) return mats[c];
    const col=(dark&&DUNKEL[c])||FARBE[c]||FARBE.board;
    const solid=c==='glass'
      ?new T.MeshLambertMaterial({color:col,transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide})
      :new T.MeshLambertMaterial({color:col});
    const ghost=new T.MeshLambertMaterial({color:col,transparent:true,opacity:.1,depthWrite:false});
    return mats[c]={solid,ghost,col};
  }
  function theme(){
    const bg=css('--surface')||'#FBFCF8', rule=css('--rule')||'#CBD1C6';
    const c=new T.Color(bg); dark=(c.r+c.g+c.b)/3<.35;
    scene.background=c;
    ground.material.color=new T.Color(bg).lerp(new T.Color(rule),.55);
    edgeMat.color=new T.Color(dark?'#000000':'#3A2814'); edgeMat.opacity=dark?.55:.32;
    Object.keys(mats).forEach(k=>{const m=mats[k], col=(dark&&DUNKEL[k])||FARBE[k]||FARBE.board; m.solid.color.set(col); m.ghost.color.set(col); m.col=col;});
    fitFog(); render();
  }

  /* Geometrie */
  function prismGeom(p){
    const sh=new T.Shape(p.pts.map(([u,v])=>new T.Vector2(u,v)));
    (p.holes||[]).forEach(h=>sh.holes.push(new T.Path(h.map(([u,v])=>new T.Vector2(u,v)))));
    const g=new T.ExtrudeGeometry(sh,{depth:p.t,bevelEnabled:false});
    /* Modell (x,y,z mit z oben) → three.js (X=x, Y=z, Z=y) */
    const ax={x:new T.Vector3(1,0,0),y:new T.Vector3(0,0,1),z:new T.Vector3(0,1,0)};
    const [a1,a2]=p.plane.split(''), u=ax[a1].clone(), v=ax[a2].clone(), w=new T.Vector3().crossVectors(u,v);
    const third='xyz'.split('').find(k=>k!==a1&&k!==a2), wd=ax[third];
    const m=new T.Matrix4().makeBasis(u,v,w.dot(wd)>0?wd.clone():wd.clone().negate());
    m.setPosition(wd.clone().multiplyScalar(w.dot(wd)>0?p.at:p.at+p.t));
    g.applyMatrix4(m);
    return g;
  }
  function boxGeom(b){
    const [x0,y0,z0,x1,y1,z1]=b, g=new T.BoxGeometry(x1-x0,z1-z0,y1-y0);
    g.translate((x0+x1)/2,(z0+z1)/2,(y0+y1)/2);
    return g;
  }
  function personMesh(){
    const g=new T.Group(), m=mat('person').solid, add=(geo,x,y)=>{const o=new T.Mesh(geo,m); o.position.set(x,y,0); o.castShadow=true; g.add(o);};
    const leg=new T.CapsuleGeometry(.075,.72,4,10);
    add(leg,-.09,.435); add(leg,.09,.435);
    add(new T.CapsuleGeometry(.17,.36,6,14),1e-3,1.2);
    const arm=new T.CapsuleGeometry(.055,.5,4,10); add(arm,-.235,1.15); add(arm,.235,1.15);
    add(new T.SphereGeometry(.105,18,14),0,1.695);
    g.userData.person=true;
    return g;
  }
  let group=null, meshes=[], person=null, center=new T.Vector3(), R=0, active=null, first=true, model=null;
  function build(md){
    model=md; theme();
    if(group){group.traverse(o=>{if(o.geometry&&o!==ground) o.geometry.dispose();}); scene.remove(group);}
    group=new T.Group(); meshes=[];
    for(const p of md.parts){
      const geom=p.box?boxGeom(p.box):prismGeom(p.prism), mm=mat(p.c);
      const mesh=new T.Mesh(geom,mm.solid);
      mesh.userData={n:p.n,c:p.c,hull:!!p.hull,env:!!p.env};
      mesh.castShadow=p.c!=='glass'; mesh.receiveShadow=true;
      if(p.c!=='glass'&&p.c!=='wall') mesh.add(new T.LineSegments(new T.EdgesGeometry(geom,25),edgeMat));
      group.add(mesh); meshes.push(mesh);
    }
    if(md.person){person=personMesh(); person.position.set(md.person[0],0,md.person[1]); group.add(person);} else person=null;
    scene.add(group);

    const bb=new T.Box3();
    meshes.filter(m=>!m.userData.env).forEach(m=>bb.expandByObject(m));
    const oldR=R, oldC=center.clone();
    bb.getCenter(center); R=bb.getSize(new T.Vector3()).length()/2;

    /* Raster und Schatten an die Größe anpassen */
    if(grid){scene.remove(grid); grid.geometry.dispose(); grid.material.dispose();}
    const gs=Math.max(10,Math.ceil(R*8/2)*2);
    const gc=new T.Color(css('--rule')||'#CBD1C6').lerp(new T.Color(dark?'#ffffff':'#000000'),.1);
    grid=new T.GridHelper(gs,gs,gc,gc); grid.material.transparent=true; grid.material.opacity=dark?.5:.65;
    grid.position.set(Math.round(center.x),.003,Math.round(center.z)); scene.add(grid);
    sun.position.set(center.x-R*1.1,R*3,center.z+R*1.9); sun.target.position.copy(center);
    const sc=sun.shadow.camera; sc.left=sc.bottom=-R*1.8; sc.right=sc.top=R*1.8; sc.near=.1; sc.far=R*9; sc.updateProjectionMatrix();

    /* Legende */
    const names=[]; md.parts.forEach(p=>{if(!p.env&&!names.some(n=>n[0]===p.n)) names.push([p.n,p.c,!!p.hull]);});
    if(active&&!names.some(n=>n[0]===active)) active=null;
    legend.innerHTML=names.map(([n,c])=>`<button type="button" data-n="${esc(n)}" aria-pressed="${n===active}"><i style="background:${mat(c).col}${c==='glass'?';opacity:.6':''}"></i>${esc(n)}</button>`).join('');
    hullBox.hidden=!md.hull; hullBox.querySelector('span').textContent=md.hull||'';

    fitFog();
    if(first){first=false; setView('schraeg',false);}
    else if(oldR>0){
      const off=camera.position.clone().sub(controls.target).multiplyScalar(R/oldR);
      controls.target.add(center.clone().sub(oldC)); camera.position.copy(controls.target).add(off);
      controls.update();
    }
    apply();
  }

  function apply(){
    meshes.forEach(m=>{
      const u=m.userData, dim=active&&u.n!==active&&!u.env;
      m.visible=!(u.hull&&!hullIn.checked);
      m.material=dim?mat(u.c).ghost:mat(u.c).solid;
      m.castShadow=!dim&&u.c!=='glass';
      if(m.children[0]) m.children[0].visible=!dim;
    });
    if(person) person.visible=personIn.checked;
    legend.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.n===active)));
    render();
  }

  /* Kamera */
  function fitDist(){
    const vf=camera.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*camera.aspect);
    return R/Math.sin(Math.min(vf,hf)/2)*.8;
  }
  function fitFog(){if(R) scene.fog=new T.Fog(scene.background,R*5,R*12);}
  let anim=0;
  function setView(key,animate=true){
    const v=ANSICHTEN.find(a=>a[0]===key); if(!v||!R) return;
    bar.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
    /* Carport: Einfahrt an der Stirnseite, daher „Vorne“ und „Seite“ getauscht */
    const sw={vorne:'seite',seite:'vorne'}, vv=model&&model.front==='x'&&sw[key]?ANSICHTEN.find(x=>x[0]===sw[key]):v;
    const dir=new T.Vector3(...vv[2]).normalize(), to=center.clone().add(dir.multiplyScalar(fitDist()));
    camera.near=R/100; camera.far=R*40; camera.updateProjectionMatrix();
    cancelAnimationFrame(anim);
    if(!animate||window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){
      controls.target.copy(center); camera.position.copy(to); controls.update(); render(); return;}
    const p0=camera.position.clone(), t0=controls.target.clone(), d0=p0.distanceTo(t0), d1=to.distanceTo(center);
    const u0=p0.clone().sub(t0).normalize(), u1=to.clone().sub(center).normalize(), start=performance.now();
    const step=now=>{
      const k=Math.min(1,(now-start)/450), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      controls.target.lerpVectors(t0,center,e);
      const dir=u0.clone().lerp(u1,e); if(dir.lengthSq()<1e-6) dir.copy(u1); dir.normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(d0+(d1-d0)*e));
      controls.update(); render();
      if(k<1) anim=requestAnimationFrame(step);
    };
    anim=requestAnimationFrame(step);
  }

  let rq=0;
  function render(){ if(rq) return; rq=requestAnimationFrame(()=>{rq=0; renderer.render(scene,camera);}); }
  function resize(){
    const w=stage.clientWidth, h=stage.clientHeight; if(!w||!h) return;
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); render();
  }
  new ResizeObserver(resize).observe(stage); resize();

  controls.addEventListener('change',render);
  controls.addEventListener('start',()=>{cancelAnimationFrame(anim); bar.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-view]'); if(b) setView(b.dataset.view);});
  hullIn.addEventListener('change',apply); personIn.addEventListener('change',apply);
  legend.addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return;
    active=active===b.dataset.n?null:b.dataset.n;
    if(active&&meshes.some(m=>m.userData.n===active&&m.userData.hull)) hullIn.checked=true;
    apply();});
  if(window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(model) build(model); else theme();});

  let pending=null, raf=0;
  return {update(md){pending=md; if(!raf) raf=requestAnimationFrame(()=>{raf=0; build(pending);});}};
}
