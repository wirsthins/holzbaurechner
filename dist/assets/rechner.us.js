/* Holzbaurechner US – lumber calculators in feet and inches. Each page embeds <div data-rechner="deck"></div>.
   Inputs in ft or in, geometry for drawings and 3D in meters (1 in = 0.0254 m).
   Lumber is priced per linear foot (window.LUMBER_US from src/i18n/us/prices.json) and packed into stock lengths. */
(function(){
const PR=(typeof window!=='undefined'&&window.LUMBER_US)||{materials:{},items:{}};
const MAT=PR.materials||{}, ITEM=PR.items||{};
const IN=.0254, M=x=>x*IN;
/* actual size in inches [thickness, width] for nominal lumber */
const SIZE={'1/2x4':[.5,3.5],'1x4':[.75,3.5],'1x6':[.75,5.5],'1x8':[.75,7.25],'1x10':[.75,9.25],'1x12':[.75,11.25],
  '5/4x6':[1,5.5],'composite':[.94,5.5],'picket':[.625,5.5],'2x4':[1.5,3.5],'2x6':[1.5,5.5],'2x8':[1.5,7.25],
  '2x10':[1.5,9.25],'2x12':[1.5,11.25],'4x4':[3.5,3.5],'6x6':[5.5,5.5]};
const SIZE_LABEL={'1/2x4':'1/2x4','composite':'1x6 composite','picket':'5/8x6 picket','5/4x6':'5/4x6'};
/* stock lengths in feet */
const STOCK={'2x10':[8,10,12,14,16,20],'2x12':[8,10,12,14,16,20],'4x4':[6,8,10,12],'6x6':[8,10,12,16],'picket':[4,5,6,8],
  '1/2x4':[2,4,6,8],'1x4':[4,6,8,10,12],'1x6':[4,6,8,10,12],'1x8':[4,6,8,10,12],'1x10':[4,6,8,10,12],'1x12':[4,6,8,10,12],
  'composite':[12,16,20],'5/4x6':[8,10,12,16]};
const stockOf=s=>STOCK[s]||[8,10,12,14,16];

/* ---------- formatting ---------- */
const num=(n,d=0)=>n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
function frac(x,den=8){let w=Math.floor(x+1e-9), f=Math.round((x-w)*den); if(f===den){w++;f=0;}
  if(!f) return String(w); let n=f,d=den; while(n%2===0){n/=2;d/=2;} return (w?w+'-':'')+n+'/'+d;}
function ftin(inches,den=8){const x=Math.round(inches*den)/den; let ft=Math.floor(x/12+1e-9), r=x-ft*12;
  if(r>=12-1e-9){ft++;r=0;} if(!ft) return frac(r,den)+'"'; return r<1e-9?ft+"'":ft+"' "+frac(r,den)+'"';}
const inch=(x,den=8)=>frac(x,den)+'"';
const usd=(n,st=10)=>'$'+num(Math.round(n/st)*st);
const usd2=n=>'$'+num(n,2);
const pick=(t,v)=>{for(const [m,d] of t) if(v<=m) return d; return t[t.length-1][1];};
const lbl=s=>SIZE_LABEL[s]||s;
const matLabel=m=>(MAT[m]||{}).label||m;

/* ---------- parts, prices, stock packing ---------- */
const part=(name,size,mat,len,qty)=>({name,size,mat,len,qty});
const hw=(label,qty,each,est=true)=>({label,qty,cost:qty*each,est});
function rate(mat,size){const r=((MAT[mat]||{}).rates||{})[size]; return r==null?null:r;}
function boardPrice(mat,size,ft){const r=rate(mat,size); return r==null?null:r*ft*(ft>=20?1.25:ft>=16?1.1:1);}
/* cuts (inches) into stock boards: best fit, new boards picked by cost per inch used. 1/8" saw kerf */
function pack(cuts,mat,size){
  const K=.125, OVER=.25, Ls=stockOf(size), maxIn=Ls[Ls.length-1]*12, cost=L=>boardPrice(mat,size,L)||L;
  const rest=[]; cuts.forEach(c=>{ if(c>maxIn+1e-6){const n=Math.ceil(c/maxIn); for(let i=0;i<n;i++) rest.push(c/n);} else rest.push(c); });
  rest.sort((a,b)=>b-a);
  const open=[];
  while(rest.length){
    const c=rest.shift();
    let bi=-1, br=1e9; open.forEach((b,i)=>{const r=b.rem-c-K; if(r>=-1e-6&&r<br){br=r;bi=i;}});
    if(bi>=0){open[bi].rem-=c+K; continue;}
    /* stock comes about 1/4" long, so a 12 ft board yields two 6 ft cuts */
    const same=1+rest.filter(x=>Math.abs(x-c)<.01).length; let best=null;
    Ls.filter(L=>L*12+OVER>=c-1e-6).forEach(L=>{const k=Math.max(1,Math.min(same,Math.floor((L*12+OVER+K)/(c+K)))), v=cost(L)/(k*c);
      if(!best||v<best.v-1e-9) best={L,v};});
    open.push({ft:best.L,rem:best.L*12+OVER-c});
  }
  const cnt={}; open.forEach(b=>cnt[b.ft]=(cnt[b.ft]||0)+1);
  return Object.entries(cnt).map(([ft,n])=>({ft:+ft,n})).sort((a,b)=>a.ft-b.ft);
}
function shopping(parts,spare){
  const groups=new Map();
  parts.forEach(p=>{const k=p.mat+'|'+p.size; if(!groups.has(k)) groups.set(k,{mat:p.mat,size:p.size,cuts:[]});
    const g=groups.get(k); if(p.lens) g.cuts.push(...p.lens); else for(let i=0;i<p.qty;i++) g.cuts.push(p.len);});
  const lines=[];
  groups.forEach(g=>{
    const st=pack(g.cuts,g.mat,g.size), tot=st.reduce((a,x)=>a+x.n,0), add=Math.round(tot*spare/100);
    if(add) st[st.length-1].n+=add;
    st.forEach(x=>{const each=boardPrice(g.mat,g.size,x.ft); lines.push({mat:g.mat,size:g.size,ft:x.ft,n:x.n,each,cost:(each||0)*x.n});});
  });
  return lines;
}

/* ---------- IRC 2021 span tables (40 psf live load, 10 psf dead load, No. 2 grade, wet service) ---------- */
/* Table R507.6 joist spans in inches at 12 / 16 / 24 in. on center */
const SPC=[12,16,24];
const JOIST={
  sp:{'2x6':[119,108,91],'2x8':[157,142,116],'2x10':[194,168,137],'2x12':[216,198,162]},
  df:{'2x6':[114,104,86],'2x8':[150,133,109],'2x10':[188,163,133],'2x12':[216,189,154]},
  rc:{'2x6':[106,96,82],'2x8':[140,127,104],'2x10':[179,156,127],'2x12':[209,181,148]}};
const SPECIES={sp:'Southern pine',df:'Douglas fir-larch, hem-fir, SPF',rc:'Redwood, western cedars'};
/* Table R507.5(1) beam spans in inches for effective joist spans of 6, 8, 10, 12, 14, 16, 18 ft */
const BEAM={
  sp:{'2-2x8':[105,91,81,74,69,64,60],'2-2x10':[124,108,96,88,81,76,72],'2-2x12':[146,127,113,103,96,89,84],
      '3-2x8':[131,114,102,93,86,80,76],'3-2x10':[156,134,120,110,102,95,90],'3-2x12':[183,159,142,129,120,112,106]},
  df:{'2-2x8':[98,85,76,69,62,56,52],'2-2x10':[120,103,93,84,78,72,66],'2-2x12':[139,120,107,98,91,85,80],
      '3-2x8':[123,106,95,87,80,75,71],'3-2x10':[150,130,116,106,98,92,86],'3-2x12':[174,151,135,123,114,107,101]}};
function beamSpan(sp,key,ljFt){const c=[6,8,10,12,14,16,18], t=BEAM[sp][key];
  if(ljFt<=6) return t[0]; if(ljFt>18) return 0;
  for(let i=1;i<c.length;i++) if(ljFt<=c[i]) return t[i-1]+(t[i]-t[i-1])*(ljFt-c[i-1])/2; return 0;}
function joistFor(sp,spanIn,s){const i=SPC.indexOf(s); for(const z of ['2x6','2x8','2x10','2x12']) if(JOIST[sp][z][i]>=spanIn-1e-6) return z; return null;}
/* beam size and post count along one beam line of length W (in), cheapest combination */
function beamLine(sp,W,ljFt,postEach,maxPs){
  let best=null;
  for(let n=2;n<=24;n++){
    const ob=Math.min(12,W/(n-1)/4.5), ps=(W-2*ob)/(n-1);
    if(maxPs&&ps>maxPs+1e-6) continue;
    for(const key of Object.keys(BEAM[sp])){
      if(beamSpan(sp,key,ljFt)<ps-1e-6) continue;
      const pl=+key[0], z=key.slice(2), cost=n*postEach+pl*W/12*(rate('pt',z)||2);
      if(!best||cost<best.cost-1e-6) best={n,ob,ps,key,plies:pl,size:z,cost};
    }
  }
  return best;
}
function postXs(W,b){const xs=[]; for(let i=0;i<b.n;i++) xs.push(b.ob+i*b.ps); return xs;}
const bagsFor=(diaIn,depthIn,yieldFt3,postIn=0)=>Math.max(1,Math.ceil(((Math.PI*diaIn*diaIn/4-postIn*postIn)*depthIn/1728)/yieldFt3-1e-9));

/* ---------- deck: framing and boards ----------
   x = along the house (width W), y = away from the house (depth D), z = height. All inputs in inches. */
function deckCore(v,o){
  const sp=o.west?'df':'sp', W=v.W*12, D=v.D*12, s=+v.S, Hd=v.H*12, deckT=o.deckT||0;
  let k, z, span, c, ok=false;
  for(k=o.free?2:1;k<=4;k++){
    c=Math.min(24,Math.round(D*.08));
    for(let it=0;it<2;it++){ const sup=o.free?D-2*c:D-c; span=o.free?sup/(k-1):sup/k; c=Math.min(c,Math.floor(span/4)); }
    const sup=o.free?D-2*c:D-c; span=o.free?sup/(k-1):sup/k;
    z=joistFor(sp,span,s); if(z){ok=true;break;}
  }
  if(!ok){k=o.free?4:4; z='2x12';}
  const jd=SIZE[z][1], nJ=Math.ceil(W/s-1e-9)+1, jx=[]; for(let i=0;i<nJ;i++) jx.push(Math.min(i*s,W-.75)+(i===0?.75:0));
  jx[0]=.75; jx[nJ-1]=W-.75;
  /* beam rows (y = center line) */
  const rows=[]; const ys=[];
  if(o.free){for(let j=0;j<k;j++) ys.push(c+j*span);} else {for(let j=1;j<=k;j++) ys.push(j*span);}
  const post6=(rate('pt','6x6')||3.8)*Math.max(1,(Hd-jd)/12)+(ITEM.postBase6||28)+(ITEM.postCap6||22)+bagsFor(12,v.F,0.6)*(ITEM.concrete80||6.5);
  ys.forEach((y,j)=>{
    const last=j===ys.length-1, first=j===0;
    const trib=o.free?((first||last)?c+span/2:span):(last?c+span/2:span);
    const lj=Math.max(6,(trib*2)/12);
    const b=beamLine(sp,W,Math.min(18,lj),post6)||{n:2,ob:12,ps:W-24,key:'3-2x12',plies:3,size:'2x12'};
    rows.push(Object.assign({y,lj},b,{xs:postXs(W,b)}));
  });
  const bd=Math.max(...rows.map(r=>SIZE[r.size][1]));
  const postH=Hd-deckT-jd-bd, nPosts=rows.reduce((a,r)=>a+r.n,0), usePosts=postH>=8;
  /* parts */
  const parts=[];
  const gap=o.gap||0, bw=5.5;
  let nd=0;
  if(o.deck){ nd=Math.ceil(D/(bw+gap)-1e-9); parts.push(part('Deck boards',o.deck.size,o.deck.mat,W,nd)); }
  const jl=o.free?D-3:D-1.5;
  parts.push(part('Joists',z,'pt',jl,nJ));
  parts.push(part(o.free?'Rim joists (front and back)':'Rim joist (front)',z,'pt',W,o.free?2:1));
  if(!o.free) parts.push(part('Ledger board',z,'pt',W,1));
  const blockRows=(o.free?k-1:k)*(span>96?1:0);
  if(blockRows) parts.push(part('Mid-span blocking',z,'pt',s-1.5,blockRows*(nJ-1)));
  const byKey={}; rows.forEach(r=>{byKey[r.key]=(byKey[r.key]||0)+1;});
  Object.entries(byKey).forEach(([key,n])=>parts.push(part(`Beam plies (${key.replace('-','-ply ')})`,key.slice(2),'pt',W,+key[0]*n)));
  if(usePosts) parts.push(part('Posts','6x6','pt',postH,nPosts));
  /* hardware */
  const hws=[];
  if(!o.free) hws.push(hw('Joist hangers',nJ,ITEM.joistHanger||2.6), hw('Ledger fasteners (1/2" lags or structural screws)',Math.ceil(W/16)*2,ITEM.ledgerFastener||3));
  hws.push(hw('Hurricane ties at beams',nJ*k,ITEM.hurricaneTie||1.2));
  if(usePosts) hws.push(hw('Post bases and post caps',nPosts,(ITEM.postBase6||28)+(ITEM.postCap6||22)));
  hws.push(hw(`Concrete for footings (80 lb bags, 12" dia. × ${v.F}" deep)`,bagsFor(12,v.F,0.6)*nPosts,ITEM.concrete80||6.5));
  if(o.deck) hws.push(o.deck.mat==='composite'?hw('Hidden fasteners (clips)',nd*nJ,ITEM.hiddenClip||.4):hw('Deck screws',nd*nJ*2,ITEM.deckScrew||.11));
  hws.push(hw('Framing screws and nails',Math.round(nJ*8+nPosts*8+(blockRows*(nJ-1))*4),ITEM.framingScrew||.12));
  /* drawings in meters */
  const Wm=M(W), Dm=M(D), jw=M(1.5), it=[];
  if(!o.free) it.push({k:'wall',x:0,y:-.12,w:Wm,h:.12});
  it.push({k:'outline',x:0,y:0,w:Wm,h:Dm});
  rows.forEach(r=>{const bwid=M(r.plies*1.5); it.push({k:'hidden',x:0,y:M(r.y)-bwid/2,w:Wm,h:bwid});});
  jx.forEach(x=>it.push({k:'beam',x:M(x)-jw/2,y:o.free?jw:0,w:jw,h:M(jl)}));
  it.push({k:'beam',x:0,y:Dm-jw,w:Wm,h:jw});
  if(o.free) it.push({k:'beam',x:0,y:0,w:Wm,h:jw}); else it.push({k:'beam',x:0,y:0,w:Wm,h:jw});
  rows.forEach(r=>r.xs.forEach(x=>it.push({k:'post',x:M(x-2.75),y:M(r.y-2.75),w:M(5.5),h:M(5.5)})));
  const ztop=M(Hd), zj=ztop-M(deckT), zjb=zj-M(jd);
  const side=(()=>{
    const s2=[], x0=o.free?0:-.22;
    if(!o.free) s2.push({k:'wall',x:-.22,z:0,w:.22,h:ztop+.4});
    if(!o.free) s2.push({k:'beam',x:0,z:zjb,w:jw,h:M(jd)});
    s2.push({k:'beam',x:o.free?jw:jw,z:zjb,w:Dm-2*jw,h:M(jd)});
    s2.push({k:'beam',x:Dm-jw,z:zjb,w:jw,h:M(jd)}); if(o.free) s2.push({k:'beam',x:0,z:zjb,w:jw,h:M(jd)});
    rows.forEach(r=>{const bwid=M(r.plies*1.5), bh=M(SIZE[r.size][1]); s2.push({k:'beam',x:M(r.y)-bwid/2,z:zjb-bh,w:bwid,h:bh});
      if(usePosts) s2.push({k:'post',x:M(r.y)-M(2.75),z:0,w:M(5.5),h:Math.max(0,zjb-bh)});});
    if(o.deck) s2.push({k:'board',x:0,z:zj,w:Dm,h:M(deckT)}); else s2.push({k:'hidden',x:0,z:zj,w:Dm,h:M(1)});
    return {w:Dm,x0,zTop:ztop+.25,right:ztop,left:ztop,wallLabel:!o.free,items:s2,unit:'ftin'};
  })();
  const model=()=>{
    const P=[];
    if(!o.free) P.push({n:'House wall',c:'wall',env:1,box:[-.4,-.3,0,Wm+.4,0,ztop+1.2]});
    rows.forEach(r=>{const bwid=M(r.plies*1.5), bh=M(SIZE[r.size][1]);
      P.push({n:'Beams',c:'purlin',box:[0,M(r.y)-bwid/2,zjb-bh,Wm,M(r.y)+bwid/2,zjb]});
      if(usePosts) r.xs.forEach(x=>P.push({n:'Posts',c:'post',box:[M(x-2.75),M(r.y-2.75),0,M(x+2.75),M(r.y+2.75),zjb-bh]}));});
    jx.forEach(x=>P.push({n:'Joists',c:'rafter',box:[M(x)-jw/2,o.free?jw:0,zjb,M(x)+jw/2,(o.free?jw:0)+M(jl),zj]}));
    P.push({n:'Rim joists',c:'plate',box:[0,Dm-jw,zjb,Wm,Dm,zj]});
    if(o.free) P.push({n:'Rim joists',c:'plate',box:[0,0,zjb,Wm,jw,zj]}); else P.push({n:'Ledger board',c:'plate',box:[0,-jw,zjb,Wm,0,zj]});
    if(o.deck){const t=M(deckT), bm=M(bw), g=M(gap); for(let i=0;i<nd;i++){const y0=i*(bm+g); if(y0>=Dm) break;
      P.push({n:'Deck boards',c:'board',hull:1,box:[0,y0,zj,Wm,Math.min(Dm,y0+bm),zj+t]});}}
    return {parts:P,hull:o.deck?'Show deck boards':undefined,person:[Wm*.6,Math.min(Dm*.5,1.5)],front:'x'};
  };
  return {sp,k,z,span,c,s,nJ,nd,rows,postH,usePosts,nPosts,parts,hws,jl,
    plan:{w:Wm,h:Dm,items:it,top:o.free?0:-.12,unit:'ftin',title:'Framing plan'},side,model};
}
const SPACING={id:'S',label:'Joist spacing',type:'select',options:[[12,'12 in. on center'],[16,'16 in. on center'],[24,'24 in. on center']],value:16};

const PROJECTS={
  deck:{
    label:'deck',
    fields:[
      {id:'W',label:'Width along the house',unit:'ft',min:6,max:40,step:.5,value:16},
      {id:'D',label:'Depth out from the house',unit:'ft',min:4,max:20,step:.5,value:12},
      {id:'H',label:'Deck height above ground',unit:'ft',min:1,max:12,step:.25,value:3},
      SPACING,
      {id:'F',label:'Footing depth (frost line)',unit:'in',min:12,max:72,step:1,value:36}
    ],
    mats:['pt','cedar','composite'], matLabel:'Decking',
    option:'Freestanding deck (no ledger on the house)', option2:'West Coast framing lumber (Douglas fir or hem-fir)',
    calc(v,free,west,mat){
      const comp=mat==='composite', deck={size:comp?'composite':'5/4x6',mat};
      let s=+v.S; const capped=s>16; if(capped) s=16;
      const r=deckCore(Object.assign({},v,{S:s}),{free,west,deck,deckT:SIZE[deck.size][0],gap:comp?3/16:1/8});
      const area=v.W*v.D;
      const notes=[
        `${r.nJ} joists (${r.z}, ${r.s} in. on center) spanning ${ftin(r.span)}${r.c>0?` with a ${ftin(r.c)} overhang past the beam`:''}. Sized with IRC Table R507.6 for ${SPECIES[r.sp].toLowerCase()}.`,
        `${r.rows.length===1?'One beam':`${r.rows.length} beams`}: ${r.rows.map(b=>`${b.key.replace('-','-ply ')} on ${b.n} posts, ${ftin(b.ps)} apart`).join('; ')}. Sized with IRC Table R507.5.`,
        v.W>20?'Beam plies longer than 20 ft are spliced over a post. Stagger the joints of the plies.':'',
        `${r.nd} rows of ${comp?'composite':'5/4x6'} deck boards across the joists${comp?' with 3/16" gaps':' with 1/8" gaps'}.`+(v.W>16?` Boards longer than 16 ft are joined over a doubled joist.`:''),
        r.usePosts?`${r.nPosts} posts (6x6), about ${ftin(r.postH)} from footing to beam, on post bases above concrete footings.`:'The deck is too low for posts: set the beams on concrete footings or deck blocks.',
        capped?`${comp?'Composite':'5/4 wood'} decking needs joists no more than 16 in. apart, so the calculation uses 16 in.`:'',
        'Stairs, railings and guards are not included. Decks more than 30 in. above grade need guards, and most building departments require a permit for any attached deck.'
      ].filter(Boolean);
      return Object.assign(r,{notes,
        summary:[[`${num(area)} sq ft`,'Deck area'],[r.z,'Joists'],[r.rows[0].key.replace('-','-ply '),'Beam'],[String(r.nPosts),'Posts']]});
    }
  },
  joists:{
    label:'deck frame',
    fields:[
      {id:'W',label:'Deck width along the beam',unit:'ft',min:6,max:40,step:.5,value:16},
      {id:'D',label:'Deck depth (joist direction)',unit:'ft',min:4,max:20,step:.5,value:12},
      {id:'H',label:'Deck height above ground',unit:'ft',min:1,max:12,step:.25,value:3},
      SPACING,
      {id:'F',label:'Footing depth (frost line)',unit:'in',min:12,max:72,step:1,value:36}
    ],
    option:'Freestanding deck (no ledger on the house)', option2:'West Coast framing lumber (Douglas fir or hem-fir)',
    calc(v,free,west){
      const r=deckCore(v,{free,west,deckT:1});
      const i=SPC.indexOf(+v.S), t=JOIST[r.sp];
      const summary=['2x6','2x8','2x10','2x12'].map(z=>[ftin(t[z][i]),`${z} max. span${z===r.z?' (chosen)':''}`]);
      const notes=[
        `Joist span ${ftin(r.span)} from ${free?'beam to beam':'ledger to beam'}: ${r.z} joists at ${v.S} in. on center are the smallest size that works (IRC Table R507.6, ${SPECIES[r.sp].toLowerCase()}, No. 2).`,
        `Allowed overhang past the beam: up to a quarter of the joist span. The calculation uses ${ftin(r.c)}.`,
        `${r.rows.length===1?'Beam':'Beams'}: ${r.rows.map(b=>`${b.key.replace('-','-ply ')} with posts ${ftin(b.ps)} apart (allowed ${ftin(beamSpan(r.sp,b.key,Math.min(18,b.lj)))})`).join('; ')}.`,
        r.usePosts?`${r.nPosts} posts (6x6), about ${ftin(r.postH)} tall.`:'Too low for posts: beams sit on footings or deck blocks.',
        'The tables assume 40 psf live load and 10 psf dead load. Areas with ground snow loads above 40 psf, hot tubs and heavy planters need larger members or an engineer.',
        'Decking is not included. Use the deck calculator for boards and screws.'
      ];
      return Object.assign(r,{notes,summary});
    }
  },
  fence:{
    label:'fence', postLabel:'Posts',
    fields:[
      {id:'L',label:'Fence length',unit:'ft',min:8,max:500,step:1,value:100},
      {id:'H',label:'Fence height',type:'select',options:[[3,'3 ft'],[4,'4 ft'],[5,'5 ft'],[6,'6 ft'],[8,'8 ft']],value:6},
      {id:'A',label:'Post spacing',unit:'ft',min:4,max:8,step:.5,value:8},
      {id:'G',label:'Gap between pickets',unit:'in',min:0,max:4,step:.25,value:0}
    ],
    mats:['pt','cedar'], matLabel:'Pickets and rails',
    calc(v,_a,_b,mat){
      const H=+v.H, n=Math.ceil(v.L/v.A-1e-9)+1, a=v.L*12/(n-1), big=H>=8, ps=big?'6x6':'4x4', pw=SIZE[ps][0];
      const bury=Math.max(24,Math.round(H*12/3)), postL=H*12+bury, rows=H<=4?2:3;
      const nl=Math.ceil(v.L*12/(5.5+v.G)-1e-9);
      const parts=[part('Posts (ground contact)',ps,'pt',postL,n),part('Rails',`2x4`,mat,a,rows*(n-1)),part('Pickets','picket',mat,H*12,nl)];
      const dia=big?12:10, bags=bagsFor(dia,bury,.375,pw)*n;
      const hws=[hw(`Fast-setting concrete (50 lb bags, ${dia}" holes)`,bags,ITEM.concrete50||7.5),
        hw('Rail brackets or structural screws',rows*(n-1)*2,ITEM.railBracket||1.1),
        hw('Galvanized picket nails or screws',nl*rows*2,ITEM.fenceNail||.04)];
      const f=Math.min(2,n-1), w=M(f*a), itm=[], pwm=M(pw), hm=M(H*12);
      for(let i=0;i<=f;i++) itm.push({k:'post',x:i*M(a)-pwm/2,z:0,w:pwm,h:hm});
      const rz=rows===3?[M(10),hm/2-M(1.75),hm-M(14)]:[M(10),hm-M(14)];
      rz.forEach(z=>itm.push({k:'beam',x:-pwm/2,z,w:w+pwm,h:M(3.5)}));
      const g=M(v.G), pb=M(5.5);
      for(let x=0;x+pb<=w+1e-9;x+=pb+g) itm.push({k:'board',x,z:M(2),w:pb,h:hm});
      return {parts,hws,
        summary:[[String(n),'Posts'],[String(rows*(n-1)),'Rails'],[String(nl),'Pickets'],[String(bags),'Concrete bags']],
        notes:[`${n} posts (${ps}) ${ftin(a)} apart, each ${ftin(postL)} long with ${ftin(bury)} in the ground.`,
          `${rows} rails per section, ${nl} pickets ${v.G?`with ${inch(v.G)} gaps`:'butted tight for privacy'}. Pickets end about 2 in. above the ground.`,
          v.G===0?'Pickets shrink as they dry. Butted pickets on a privacy fence leave small gaps after the first summer, so some builders overlap them or add battens.':'',
          'Posts are always pressure-treated for ground contact. Cedar posts in concrete rot quickly.',
          'Most cities let you build up to 6 ft in back yards and 3 to 4 ft in front yards without a permit. Check local rules, HOA covenants and call 811 before you dig.',
          'Gates, post caps and stain are not included.'].filter(Boolean),
        side:{title:'Elevation',w,x0:-M(3),zTop:hm+M(2),items:itm,unit:'ftin',topLabel:f<n-1?`Detail: ${f} of ${n-1} sections, ${ftin(a)} each`:null}};
    }
  },
  patio:{
    label:'patio cover',
    fields:[
      {id:'W',label:'Width along the house',unit:'ft',min:8,max:40,step:.5,value:16},
      {id:'D',label:'Projection from the house',unit:'ft',min:6,max:16,step:.5,value:12},
      {id:'H',label:'Height under the front beam',unit:'ft',min:7,max:12,step:.25,value:8},
      {id:'A',label:'Max. post spacing',unit:'ft',min:6,max:16,step:.5,value:12},
      {id:'F',label:'Footing depth (frost line)',unit:'in',min:12,max:72,step:1,value:36}
    ],
    option:'Solid roof (polycarbonate or metal panels)', option2:'West Coast framing lumber (Douglas fir or hem-fir)',
    calc(v,roof,west){
      const sp=west?'df':'sp', W=v.W*12, D=v.D*12, H=v.H*12, ov=12, span=D-ov;
      let s=roof?24:16, z=joistFor(sp,span,s); if(!z){s=16;z=joistFor(sp,span,16);} if(!z){s=12;z=joistFor(sp,span,12)||'2x12';}
      const zd=SIZE[z][1];
      const nr=Math.ceil(W/s-1e-9)+1;
      const post=(rate('pt','6x6')||3.8)*H/12+(ITEM.postBase6||28)+(ITEM.postCap6||22)+bagsFor(12,v.F,.6)*(ITEM.concrete80||6.5);
      const lj=Math.min(18,Math.max(6,(span/2+ov)*2/12)), b=beamLine(sp,W,lj,post,v.A*12)||beamLine(sp,W,lj,post);
      const bd=SIZE[b.size][1], xs=postXs(W,b), nk=2*(b.n-1);
      const slope=roof?.5:0, rl=D;
      const parts=[part('Posts','6x6','pt',H,b.n),part(`Front beam (${b.key.replace('-','-ply ')})`,b.size,'pt',W,b.plies),
        part('Ledger board',z,'pt',W,1),part('Rafters',z,'pt',rl,nr),part('Knee braces','4x4','pt',36,nk)];
      const hws=[hw('Rafter hangers at the ledger',nr,ITEM.joistHanger||2.6),hw('Hurricane ties at the beam',nr,ITEM.hurricaneTie||1.2),
        hw('Ledger fasteners (1/2" lags or structural screws)',Math.ceil(W/16)*2,ITEM.ledgerFastener||3),
        hw('Post bases and post caps',b.n,(ITEM.postBase6||28)+(ITEM.postCap6||22)),
        hw(`Concrete for footings (80 lb bags, 12" dia. × ${v.F}" deep)`,bagsFor(12,v.F,.6)*b.n,ITEM.concrete80||6.5),
        hw('Structural screws for knee braces',nk*4,1.2)];
      const extras=roof?[{label:`Roof panels and fasteners for ${num(v.W*v.D)} sq ft`,cost:v.W*v.D*2.75,est:true}]:[];
      const Wm=M(W), Dm=M(D), it=[{k:'wall',x:0,y:-.12,w:Wm,h:.12},{k:'outline',x:0,y:0,w:Wm,h:Dm}];
      const rg=(W-1.5)/(nr-1);
      for(let i=0;i<nr;i++) it.push({k:'beam',x:M(i*rg),y:0,w:M(1.5),h:Dm});
      const yb=D-ov, bw=b.plies*1.5;
      it.push({k:'beam',x:0,y:0,w:Wm,h:M(1.5)},{k:'beam',x:0,y:M(yb-bw/2),w:Wm,h:M(bw)});
      xs.forEach(x=>it.push({k:'post',x:M(x-2.75),y:M(yb-2.75),w:M(5.5),h:M(5.5)}));
      const zb=M(H)+M(bd), tn=slope/12, zr=y=>zb+M(tn*(yb-y)), sv=M(zd);
      const top=zr(0)+sv;
      const side={w:Dm,x0:-.22,zTop:top+.25,right:M(H),left:top,wallLabel:true,unit:'ftin',items:[
        {k:'wall',x:-.22,z:0,w:.22,h:top+.25},
        {k:'post',x:M(yb-2.75),z:0,w:M(5.5),h:M(H)},
        {k:'beam',x:M(yb-bw/2),z:M(H),w:M(bw),h:M(bd)},
        {k:'beam',x:0,z:zr(0),w:M(1.5),h:sv},
        {k:'beam',pts:[[0,zr(0)],[Dm,zr(D)],[Dm,zr(D)+sv],[0,zr(0)+sv]]}]};
      const model=()=>{const P=[], bwm=M(bw), dk=.75, bw4=M(3.5);
        P.push({n:'House wall',c:'wall',env:1,box:[-.4,-.3,0,Wm+.4,0,top+.5]});
        xs.forEach((x,i)=>{const cx=M(x), pp=M(5.5);
          P.push({n:'Posts',c:'post',box:[cx-pp/2,M(yb)-pp/2,0,cx+pp/2,M(yb)+pp/2,M(H)]});
          const d=Math.min(dk/Math.SQRT2,(M(b.ps)-pp)*.35);
          if(i<xs.length-1) P.push({n:'Knee braces',c:'brace',prism:{plane:'xz',pts:brace(cx+pp/2,M(H),d,bw4,1),at:M(yb)-bw4/2,t:bw4}});
          if(i>0) P.push({n:'Knee braces',c:'brace',prism:{plane:'xz',pts:brace(cx-pp/2,M(H),d,bw4,-1),at:M(yb)-bw4/2,t:bw4}});});
        P.push({n:'Front beam',c:'purlin',box:[0,M(yb)-bwm/2,M(H),Wm,M(yb)+bwm/2,M(H)+M(bd)]});
        P.push({n:'Ledger board',c:'plate',box:[0,0,zr(0),Wm,M(1.5),zr(0)+sv]});
        const rp=[[0,zr(0)],[Dm,zr(D)],[Dm,zr(D)+sv],[0,zr(0)+sv]];
        for(let i=0;i<nr;i++) P.push({n:'Rafters',c:'rafter',prism:{plane:'yz',pts:rp,at:M(i*rg),t:M(1.5)}});
        if(roof) P.push({n:'Roof panels (not in the list)',c:'glass',hull:1,prism:{plane:'yz',pts:[[0,zr(0)+sv],[Dm,zr(D)+sv],[Dm,zr(D)+sv+.02],[0,zr(0)+sv+.02]],at:0,t:Wm}});
        return {parts:P,hull:roof?'Show roof panels':undefined,person:[M(b.ob+b.ps/2),Math.max(.6,Dm*.3)]};};
      return {parts,hws,extras,
        summary:[[`${num(v.W*v.D)} sq ft`,'Covered area'],[z,'Rafters'],[b.key.replace('-','-ply '),'Front beam'],[String(b.n),'Posts']],
        notes:[`${nr} rafters (${z}) at ${s} in. on center from the ledger to the front beam (span ${ftin(span)}, ${ftin(ov)} overhang)${roof?', sloped 1/2 in. per foot':''}.`,
          `Front beam ${b.key.replace('-','-ply ')} on ${b.n} posts (6x6) ${ftin(b.ps)} apart, with knee braces.`,
          'Members are sized with the IRC deck span tables (40 psf live load). That is conservative for a roof in areas without heavy snow. In snow country or for a roof tied into the house roof, have the design checked.',
          roof?'Roof panels are only estimated. The ledger must be flashed and bolted into the house rim joist or studs, never into siding or brick veneer alone.':'Open rafters give shade like a pergola. Add 2x2 or 2x4 purlins across the top for more shade.',
          'Most building departments require a permit for an attached patio cover.'],
        plan:{w:Wm,h:Dm,items:it,top:-.12,unit:'ftin',title:'Plan'},side,model};
    }
  },
  carport:{
    label:'carport',
    fields:[
      {id:'L',label:'Length (front to back)',unit:'ft',min:12,max:40,step:.5,value:20},
      {id:'W',label:'Width',unit:'ft',min:9,max:24,step:.5,value:12},
      {id:'H',label:'Clear height under the beams',unit:'ft',min:7,max:12,step:.25,value:8},
      {id:'A',label:'Max. post spacing',unit:'ft',min:6,max:16,step:.5,value:10},
      {id:'F',label:'Footing depth (frost line)',unit:'in',min:12,max:72,step:1,value:36}
    ],
    option2:'West Coast framing lumber (Douglas fir or hem-fir)',
    calc(v,_o,west){
      const sp=west?'df':'sp', L=v.L*12, W=v.W*12, H=v.H*12, ov=12;
      let lines=2, span, s, z;
      for(lines=2;lines<=3;lines++){span=(W-2*ov)/(lines-1); s=24; z=joistFor(sp,span,24); if(!z){s=16;z=joistFor(sp,span,16);} if(z) break;}
      if(!z){lines=3; span=(W-2*ov)/2; s=12; z=joistFor(sp,span,12)||'2x12';}
      const zd=SIZE[z][1], nr=Math.ceil(L/s-1e-9)+1;
      const post=(rate('pt','6x6')||3.8)*H/12+(ITEM.postBase6||28)+(ITEM.postCap6||22)+bagsFor(12,v.F,.6)*(ITEM.concrete80||6.5);
      const lj=Math.min(18,Math.max(6,(span/2+ov)*2/12));
      const b=beamLine(sp,L,lj,post,v.A*12)||beamLine(sp,L,lj,post);
      const mid=lines===3?(beamLine(sp,L,Math.min(18,Math.max(6,span*2/12)),post,v.A*12)||beamLine(sp,L,Math.min(18,span*2/12),post)):null;
      const bd=SIZE[b.size][1], xs=postXs(L,b), nk=4*(b.n-1), bw=b.plies*1.5, np=2*b.n+(mid?mid.n:0);
      const parts=[part(mid?'Side posts':'Posts','6x6','pt',H,2*b.n),part(`Side beams (${b.key.replace('-','-ply ')})`,b.size,'pt',L,2*b.plies)];
      if(mid) parts.push(part('Center posts','6x6','pt',H+bd-SIZE[mid.size][1],mid.n));
      if(mid) parts.push(part(`Center beam (${mid.key.replace('-','-ply ')})`,mid.size,'pt',L,mid.plies));
      parts.push(part('Rafters',z,'pt',W,nr),part('Knee braces','4x4','pt',36,nk));
      const hws=[hw('Hurricane ties',nr*lines,ITEM.hurricaneTie||1.2),hw('Post bases and post caps',np,(ITEM.postBase6||28)+(ITEM.postCap6||22)),
        hw(`Concrete for footings (80 lb bags, 12" dia. × ${v.F}" deep)`,bagsFor(12,v.F,.6)*np,ITEM.concrete80||6.5),
        hw('Structural screws and bolts',nk*4+np*2,1.2)];
      const Lm=M(L), Wm=M(W), it=[{k:'outline',x:0,y:0,w:Lm,h:Wm}], rg=(L-1.5)/(nr-1);
      for(let i=0;i<nr;i++) it.push({k:'beam',x:M(i*rg),y:0,w:M(1.5),h:Wm});
      const BL=[[ov,b,xs],[W-ov,b,xs]]; if(mid) BL.push([W/2,mid,postXs(L,mid)]);
      BL.forEach(([y,bb])=>{const w2=bb.plies*1.5; it.push({k:'beam',x:0,y:M(y-w2/2),w:Lm,h:M(w2)});});
      BL.forEach(([y,,px])=>px.forEach(x=>it.push({k:'post',x:M(x-2.75),y:M(y-2.75),w:M(5.5),h:M(5.5)})));
      const zP=M(H+bd), pp=M(5.5), b4=M(3.5), dk=.75;
      const side=(()=>{const s2=[], sg=M(rg), d=Math.min(dk/Math.SQRT2,(M(b.ps)-pp)*.35);
        xs.forEach((x,i)=>{const cx=M(x);
          if(i<xs.length-1) s2.push({k:'beam',pts:brace(cx+pp/2,M(H),d,b4,1)});
          if(i>0) s2.push({k:'beam',pts:brace(cx-pp/2,M(H),d,b4,-1)});
          s2.push({k:'post',x:cx-pp/2,z:0,w:pp,h:M(H)});});
        s2.push({k:'beam',x:0,z:M(H),w:Lm,h:M(bd)});
        for(let i=0;i<nr;i++) s2.push({k:'beam',x:i*sg,z:zP,w:M(1.5),h:M(zd)});
        return {w:Lm,zTop:zP+M(zd),items:s2,right:M(H),unit:'ftin'};})();
      const model=()=>{const P=[], d=Math.min(dk/Math.SQRT2,(M(b.ps)-pp)*.35), bwm=M(bw);
        BL.forEach(([yy,bb,px])=>{const y=M(yy), bwm=M(bb.plies*1.5), bdm=M(SIZE[bb.size][1]), d=Math.min(dk/Math.SQRT2,(M(bb.ps)-pp)*.35);
          px.forEach((x,i)=>{const cx=M(x);
            P.push({n:'Posts',c:'post',box:[cx-pp/2,y-pp/2,0,cx+pp/2,y+pp/2,zP-bdm]});
            if(i<px.length-1&&bb===b) P.push({n:'Knee braces',c:'brace',prism:{plane:'xz',pts:brace(cx+pp/2,M(H),d,b4,1),at:y-b4/2,t:b4}});
            if(i>0&&bb===b) P.push({n:'Knee braces',c:'brace',prism:{plane:'xz',pts:brace(cx-pp/2,M(H),d,b4,-1),at:y-b4/2,t:b4}});});
          P.push({n:'Beams',c:'purlin',box:[0,y-bwm/2,zP-bdm,Lm,y+bwm/2,zP]});});
        for(let i=0;i<nr;i++) P.push({n:'Rafters',c:'rafter',box:[M(i*rg),0,zP,M(i*rg+1.5),Wm,zP+M(zd)]});
        P.push({n:'Roofing (not in the list)',c:'roof',hull:1,box:[0,0,zP+M(zd),Lm,Wm,zP+M(zd)+.02]});
        return {parts:P,hull:'Show roofing',person:[Lm/2,Wm/2],front:'x'};};
      return {parts,hws,
        summary:[[`${num(v.L*v.W)} sq ft`,'Roof area'],[z,'Rafters'],[b.key.replace('-','-ply '),'Beams'],[String(np),'Posts']],
        notes:[`${np} posts (6x6), ${b.n} per side, ${ftin(b.ps)} apart. Beams ${b.key.replace('-','-ply ')} on each side.`+(mid?` A center beam (${mid.key.replace('-','-ply ')} on ${mid.n} posts) halves the rafter span.`:''),
          `${nr} rafters (${z}) at ${s} in. on center, spanning ${ftin(span)} between the beams with ${ftin(ov)} overhang on each side.`,
          L>240?'Beam plies longer than 20 ft are spliced over a post. Stagger the joints of the plies.':'',
          'Members are sized with the IRC deck span tables (40 psf live load), which is conservative for a flat roof in areas without heavy snow. In snow country, or if the carport needs a permit, have the design checked by your building department or an engineer.',
          'Roofing (metal panels or shingles on sheathing), gutters and the concrete slab are not included.'].filter(Boolean),
        plan:{w:Lm,h:Wm,items:it,unit:'ftin',title:'Plan'},side,model};
    }
  },
  raisedbed:{
    label:'raised bed',
    fields:[
      {id:'L',label:'Length',unit:'ft',min:2,max:16,step:.5,value:8},
      {id:'W',label:'Width',unit:'ft',min:2,max:6,step:.5,value:4},
      {id:'H',label:'Height',unit:'in',min:5,max:36,step:.5,value:16},
      {id:'B',label:'Side boards',type:'select',options:[['2x6','2x6 (5-1/2" wide)'],['2x8','2x8 (7-1/4" wide)'],['2x10','2x10 (9-1/4" wide)'],['2x12','2x12 (11-1/4" wide)']],value:'2x6'}
    ],
    mats:['cedar','pt','df'], matLabel:'Lumber',
    calc(v,_a,_b,mat){
      const bs=v.B, bw=SIZE[bs][1], L=v.L*12, W=v.W*12, rows=Math.ceil(v.H/bw-1e-9), Ha=rows*bw;
      const mid=L>72?Math.ceil(L/48)-1:0;
      const parts=[part('Long side boards',bs,mat,L,rows*2),part('End boards',bs,mat,W-3,rows*2),part('Corner posts','4x4',mat,Ha,4)];
      if(mid) parts.push(part('Middle posts','4x4',mat,Ha,mid*2),part('Cross ties','2x4',mat,W-3-7,mid));
      const inner=(L-3)*(W-3)*Ha/1728;
      const hws=[hw('3" exterior screws',rows*4*2*3+mid*rows*2*3+mid*4,.08)];
      const Lm=M(L), Wm=M(W), t=M(1.5), p=M(3.5), it=[{k:'outline',x:0,y:0,w:Lm,h:Wm},
        {k:'board',x:0,y:0,w:Lm,h:t},{k:'board',x:0,y:Wm-t,w:Lm,h:t},{k:'board',x:0,y:t,w:t,h:Wm-2*t},{k:'board',x:Lm-t,y:t,w:t,h:Wm-2*t}];
      [[t,t],[Lm-t-p,t],[t,Wm-t-p],[Lm-t-p,Wm-t-p]].forEach(([x,y])=>it.push({k:'post',x,y,w:p,h:p}));
      for(let i=1;i<=mid;i++){const x=i*Lm/(mid+1)-p/2;
        it.push({k:'post',x,y:t,w:p,h:p},{k:'post',x,y:Wm-t-p,w:p,h:p},{k:'hidden',x:x+p/2-M(.75),y:t+p,w:M(1.5),h:Wm-2*t-2*p});}
      const s2=[], b=M(bw);
      for(let r=0;r<rows;r++) s2.push({k:'board',x:0,z:r*b,w:Lm,h:b});
      const xs=[t,Lm-t-p]; for(let i=1;i<=mid;i++) xs.push(i*Lm/(mid+1)-p/2);
      xs.forEach(x=>s2.push({k:'hidden',x,z:0,w:p,h:M(Ha)}));
      return {parts,hws,
        summary:[[`${num(inner,1)} cu ft`,'Soil to fill'],[`${num(inner/27,2)} cu yd`,'Bulk soil'],[String(Math.ceil(inner/1.5-1e-9)),'Bags of 1.5 cu ft'],[inch(Ha),'Finished height']],
        notes:[`${rows} rows of ${bs} boards give a height of ${inch(Ha)}. Long sides run full length, the end boards fit between them.`,
          mid?`${mid} pair${mid>1?'s':''} of middle posts with a cross tie stop the long sides from bowing out.`:'Under 6 ft long the bed needs no middle posts.',
          `To fill it you need about ${num(inner,1)} cu ft of soil (${num(inner/27,2)} cubic yards). Above about 1 cubic yard, bulk soil delivered by the yard is usually cheaper than bags. Filling the bottom third with logs, branches and leaves cuts the amount.`,
          mat==='pt'?'Treated lumber for homes has not used arsenic (CCA) since 2004. If you still prefer, line the inside walls with plastic sheeting.':mat==='cedar'?'Cedar resists rot without treatment and lasts about 10 to 15 years in a raised bed.':'Untreated Douglas fir is cheap but lasts only a few seasons in contact with wet soil.',
          'Hardware cloth against gophers and voles, liner and soil are not included in the cost.'],
        plan:{w:Lm,h:Wm,items:it,unit:'ftin'},side:{w:Lm,zTop:M(Ha),items:s2,unit:'ftin'}};
    }
  },
  table:{
    label:'table', postLabel:'Legs',
    fields:[
      {id:'L',label:'Length',unit:'in',min:36,max:120,step:1,value:72},
      {id:'W',label:'Width',unit:'in',min:24,max:48,step:.5,value:38},
      {id:'H',label:'Height',unit:'in',min:18,max:42,step:.5,value:30},
      {id:'T',label:'Tabletop boards',type:'select',options:[['2x6','2x6 (5-1/2" wide)'],['2x8','2x8 (7-1/4" wide)'],['2x10','2x10 (9-1/4" wide)']],value:'2x6'}
    ],
    mats:['spf','df','cedar'], matLabel:'Lumber',
    calc(v,_a,_b,mat){
      const tw=SIZE[v.T][1], n=Math.max(2,Math.round(v.W/tw)), bA=n*tw, inset=3, leg=3.5, nq=Math.max(2,Math.ceil(v.L/24));
      const al=v.L-2*inset-2*leg, ak=bA-2*inset-2*leg;
      const parts=[part('Tabletop boards',v.T,mat,v.L,n),part('Legs','4x4',mat,v.H-1.5,4),
        part('Long aprons','2x4',mat,al,2),part('Short aprons','2x4',mat,ak,2),part('Cleats under the top','2x4',mat,bA-2,nq)];
      const hws=[hw('Pocket screws, wood glue and tabletop fasteners',1,20+nq*2,true)];
      const Lm=M(v.L), Bm=M(bA), it=[];
      for(let i=0;i<n;i++) it.push({k:'board',x:0,y:M(i*tw),w:Lm,h:M(tw)});
      const im=M(inset), lm=M(leg);
      [[im,im],[Lm-im-lm,im],[im,Bm-im-lm],[Lm-im-lm,Bm-im-lm]].forEach(([x,y])=>it.push({k:'hidden',x,y,w:lm,h:lm}));
      it.push({k:'hidden',x:im+lm,y:im,w:M(al),h:M(1.5)},{k:'hidden',x:im+lm,y:Bm-im-M(1.5),w:M(al),h:M(1.5)});
      const zu=M(v.H-1.5);
      return {parts,hws,
        summary:[[`${num(v.L)} × ${inch(bA)}`,'Tabletop'],[String(n),'Top boards'],[String(Math.floor(v.L/24)*2+(bA>=36?2:0)),'Seats (about 24 in. each)']],
        notes:[`${n} boards (${v.T}) give a tabletop ${inch(bA)} wide. Edges of construction lumber are rounded, so joint them square on a table saw or jointer if you want tight seams.`,
          `4x4 legs set ${inch(inset)} in from the edges, 2x4 aprons on edge and ${nq} cleats under the top.`,
          'Dry the lumber indoors for one to two weeks before you build, otherwise the top cups and the seams open.',
          'Stain, finish and sandpaper are not included.'],
        plan:{w:Lm,h:Bm,items:it,unit:'ftin'},
        side:{w:Lm,zTop:M(v.H),unit:'ftin',items:[
          {k:'board',x:0,z:zu,w:Lm,h:M(1.5)},{k:'beam',x:im+lm,z:zu-M(3.5),w:M(al),h:M(3.5)},
          {k:'post',x:im,z:0,w:lm,h:zu},{k:'post',x:Lm-im-lm,z:0,w:lm,h:zu}]}};
    }
  },
  palletbed:{
    label:'pallet bed', postLabel:'Stringers', mattress:true, copyLabel:'Copy material list', round:1,
    fields:[
      {id:'MS',label:'Mattress size',type:'select',options:[['38x75','Twin (38 × 75 in.)'],['38x80','Twin XL (38 × 80 in.)'],['54x75','Full (54 × 75 in.)'],['60x80','Queen (60 × 80 in.)'],['76x80','King (76 × 80 in.)'],['72x84','California King (72 × 84 in.)']],value:'60x80'},
      {id:'LG',label:'Layers of pallets',unit:'',min:1,max:3,step:1,value:2},
      {id:'RD',label:'Border around the mattress (min.)',unit:'in',min:0,max:16,step:1,value:0},
      {id:'PP',label:'Price per pallet',unit:'$',min:0,max:40,step:1,value:8}
    ],
    option:'Headboard from upright pallets',
    calc(v,kopf){
      const [MW,ML]=v.MS.split('x').map(Number), r=v.RD, PH=4.75, lag=Math.round(v.LG);
      const opts=[[40,48,'40 in. side across the bed'],[48,40,'48 in. side across the bed']].map(([pw,pl,t])=>{const nW=Math.ceil((MW+2*r)/pw-1e-9), nL=Math.ceil((ML+2*r)/pl-1e-9);
        return {pw,pl,t,nW,nL,n:nW*nL,area:nW*pw*nL*pl};});
      const o=opts.sort((a,b)=>a.n-b.n||a.area-b.area)[0];
      const FW=o.nW*o.pw, FL=o.nL*o.pl, per=o.n, nk=kopf?Math.ceil(FW/48-1e-9):0, total=per*lag+nk;
      const H=lag*PH, sw=(FW-MW)/2, sk=r, sf=FL-ML-r;
      const joints=(o.nW-1)*o.nL+o.nW*(o.nL-1);
      const hwc=joints*lag*2*.6+(lag-1)*per*4*.25+per*4*.3+nk*2*1.5+6;
      const extras=[{label:`Pallets (${total} × $${v.PP})`,cost:total*v.PP,est:false},{label:`Sandpaper and finish for ${total} pallets`,cost:8+total*2.5,est:true}];
      const Mx=M, it=[];
      /* GMA pallet: 3 stringers along the 48 in. side, 7 top deck boards (3-1/2 in.) along the 40 in. side */
      const DBp=[]; for(let i=0;i<7;i++) DBp.push(i*(48-3.5)/6);
      for(let i=0;i<o.nW;i++) for(let j=0;j<o.nL;j++){const x0=i*o.pw, y0=j*o.pl;
        DBp.forEach(a=>it.push(o.pw===48?{k:'board',x:Mx(x0+a),y:Mx(y0),w:Mx(3.5),h:Mx(40)}:{k:'board',x:Mx(x0),y:Mx(y0+a),w:Mx(40),h:Mx(3.5)}));}
      it.push({k:'mattress',x:Mx(sw),y:Mx(sk),w:Mx(MW),h:Mx(ML)});
      if(kopf) for(let i=0;i<nk;i++) it.push({k:'beam',x:Mx(i*48),y:-Mx(PH),w:Mx(48),h:Mx(PH)});
      const s2=[];
      for(let k=0;k<lag;k++){const z=k*PH;
        for(let j=0;j<o.nL;j++){const x=j*o.pl;
          s2.push({k:'board',x:Mx(x+.25),z:Mx(z),w:Mx(o.pl-.5),h:Mx(.625)});
          if(o.pl===48) s2.push({k:'post',x:Mx(x+.25),z:Mx(z+.625),w:Mx(47.5),h:Mx(3.5)});
          else [0,18.25,36.5].forEach(b=>s2.push({k:'post',x:Mx(x+b),z:Mx(z+.625),w:Mx(3.5),h:Mx(3.5)}));
          s2.push({k:'board',x:Mx(x+.25),z:Mx(z+4.125),w:Mx(o.pl-.5),h:Mx(.625)});}}
      s2.push({k:'mattress',x:Mx(sk),z:Mx(H),w:Mx(ML),h:Mx(10)});
      if(kopf) s2.push({k:'beam',x:-Mx(PH),z:0,w:Mx(PH),h:Mx(40)});
      return {parts:[],hws:[hw('Mending plates, screws, felt pads'+(kopf?', angle brackets':''),1,hwc)],extras,
        sub:`${total} standard 48 × 40 in. pallets plus finishing supplies.`,
        summary:[[String(total),'Pallets'],[`${FW} × ${FL} in.`,'Footprint'],[inch(H),'Height without mattress'],[`about ${total*40} lb`,'Weight']],
        notes:[`${per} pallets per layer (${o.nW} × ${o.nL}, ${o.t}), ${lag} ${lag===1?'layer':'layers'}${kopf?`, plus ${nk} upright pallets as a 40 in. headboard`:''}.`,
          sw<.1&&sf<.1&&sk<.1?'The pallets line up flush with the mattress.':'The mattress sits at the head end. Free border: '+[sw>=.1?`${inch(sw,2)} on each side`:'',sk>=.1?`${inch(sk,2)} at the head`:'',sf>=.1?`${inch(sf,2)} at the foot`:''].filter(Boolean).join(', ')+'. The ledge works as a nightstand.',
          `With a 10 in. mattress the sleeping surface is about ${inch(Math.round(H+10))} high. An LED strip around the base needs ${ftin(2*(FW+FL))}.`,
          'Use only pallets stamped HT (heat treated). Avoid pallets marked MB (methyl bromide), painted pallets and any that carried chemicals. Scrub, dry and sand them before they come indoors.'],
        plan:{w:Mx(FW),h:Mx(FL),top:kopf?-Mx(PH)-.02:0,items:it,unit:'ftin'},
        side:{w:Mx(FL),x0:kopf?-Mx(PH)-.03:0,dimW:Mx(FL),zTop:kopf?Mx(40):Mx(H+10),items:s2,right:Mx(H),unit:'ftin'}};
    }
  },
  crate:{
    label:'wine crate', postLabel:'End boards', round:1,
    fields:[
      {id:'L',label:'Length (outside)',unit:'in',min:8,max:40,step:.25,value:20},
      {id:'B',label:'Width (outside)',unit:'in',min:6,max:24,step:.25,value:13.5},
      {id:'H',label:'Height (outside)',unit:'in',min:3,max:18,step:.25,value:7},
      {id:'N',label:'Number of crates',unit:'',min:1,max:20,step:1,value:1}
    ],
    mats:['pine','spf'], matLabel:'Boards',
    option:'Divider in the middle',
    calc(v,trenn,_b,mat){
      const L=v.L, B=v.B, H=v.H, N=Math.round(v.N), ts=.75, tl=.5, tb=.5, hk=H-tb, bw=3.5;
      const rows=Math.ceil(hk/bw-1e-9), ws=hk/rows, nb=Math.ceil(B/bw-1e-9), wb=B/nb;
      const ends=['1x4','1x6','1x8','1x10','1x12'], two=hk>11.25, es=ends.find(e=>SIZE[e][1]>=(two?hk/2:hk)-1e-6)||'1x12';
      const parts=[part('End boards',es,mat,B-2*tl,2*N*(two?2:1)),part('Side slats','1/2x4',mat,L,2*rows*N),part('Bottom slats','1/2x4',mat,L,nb*N)];
      if(trenn) parts.push(part('Divider',es,mat,B-2*tl,N*(two?2:1)));
      const Li=L-2*ts, Bi=B-2*tl, Hi=hk, griff=hk>=4, gw=Math.min(4,Bi*.45), gz=H-1.25;
      const fl=Bi>=12&&Hi>=3.25?Math.floor((Li-(trenn?.75:0))/3.05):0;
      const Lm=M(L), Bm=M(B), Hm=M(H), tsm=M(ts), tlm=M(tl), tbm=M(tb), hkm=M(hk), wsm=M(ws), wbm=M(wb);
      const it=[{k:'outline',x:0,y:0,w:Lm,h:Bm},{k:'board',x:0,y:0,w:Lm,h:tlm},{k:'board',x:0,y:Bm-tlm,w:Lm,h:tlm},
        {k:'post',x:0,y:tlm,w:tsm,h:Bm-2*tlm},{k:'post',x:Lm-tsm,y:tlm,w:tsm,h:Bm-2*tlm}];
      if(trenn) it.push({k:'board',x:Lm/2-tsm/2,y:tlm,w:tsm,h:Bm-2*tlm});
      const s2=[{k:'board',x:0,z:0,w:Lm,h:tbm}];
      for(let r=0;r<rows;r++) s2.push({k:'board',x:0,z:tbm+r*wsm,w:Lm,h:wsm});
      s2.push({k:'hidden',x:0,z:tbm,w:tsm,h:hkm},{k:'hidden',x:Lm-tsm,z:tbm,w:tsm,h:hkm});
      if(trenn) s2.push({k:'hidden',x:Lm/2-tsm/2,z:tbm,w:tsm,h:hkm});
      return {parts,hws:[hw('Brad nails and wood glue',1,N*1.5+3,true)],
        summary:[[`${frac(L)} × ${frac(B)} × ${frac(H)} in.`,'Outside'],[`${inch(Li)} × ${inch(Bi)} × ${inch(Hi)}`,'Inside'],[String(fl||'–'),'Bottles lying down']],
        notes:[`Per crate ${rows} side slats on each long side and ${nb} bottom slats from 1/2 in. × 3-1/2 in. boards, plus two ${es} end boards.${ws<bw-.01||wb<bw-.01?` Rip the slats to ${inch(ws,16)} (sides) and ${inch(wb,16)} (bottom) so they fill evenly.`:''}`,
          two?`The end boards are ${inch(hk)} tall, more than a 1x12. Edge-glue two ${es} boards per end or use a glued-up panel.`:`Cut the end boards from ${es} stock to ${inch(hk)} tall.`,
          griff?`Handles: cut a slot about ${inch(Math.round(gw*2)/2)} × 1-1/4 in. in each end board, 1-1/4 in. below the top. Drill two holes and connect them with a jigsaw.`:'The crate is too low for hand holes.',
          fl?`Holds about ${fl} wine bottles lying down in one layer (3 in. diameter, 12 in. long).`:'Too narrow for bottles lying down. It still works as a display or planter box.',
          'For the vintage look, ease the edges, darken with stain or a torch and stencil a label. Stain, paint and liner are not included.'],
        plan:{w:Lm,h:Bm,items:it,unit:'in',maxH:170},
        side:{title:'Long side',w:Lm,zTop:Hm,items:s2,unit:'in'},
        model:()=>{const P=[];
          for(let i=0;i<nb;i++){const y0=i*wbm; P.push({n:'Bottom slats',c:'board',box:[0,y0,0,Lm,y0+wbm-.002,tbm]});}
          [0,Bm-tlm].forEach(y=>{for(let r=0;r<rows;r++){const z0=tbm+r*wsm; P.push({n:'Side slats',c:'board',box:[0,y,z0,Lm,y+tlm,z0+wsm-.002]});}});
          const hole=griff?[[[Bm/2-M(gw)/2,M(gz)-M(1.25)],[Bm/2+M(gw)/2,M(gz)-M(1.25)],[Bm/2+M(gw)/2,M(gz)],[Bm/2-M(gw)/2,M(gz)]]]:[];
          [0,Lm-tsm].forEach(x=>P.push({n:'End boards',c:'plate',prism:{plane:'yz',pts:[[tlm,tbm],[Bm-tlm,tbm],[Bm-tlm,Hm],[tlm,Hm]],holes:hole,at:x,t:tsm}}));
          if(trenn) P.push({n:'Divider',c:'osb',box:[Lm/2-tsm/2,tlm,tbm,Lm/2+tsm/2,Bm-tlm,Hm-.01]});
          return {parts:P,front:'x'};}};
    }
  }
};
function brace(xf,zt,d,bw,dir){const c=bw*Math.SQRT2; return [[xf,zt-d-c],[xf,zt-d],[xf+dir*d,zt],[xf+dir*(d+c),zt]];}

/* ---------- drawings ---------- */
function dim(m,u){const i=m/IN; return u==='in'?inch(Math.round(i*8)/8):ftin(i,4);}
function planSvg(plan,label){
  const padL=38,padT=30,padR=10,padB=10, top=plan.top||0, x0=plan.x0||0, x1=plan.x1||plan.w, bot=plan.bottom||plan.h;
  const s=Math.min(330/(x1-x0),(plan.maxH||190)/(bot-top));
  const W=(x1-x0)*s+padL+padR, H=(bot-top)*s+padT+padB, X=x=>padL+(x-x0)*s, Y=y=>padT+(y-top)*s;
  const st={beam:'fill="var(--timber-soft)" stroke="var(--timber)" stroke-width=".8"',post:'fill="var(--plan)"',
    hidden:'fill="none" stroke="var(--muted)" stroke-dasharray="3 2"',outline:'fill="none" stroke="var(--muted)" stroke-dasharray="4 3"',
    wall:'fill="var(--muted)"',mattress:'fill="var(--plan)" fill-opacity=".14" stroke="var(--plan)" stroke-width="1.5" stroke-dasharray="5 3"'};
  st.board=st.beam;
  let g='';
  for(const i of plan.items){
    if(i.pts){g+=`<polygon points="${i.pts.map(([x,y])=>X(x).toFixed(1)+','+Y(y).toFixed(1)).join(' ')}" ${st[i.k]} stroke-linejoin="round"/>`;continue;}
    g+=`<rect x="${X(i.x).toFixed(1)}" y="${Y(i.y).toFixed(1)}" width="${Math.max(i.w*s,1.2).toFixed(1)}" height="${Math.max(i.h*s,1.2).toFixed(1)}" ${st[i.k]}${i.k==='mattress'?' rx="3"':''}/>`;
  }
  const xa=X(0), xb=X(plan.w), ya=Y(0), yb=Y(plan.h), t='font-size="12" fill="var(--ink)" font-family="Barlow, system-ui, sans-serif"';
  g+=`<path d="M${xa} 14H${xb}M${xa} 9V19M${xb} 9V19M18 ${ya}V${yb}M13 ${ya}H23M13 ${yb}H23" stroke="var(--muted)"/>`;
  g+=`<text x="${(xa+xb)/2}" y="10" text-anchor="middle" ${t}>${dim(plan.w,plan.unit)}</text>`;
  g+=`<text x="12" y="${(ya+yb)/2}" text-anchor="middle" ${t} transform="rotate(-90 12 ${(ya+yb)/2})">${dim(plan.h,plan.unit)}</text>`;
  return `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" role="img" aria-label="${plan.title||'Plan view'} of the ${label}">${g}</svg>`;
}
function sideSvg(v,label){
  const x0=v.x0||0, x1=v.w, zt=v.zTop, r=n=>Math.round(n*10)/10, padL=38,padT=30,padB=14,padR=v.right?40:12;
  const s=Math.min(330/(x1-x0),190/zt), W=r((x1-x0)*s+padL+padR), H=r(zt*s+padT+padB), X=x=>r(padL+(x-x0)*s), Y=z=>r(padT+(zt-z)*s);
  const st={beam:'fill="var(--timber-soft)" stroke="var(--timber)" stroke-width=".8"',post:'fill="var(--plan)"',
    hidden:'fill="none" stroke="var(--muted)" stroke-dasharray="3 2"',wall:'fill="var(--rule)"',
    mattress:'fill="var(--plan)" fill-opacity=".14" stroke="var(--plan)" stroke-width="1.5" stroke-dasharray="5 3"'};
  st.board=st.beam;
  let g='';
  for(const i of v.items){
    if(i.pts) g+=`<polygon points="${i.pts.map(([x,z])=>X(x)+','+Y(z)).join(' ')}" ${st[i.k]} stroke-linejoin="round"/>`;
    else g+=`<rect x="${X(i.x)}" y="${Y(i.z+i.h)}" width="${r(Math.max(i.w*s,1.2))}" height="${r(Math.max(i.h*s,1.2))}" ${st[i.k]}/>`;
  }
  if(v.wallLabel){const wx=r(X(x0)+(X(0)-X(x0))/2+4), wy=r((Y(0)+Y(zt))/2);
    g+=`<text x="${wx}" y="${wy}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="Barlow, system-ui, sans-serif" transform="rotate(-90 ${wx} ${wy})">House</text>`;}
  const gx0=X(x0)-6, gx1=X(x1)+6, gy=Y(0);
  let hatch=''; for(let x=gx0+4;x<=gx1;x+=8) hatch+=`M${r(x)} ${gy}l-5 6`;
  g+=`<path d="M${r(gx0)} ${gy}H${r(gx1)}" stroke="var(--muted)" stroke-width="1.5"/><path d="${hatch}" stroke="var(--muted)" stroke-width=".7"/>`;
  const t='font-size="12" fill="var(--ink)" font-family="Barlow, system-ui, sans-serif"';
  const xa=X(0), xb=X(v.dimW||x1), zl=v.left||zt, ya=Y(zl);
  g+=`<path d="M${xa} 14H${xb}M${xa} 9V19M${xb} 9V19M18 ${ya}V${gy}M13 ${ya}H23M13 ${gy}H23" stroke="var(--muted)"/>`;
  g+=`<text x="${r((xa+xb)/2)}" y="10" text-anchor="middle" ${t}>${v.topLabel||dim(v.dimW||x1,v.unit)}</text>`;
  g+=`<text x="12" y="${r((ya+gy)/2)}" text-anchor="middle" ${t} transform="rotate(-90 12 ${r((ya+gy)/2)})">${dim(zl,v.unit)}</text>`;
  if(v.right){const xr=W-24, yr=Y(v.right), ym=r((yr+gy)/2);
    g+=`<path d="M${xr} ${yr}V${gy}M${xr-5} ${yr}H${xr+5}M${xr-5} ${gy}H${xr+5}" stroke="var(--muted)"/>`;
    g+=`<text x="${W-6}" y="${ym}" text-anchor="middle" ${t} transform="rotate(-90 ${W-6} ${ym})">${dim(v.right,v.unit)}</text>`;}
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Side view of the ${label}">${g}</svg>`;
}
function qsIcon(size){const [a,b]=SIZE[size]||[1,4], s=2.2, W=Math.max(a*s,3), H=Math.max(b*s,3);
  return `<svg width="${(W+2).toFixed(1)}" height="${(H+2).toFixed(1)}" aria-hidden="true"><rect x="1" y="1" width="${W.toFixed(1)}" height="${H.toFixed(1)}" fill="var(--timber-soft)" stroke="var(--timber)"/></svg>`;}

/* ---------- user interface ---------- */
function mount(root){
  const key=root.dataset.rechner, p=PROJECTS[key];
  if(!p) return;
  const mats=(p.mats||[]).filter(k=>MAT[k]), copyLabel=p.copyLabel||'Copy lumber list';
  const s={vals:Object.fromEntries(p.fields.map(f=>[f.id,f.value])),mat:mats[0],opt:false,opt2:false,level:100,spare:5};
  root.innerHTML=`
  <div class="tool">
    <section aria-label="Inputs">
      <h2>Enter your sizes</h2>
      <div class="fields"></div>
      <div class="plan"><h2 class="plan-title">Plan view</h2><div class="plan-svg"></div>
        <h2 class="side-title">Side view</h2><div class="side-svg"></div>
        <div class="legend">${p.postLabel===null?'':`<span><i class="sw" style="background:var(--plan)"></i>${p.postLabel||'Posts'}</span>`}<span><i class="sw" style="background:var(--timber-soft);border:1px solid var(--timber)"></i>${p.boardLabel||'Lumber'}</span><span><i class="sw" style="border:1px dashed var(--muted)"></i>Hidden or outline</span>${p.mattress?'<span><i class="sw" style="background:color-mix(in srgb,var(--plan) 14%,transparent);border:1.5px dashed var(--plan)"></i>Mattress</span>':''}</div>
      </div>
    </section>
    <section aria-label="Result" aria-live="polite">
      <h2>Cost estimate</h2>
      <div class="total"></div><p class="sub"></p><dl class="stats" hidden></dl>
      <div class="tablebox cutbox"><table>
        <caption>Cut list</caption>
        <thead><tr><th>Part</th><th>Lumber</th><th class="num">Length</th><th class="num">Qty</th></tr></thead>
        <tbody class="cuts"></tbody>
      </table></div>
      <div class="tablebox shopbox"><table>
        <caption>Shopping list</caption>
        <thead><tr><th>Buy</th><th class="num">Length</th><th class="num">Qty</th><th class="num">Cost</th></tr></thead>
        <tbody class="shop-lines"></tbody><tfoot><tr><td colspan="3">Lumber</td><td class="num lumber"></td></tr></tfoot>
      </table></div>
      <dl class="costlines"></dl>
      <ul class="notes"></ul>
      <div class="actions"><button class="btn copy" type="button">${copyLabel}</button><button class="btn ghost print" type="button">Print or save as PDF</button></div>
    </section>
  </div>`;
  const q=sel=>root.querySelector(sel), fields=q('.fields');
  function numField(id,label,unit,val,min,max,step,set,wide){
    const d=document.createElement('div'); d.className='field'+(wide?' wide':''); const fid=`${key}_${id}`;
    d.innerHTML=`<label for="${fid}">${label}</label><div class="inputbox"><input id="${fid}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${val}"><span class="unit">${unit}</span></div>`;
    const inp=d.querySelector('input');
    inp.addEventListener('input',()=>{const x=parseFloat(inp.value); if(!isNaN(x)){set(Math.min(max,Math.max(min,x)));update();}});
    inp.addEventListener('change',()=>{let x=parseFloat(inp.value); if(isNaN(x)) x=min; x=Math.min(max,Math.max(min,x)); inp.value=x; set(x); update();});
    return d;
  }
  function selField(id,label,options,val,set,wide){
    const d=document.createElement('div'); d.className='field'+(wide?' wide':''); const fid=`${key}_${id}`;
    d.innerHTML=`<label for="${fid}">${label}</label><div class="inputbox"><select id="${fid}">${options.map(([v,t])=>`<option value="${v}"${String(v)===String(val)?' selected':''}>${t}</option>`).join('')}</select></div>`;
    d.querySelector('select').addEventListener('change',e=>{const x=e.target.value; set(isNaN(+x)?x:+x); update();});
    return d;
  }
  p.fields.forEach(f=>fields.appendChild(f.type==='select'?selField(f.id,f.label,f.options,f.value,x=>s.vals[f.id]=x):
    numField(f.id,f.label,f.unit,s.vals[f.id],f.min,f.max,f.step,x=>s.vals[f.id]=x)));
  if(mats.length) fields.appendChild(selField('mat',p.matLabel||'Lumber',mats.map(k=>[k,matLabel(k)]),s.mat,x=>s.mat=x,true));
  fields.appendChild(numField('level','Price level','%',s.level,50,200,5,x=>s.level=x));
  fields.appendChild(numField('spare','Spare boards','%',s.spare,0,30,1,x=>s.spare=x));
  [['option','opt'],['option2','opt2']].forEach(([o,k])=>{ if(!p[o]) return;
    const c=document.createElement('label'); c.className='check'; c.innerHTML=`<input type="checkbox"> ${p[o]}`;
    c.querySelector('input').addEventListener('change',e=>{s[k]=e.target.checked;update();}); fields.appendChild(c);});

  let last, v3=null;
  function update(){
    const r=p.calc(s.vals,s.opt,s.opt2,s.mat), f=s.level/100, st=p.round||10, E=n=>usd(n,st);
    const lines=shopping(r.parts,s.spare); lines.forEach(l=>{l.each*=f; l.cost*=f;});
    const lumber=lines.reduce((a,x)=>a+x.cost,0), hws=r.hws||[], ex=r.extras||[];
    const hwSum=hws.reduce((a,x)=>a+x.cost,0)*f, exSum=ex.reduce((a,x)=>a+x.cost*(x.est===false?1:f),0), total=lumber+hwSum+exSum;
    q('.total').textContent=`${E(total*.85)} to ${E(total*1.15)}`;
    q('.sub').textContent=(r.sub||(lines.length?`${lines.reduce((a,x)=>a+x.n,0)} boards${mats.length?' of '+matLabel(s.mat).toLowerCase():''} plus hardware, ${s.spare} % spare boards included.`:''))+' The range of ±15 % covers regional price differences.';
    const sm=r.summary||[]; q('.stats').hidden=!sm.length;
    q('.stats').innerHTML=sm.map(([v,l])=>`<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');
    q('.cutbox').hidden=q('.shopbox').hidden=!r.parts.length;
    q('.cuts').innerHTML=r.parts.map(x=>`<tr><td class="name">${x.name}</td><td><span class="qs">${qsIcon(x.size)}${lbl(x.size)}${x.size==='composite'?'':(x.mat==='pt'?' PT':x.mat==='cedar'?' cedar':'')}</span></td><td class="num">${ftin(x.len)}</td><td class="num">${x.qty}</td></tr>`).join('');
    q('.shop-lines').innerHTML=lines.map(l=>`<tr><td class="name">${lbl(l.size)} ${matLabel(l.mat).toLowerCase()}</td><td class="num">${l.ft} ft</td><td class="num">${l.n}</td><td class="num">${l.each!=null?usd(l.cost,1):'–'}</td></tr>`).join('');
    q('.lumber').textContent=usd(lumber,1);
    q('.costlines').innerHTML=(lines.length?`<dt>Lumber (${s.level===100?'example prices':`price level ${s.level} %`})</dt><dd>${usd(lumber,1)}</dd>`:'')+
      ex.map(x=>`<dt>${x.label}${x.est===false?'':' (estimate)'}</dt><dd>${E(x.cost*(x.est===false?1:f))}</dd>`).join('')+
      hws.map(x=>`<dt>${x.label}${x.qty>1?`: ${num(x.qty)}`:''} (estimate)</dt><dd>${E(x.cost*f)}</dd>`).join('');
    q('.notes').innerHTML=r.notes.map(n=>`<li>${n}</li>`).join('');
    q('.plan-title').hidden=q('.plan-svg').hidden=!r.plan;
    if(r.plan) q('.plan-title').textContent=r.plan.title||'Plan view';
    q('.plan-svg').innerHTML=r.plan?planSvg(r.plan,p.label):'';
    const sti=q('.side-title'); sti.hidden=!r.side; sti.textContent=(r.side&&r.side.title)||'Side view'; sti.classList.toggle('first',!r.plan);
    q('.side-svg').innerHTML=r.side?sideSvg(r.side,p.label):'';
    last={r,lines,total};
    if(v3&&r.model) v3.update(r.model());
  }
  if(p.calc(s.vals,s.opt,s.opt2,s.mat).model){
    const box=document.createElement('section'); box.className='v3d'; box.setAttribute('aria-label','3D view');
    box.innerHTML='<h2>3D view</h2><div class="v3d-host"><div class="v3d-stage"><p class="v3d-msg">Loading the 3D view …</p></div></div>';
    q('.tool').appendChild(box);
    const fail=t=>{const m=box.querySelector('.v3d-msg'); if(m) m.textContent=t;};
    const load=()=>{let imp; try{imp=new Function('u','return import(u)');}catch(e){fail('Your browser cannot show the 3D view.');return;}
      imp(window.ANSICHT3D||'/assets/ansicht3d.us.js').then(m=>{v3=m.create(box.querySelector('.v3d-host'),{label:p.label}); if(last&&last.r.model) v3.update(last.r.model());})
        .catch(()=>fail('The 3D view could not be loaded. The plan and side view above show the sizes.'));};
    if('IntersectionObserver' in window){const io=new IntersectionObserver(e=>{if(e.some(x=>x.isIntersecting)){io.disconnect();load();}},{rootMargin:'300px'}); io.observe(box);} else load();
  }
  q('.copy').addEventListener('click',async e=>{
    const {r,lines,total}=last, btn=e.currentTarget, E=n=>usd(n,p.round||10);
    const text=[`Lumber list: ${p.label}`,...(r.summary||[]).map(([v,l])=>`${l}: ${v}`),'','Cut list:',
      ...r.parts.map(x=>`${x.qty} × ${x.name}, ${lbl(x.size)}, ${ftin(x.len)}`),'','Shopping list:',
      ...lines.map(l=>`${l.n} × ${lbl(l.size)} ${matLabel(l.mat).toLowerCase()}, ${l.ft} ft`),
      ...(r.hws||[]).map(x=>`${x.label}${x.qty>1?`: ${x.qty}`:''}`),
      `Cost estimate: ${E(total*.85)} to ${E(total*1.15)}`].join('\n');
    try{await navigator.clipboard.writeText(text);btn.textContent='Copied';}catch{btn.textContent='Copy not possible';}
    setTimeout(()=>btn.textContent=copyLabel,1800);
  });
  q('.print').addEventListener('click',()=>window.print());
  update();
}

if(typeof document!=='undefined') document.querySelectorAll('[data-rechner]').forEach(mount);
if(typeof module!=='undefined') module.exports={PROJECTS,shopping,ftin,deckCore,beamSpan,joistFor};
})();
