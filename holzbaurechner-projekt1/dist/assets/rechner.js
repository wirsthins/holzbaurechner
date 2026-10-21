/* Holzbaurechner – Rechner-Engine. Jede Seite bindet ihn über <div data-rechner="carport"></div> ein. */
(function(){
const PREISE=((typeof window!=="undefined"&&window.HOLZPREISE)||{}).hoelzer||{};
const fmt=(n,d=2)=>n.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const cm=n=>fmt(n,1).replace(',0','');
const eur=(n,st=10)=>(Math.round(n/st)*st).toLocaleString('de-DE')+' €';
const pick=(t,v)=>{for(const [m,d] of t) if(v<=m) return d; return t[t.length-1][1];};
const piece=(name,b,h,len,qty)=>({name,b,h,len,qty,vol:b/100*h/100*len*qty});
const DEG=Math.PI/180;
/* Bauteil mit unterschiedlichen Längen (z. B. Äste eines Latten-Baums): lens = Einzellängen in m */
const pieceVar=(name,b,h,lens)=>{const sum=lens.reduce((a,x)=>a+x,0), mx=Math.max(...lens), mn=Math.min(...lens);
  return {name,b,h,len:sum/lens.length,qty:lens.length,vol:b/100*h/100*sum,lens,
    lenLabel:Math.abs(mx-mn)<.005?null:`${fmt(mn)} bis ${fmt(mx)} m`};};
/* Plattenware und Zubehör, das nicht nach m³ gerechnet wird */
const extra=(label,menge,cost)=>({label,menge,cost});
const PLATTE={b:2.5,h:1.25};
const platten=(m2)=>Math.ceil(m2*1.1/(PLATTE.b*PLATTE.h)-1e-9);
/* Wie viele Handelslängen braucht man für alle Zuschnitte? (einfaches Packen, 5 mm Sägeschnitt) */
function stangen(lens){
  const pack=L=>{const bins=[];
    [...lens].sort((a,b)=>b-a).forEach(l=>{const i=bins.findIndex(r=>r>=l+.005); if(i>=0) bins[i]-=l+.005; else bins.push(L-l-.005);});
    return {n:bins.length,L};};
  const mx=Math.max(...lens), cand=[2,2.5,3].filter(x=>x>=mx+.01);
  if(!cand.length) return pack([4,5,6].find(x=>x>=mx+.01)||Math.ceil(mx+.01));
  return cand.map(pack).sort((a,b)=>a.n*a.L-b.n*b.L||a.L-b.L)[0];
}
/* Rechteck entlang einer Strecke (für schräge Latten in Ansichten) */
function strip(x1,y1,x2,y2,w){const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy),nx=-dy/l*w/2,ny=dx/l*w/2;
  return [[x1+nx,y1+ny],[x2+nx,y2+ny],[x2-nx,y2-ny],[x1-nx,y1-ny]];}

/* Richtwert-Tabellen [max. Spannweite in m, [Breite, Höhe] in cm]. Fachlich prüfen lassen! */
const T_PFETTE=[[2.5,[12,16]],[3.2,[12,20]],[4,[12,24]],[99,[14,28]]];
const T_SPARREN=[[2.4,[8,16]],[3,[8,18]],[3.6,[8,20]],[4.4,[8,24]],[99,[10,24]]];

const PROJECTS={
  carport:{
    label:'Carport',
    fields:[
      {id:'L',label:'Dachlänge',unit:'m',min:3,max:10,step:.1,value:5.6},
      {id:'B',label:'Dachbreite',unit:'m',min:2.5,max:6.5,step:.1,value:3.4},
      {id:'H',label:'Pfostenhöhe',unit:'m',min:2,max:3,step:.05,value:2.3},
      {id:'A',label:'Pfostenabstand max.',unit:'m',min:1.5,max:4,step:.1,value:2.5}
    ],
    woods:['kvh','bsh','laerche','douglasie'], option:'Hohe Schneelast (Alpenraum, höhere Lagen)',
    calc(v,snow){
      const f=snow?1.25:1, o=.3;
      const inner=v.L-2*o, n=Math.ceil(inner/v.A-1e-9)+1, a=inner/(n-1), span=v.B-2*o;
      const post=snow?[14,14]:[12,12];
      const pf=pick(T_PFETTE,a*f), sp=pick(T_SPARREN,span*f);
      const ns=Math.ceil(v.L/.7)+1, nk=4*(n-1);
      const pieces=[
        piece('Pfosten',post[0],post[1],v.H,2*n),
        piece('Pfetten',pf[0],pf[1],v.L,2),
        piece('Sparren',sp[0],sp[1],v.B,ns),
        piece('Kopfbänder',10,10,.9,nk)
      ];
      const sGap=(v.L-sp[0]/100)/(ns-1);
      const it=[{k:'outline',x:0,y:0,w:v.L,h:v.B}];
      for(let i=0;i<ns;i++) it.push({k:'beam',x:i*sGap,y:0,w:sp[0]/100,h:v.B});
      const pw=pf[0]/100, pp=post[0]/100;
      it.push({k:'beam',x:0,y:o-pw/2,w:v.L,h:pw},{k:'beam',x:0,y:v.B-o-pw/2,w:v.L,h:pw});
      for(let i=0;i<n;i++){const x=o+i*a-pp/2; it.push({k:'post',x,y:o-pp/2,w:pp,h:pp},{k:'post',x,y:v.B-o-pp/2,w:pp,h:pp});}
      return {pieces,hw:2*n*30+ns*2*5+nk*3+60,hwLabel:'H-Anker, Sparrenpfettenanker, Schrauben',
        notes:[`${2*n} Pfosten mit ${fmt(a)} m Achsabstand, ${ns} Sparren mit rund ${Math.round(sGap*100)} cm Abstand.`,
          snow?'Querschnitte für hohe Schneelast eine Stufe stärker gewählt.':'Im Alpenraum und in höheren Lagen die Option für hohe Schneelast aktivieren.',
          'Dacheindeckung, Fundamente und Regenrinne sind nicht enthalten.'],
        plan:{w:v.L,h:v.B,items:it},
        side:(()=>{
          const pfh=pf[1]/100, sw=sp[0]/100, sh=sp[1]/100, zP=v.H+pfh, bw=.1, d=Math.min(.9/Math.SQRT2-bw*Math.SQRT2,(a-pp)*.35);
          const s2=[];
          for(let i=0;i<n;i++){const cx=o+i*a;
            if(i<n-1) s2.push(kopfband(cx+pp/2,v.H,d,bw,1));
            if(i>0) s2.push(kopfband(cx-pp/2,v.H,d,bw,-1));
            s2.push({k:'post',x:cx-pp/2,z:0,w:pp,h:v.H});}
          s2.push({k:'beam',x:0,z:v.H,w:v.L,h:pfh});
          for(let i=0;i<ns;i++) s2.push({k:'beam',x:i*sGap,z:zP,w:sw,h:sh});
          return {w:v.L,zTop:zP+sh,items:s2,right:v.H};
        })()};
    }
  },
  terrassendach:{
    label:'Terrassenüberdachung',
    fields:[
      {id:'W',label:'Breite an der Hauswand',unit:'m',min:2,max:10,step:.1,value:4},
      {id:'D',label:'Tiefe (Ausladung)',unit:'m',min:1.5,max:5,step:.1,value:3},
      {id:'H',label:'Pfostenhöhe vorne',unit:'m',min:2,max:3,step:.05,value:2.3},
      {id:'A',label:'Pfostenabstand max.',unit:'m',min:1.5,max:4,step:.1,value:3}
    ],
    woods:['bsh','kvh','douglasie','laerche'], option:'Hohe Schneelast (Alpenraum, höhere Lagen)',
    calc(v,snow){
      const f=snow?1.25:1, o=.3;
      const inner=v.W-2*o, n=Math.ceil(inner/v.A-1e-9)+1, a=inner/(n-1);
      const span=v.D-o, slope=1.01; // ca. 8° Neigung
      const post=snow?[14,14]:[12,12];
      const pf=pick(T_PFETTE,a*f), sp=pick(T_SPARREN,span*f);
      const ns=Math.ceil(v.W/.7)+1, nk=2*(n-1);
      const pieces=[
        piece('Pfosten',post[0],post[1],v.H,n),
        piece('Pfette vorne',pf[0],pf[1],v.W,1),
        piece('Wandbalken',8,16,v.W,1),
        piece('Sparren',sp[0],sp[1],v.D*slope,ns),
        piece('Kopfbänder',10,10,.9,nk)
      ];
      const sGap=(v.W-sp[0]/100)/(ns-1);
      const it=[{k:'wall',x:0,y:-.12,w:v.W,h:.12},{k:'outline',x:0,y:0,w:v.W,h:v.D}];
      for(let i=0;i<ns;i++) it.push({k:'beam',x:i*sGap,y:0,w:sp[0]/100,h:v.D});
      const pw=pf[0]/100, pp=post[0]/100;
      it.push({k:'beam',x:0,y:0,w:v.W,h:.08},{k:'beam',x:0,y:v.D-o-pw/2,w:v.W,h:pw});
      for(let i=0;i<n;i++) it.push({k:'post',x:o+i*a-pp/2,y:v.D-o-pp/2,w:pp,h:pp});
      const anker=Math.ceil(v.W/.8)+1;
      return {pieces,hw:n*30+ns*2*5+nk*3+anker*8+60,hwLabel:'Pfostenträger, Wandanker, Sparrenpfettenanker, Schrauben',
        notes:[`${n} Pfosten mit ${fmt(a)} m Achsabstand, ${ns} Sparren mit rund ${Math.round(sGap*100)} cm Abstand.`,
          'Sparrenlänge mit etwa 8° Dachneigung gerechnet.',
          snow?'Querschnitte für hohe Schneelast eine Stufe stärker gewählt.':'Im Alpenraum und in höheren Lagen die Option für hohe Schneelast aktivieren.',
          'Die Befestigung an der Hauswand hängt vom Mauerwerk ab. Eindeckung und Fundamente sind nicht enthalten.'],
        plan:{w:v.W,h:v.D,items:it,top:-.12},
        side:(()=>{
          const pfh=pf[1]/100, sh=sp[1]/100, tn=Math.tan(Math.acos(1/slope)), xp=v.D-o;
          const zb=x=>v.H+pfh+tn*(xp-x), sv=sh*slope, top=zb(0)+sv;
          return {w:v.D,x0:-.22,zTop:top+.25,right:v.H,left:top,wallLabel:true,items:[
            {k:'wall',x:-.22,z:0,w:.22,h:top+.25},
            {k:'post',x:xp-pp/2,z:0,w:pp,h:v.H},
            {k:'beam',x:xp-pw/2,z:v.H,w:pw,h:pfh},
            {k:'beam',x:0,z:zb(.08)-.16,w:.08,h:.16},
            {k:'beam',pts:[[0,zb(0)],[v.D,zb(v.D)],[v.D,zb(v.D)+sv],[0,zb(0)+sv]]}
          ]};
        })()};
    }
  },
  hochbeet:{
    label:'Hochbeet',
    fields:[
      {id:'L',label:'Länge',unit:'m',min:.8,max:4,step:.1,value:2},
      {id:'B',label:'Breite',unit:'m',min:.5,max:1.5,step:.1,value:.8},
      {id:'H',label:'Höhe',unit:'m',min:.3,max:1.2,step:.05,value:.8}
    ],
    woods:['laerche','douglasie','kdi'],
    calc(v){
      const t=2.8, bw=14.5, tm=t/100;
      const rows=Math.ceil(v.H*100/bw-1e-9), hAct=rows*bw/100;
      const mid=v.L>1.6?Math.ceil(v.L/1.5)-1:0;
      const pieces=[
        piece('Bretter Längsseite',t,bw,v.L,rows*2),
        piece('Bretter Stirnseite',t,bw,v.B-2*tm,rows*2),
        piece('Eckpfosten',7,7,hAct,4)
      ];
      if(mid) pieces.push(piece('Mittelpfosten',7,7,hAct,mid*2),piece('Querstreben',4,6,v.B-2*tm,mid));
      const it=[{k:'outline',x:0,y:0,w:v.L,h:v.B},
        {k:'board',x:0,y:0,w:v.L,h:tm},{k:'board',x:0,y:v.B-tm,w:v.L,h:tm},
        {k:'board',x:0,y:tm,w:tm,h:v.B-2*tm},{k:'board',x:v.L-tm,y:tm,w:tm,h:v.B-2*tm}];
      const p=.07;
      [[tm,tm],[v.L-tm-p,tm],[tm,v.B-tm-p],[v.L-tm-p,v.B-tm-p]].forEach(([x,y])=>it.push({k:'post',x,y,w:p,h:p}));
      for(let i=1;i<=mid;i++){const x=i*v.L/(mid+1)-p/2;
        it.push({k:'post',x,y:tm,w:p,h:p},{k:'post',x,y:v.B-tm-p,w:p,h:p},{k:'hidden',x:x+p/2-.02,y:tm+p,w:.04,h:v.B-2*tm-2*p});}
      return {pieces,hw:25+rows*6,hwLabel:'Schrauben und Winkel',
        notes:[`${rows} Bretterlagen à 14,5 cm ergeben ${fmt(hAct)} m Höhe.`,'Noppenfolie, Wühlmausgitter und Befüllung sind nicht enthalten.'],
        plan:{w:v.L,h:v.B,items:it},
        side:(()=>{
          const s2=[], b=bw/100;
          for(let r=0;r<rows;r++) s2.push({k:'board',x:0,z:r*b,w:v.L,h:b});
          const xs=[tm,v.L-tm-p];
          for(let i=1;i<=mid;i++) xs.push(i*v.L/(mid+1)-p/2);
          xs.forEach(x=>s2.push({k:'hidden',x,z:0,w:p,h:hAct}));
          return {w:v.L,zTop:hAct,items:s2};
        })()};
    }
  },
  tisch:{
    label:'Tisch',
    fields:[
      {id:'L',label:'Länge',unit:'m',min:.6,max:3,step:.05,value:1.8},
      {id:'B',label:'Breite',unit:'m',min:.5,max:1.2,step:.05,value:.85},
      {id:'H',label:'Höhe',unit:'m',min:.4,max:1.05,step:.01,value:.75}
    ],
    woods:['fichte','eiche','laerche'], postLabel:'Beine',
    calc(v){
      const t=v.L>2?4:2.8, bw=14, n=Math.max(2,Math.round(v.B*100/bw)), bAct=n*bw/100;
      const inset=.1, leg=.08, nq=Math.max(2,Math.ceil(v.L/.6));
      const pieces=[
        piece('Plattenbretter',t,bw,v.L,n),
        piece('Beine',8,8,v.H-t/100,4),
        piece('Zarge lang',4,10,v.L-2*inset-2*leg,2),
        piece('Zarge kurz',4,10,bAct-2*inset-2*leg,2),
        piece('Gratleisten',2.8,6,bAct-.1,nq)
      ];
      const it=[];
      for(let i=0;i<n;i++) it.push({k:'board',x:0,y:i*bw/100,w:v.L,h:bw/100});
      [[inset,inset],[v.L-inset-leg,inset],[inset,bAct-inset-leg],[v.L-inset-leg,bAct-inset-leg]].forEach(([x,y])=>it.push({k:'hidden',x,y,w:leg,h:leg}));
      it.push({k:'hidden',x:inset+leg,y:inset,w:v.L-2*inset-2*leg,h:.04},{k:'hidden',x:inset+leg,y:bAct-inset-.04,w:v.L-2*inset-2*leg,h:.04});
      return {pieces,hw:20+nq*2,hwLabel:'Schrauben, Dübel, Tischplattenhalter',
        notes:[`${n} Bretter à 14 cm ergeben ${fmt(bAct)} m Plattenbreite.`, t===4?'Ab 2 m Länge mit 4 cm starker Platte gerechnet.':'Platte mit 2,8 cm Stärke gerechnet.','Öl, Lack und Leim sind nicht enthalten.'],
        plan:{w:v.L,h:bAct,items:it},
        side:(()=>{
          const tp=t/100, zu=v.H-tp;
          return {w:v.L,zTop:v.H,items:[
            {k:'board',x:0,z:zu,w:v.L,h:tp},
            {k:'beam',x:inset+leg,z:zu-.1,w:v.L-2*inset-2*leg,h:.1},
            {k:'post',x:inset,z:0,w:leg,h:zu},
            {k:'post',x:v.L-inset-leg,z:0,w:leg,h:zu}
          ]};
        })()};
    }
  },
  gartenzaun:{
    label:'Gartenzaun',
    fields:[
      {id:'L',label:'Zaunlänge',unit:'m',min:2,max:60,step:.5,value:10},
      {id:'H',label:'Zaunhöhe',unit:'m',min:.6,max:2,step:.05,value:1.2},
      {id:'A',label:'Pfostenabstand max.',unit:'m',min:1.2,max:2.5,step:.1,value:2},
      {id:'S',label:'Abstand zwischen den Latten',unit:'cm',min:1,max:12,step:.5,value:4}
    ],
    woods:['laerche','douglasie','kdi'],
    calc(v){
      const n=Math.ceil(v.L/v.A-1e-9)+1, a=v.L/(n-1), pp=.09, lb=7, lt=2.2, gap=v.S/100;
      const rows=v.H>1.3?3:2, nl=Math.floor((v.L+gap)/(lb/100+gap));
      const lh=v.H-.1;
      const pieces=[
        piece('Pfosten',9,9,v.H,n),
        piece('Querriegel',4.5,7,a,rows*(n-1)),
        piece('Zaunlatten',lt,lb,lh,nl)
      ];
      /* Ansicht: Ausschnitt mit höchstens zwei Feldern */
      const f=Math.min(2,n-1), w=f*a, it=[];
      for(let i=0;i<=f;i++) it.push({k:'post',x:i*a-pp/2,z:0,w:pp,h:v.H});
      const rz=rows===3?[.25,(v.H-.07)/2,v.H-.32]:[.25,v.H-.32];
      rz.forEach(z=>it.push({k:'beam',x:-pp/2,z,w:w+pp,h:.07}));
      for(let x=0;x+lb/100<=w+1e-9;x+=lb/100+gap) it.push({k:'board',x,z:.05,w:lb/100,h:lh});
      return {pieces,hw:n*22+nl*rows*2*.12+20,hwLabel:'H-Anker, Pfostenkappen, Schrauben',
        notes:[`${n} Pfosten mit ${fmt(a)} m Achsabstand, ${nl} Latten à ${lb} cm mit ${cm(v.S)} cm Abstand.`,
          `${rows} Querriegel pro Feld${rows===3?' (ab 1,30 m Höhe)':''}. Die Latten enden 5 cm über dem Boden und 5 cm unter dem Pfostenkopf.`,
          'Pfosten auf H-Anker mit Punktfundament gerechnet. Beton für die Fundamente ist nicht enthalten.'],
        side:{title:'Ansicht',w,x0:-.08,zTop:v.H,items:it,topLabel:f<n-1?`Ausschnitt: ${f} von ${n-1} Feldern à ${fmt(a)} m`:null}};
    }
  },
  holzterrasse:{
    label:'Holzterrasse',
    postLabel:'Auflager (Stelzlager)',
    fields:[
      {id:'L',label:'Länge in Dielenrichtung',unit:'m',min:1,max:12,step:.1,value:4},
      {id:'B',label:'Breite quer zu den Dielen',unit:'m',min:1,max:10,step:.1,value:3},
      {id:'D',label:'Dielenbreite',unit:'cm',min:9,max:20,step:.5,value:14.5},
      {id:'U',label:'Abstand der Unterkonstruktion',unit:'cm',min:30,max:60,step:1,value:50}
    ],
    woods:['laerche','douglasie','kdi'],
    calc(v){
      const fuge=.7, td=2.8, nd=Math.ceil(v.B*100/(v.D+fuge)-1e-9);
      const uk=terrassenUK(v.L,v.B,v.U/100,.6,false);
      const pieces=[piece('Terrassendielen',td,v.D,v.L,nd),...uk.pieces];
      const it=[];
      for(let i=0;i<nd;i++){const y=i*(v.D+fuge)/100; it.push({k:'board',x:0,y,w:v.L,h:Math.min(v.D/100,v.B-y)});}
      uk.xs.forEach(x=>it.push({k:'hidden',x:x-.0225,y:0,w:.045,h:v.B}));
      const screws=nd*uk.nu*2;
      return {pieces,hw:screws*.12+uk.pads*3.5+25,hwLabel:'Edelstahlschrauben, Stelzlager, Abstandhalter',
        notes:[`${nd} Dielen mit ${cm(fuge*10)} mm Fuge, ${uk.nu} Hölzer Unterkonstruktion mit ${Math.round(uk.u*100)} cm Achsabstand, ${uk.pads} Stelzlager.`,
          `Rund ${screws} Edelstahlschrauben (2 pro Diele und Auflage).`,
          v.L>4?'Dielen über 4 m Länge werden gestoßen. Unter jedem Stoß eine doppelte Unterkonstruktion einplanen.':'Dielen quer zur Unterkonstruktion verlegen, Gefälle von 1 bis 2 % vom Haus weg.',
          'Terrassendielen werden meist pro Laufmeter oder m² verkauft. Den Preis kannst du oben anpassen oder auf der Holzpreise-Seite umrechnen.'],
        plan:{w:v.L,h:v.B,items:it},
        side:uk.side(td)};
    }
  },
  unterkonstruktion:{
    label:'Unterkonstruktion',
    postLabel:'Auflager (Stelzlager)',
    fields:[
      {id:'L',label:'Länge in Dielenrichtung',unit:'m',min:1,max:12,step:.1,value:4},
      {id:'B',label:'Breite quer zu den Dielen',unit:'m',min:1,max:10,step:.1,value:3},
      {id:'U',label:'Achsabstand der Hölzer',unit:'cm',min:30,max:60,step:1,value:50},
      {id:'A',label:'Abstand der Auflager',unit:'cm',min:40,max:100,step:5,value:60}
    ],
    woods:['laerche','douglasie','kdi'],
    option:'Kreuzlage mit Grundhölzern (für unebenen Untergrund)',
    calc(v,kreuz){
      const uk=terrassenUK(v.L,v.B,v.U/100,v.A/100,kreuz);
      const it=[];
      if(kreuz) uk.ys.forEach(y=>it.push({k:'beam',x:0,y:y-.035,w:v.L,h:.07}));
      uk.xs.forEach(x=>it.push({k:'beam',x:x-.0225,y:0,w:.045,h:v.B}));
      uk.padPos.forEach(([x,y])=>it.push({k:'post',x:x-.05,y:y-.05,w:.1,h:.1}));
      return {pieces:uk.pieces,hw:uk.pads*3.5+(kreuz?uk.nu*uk.ys.length*2*.12:0)+15,hwLabel:kreuz?'Stelzlager, Schrauben':'Stelzlager',
        notes:[`${uk.nu} Hölzer mit ${Math.round(uk.u*100)} cm Achsabstand${kreuz?`, darunter ${uk.ys.length} Grundhölzer`:''}, ${uk.pads} Stelzlager.`,
          'Für Holzdielen mit 2,5 bis 2,8 cm Stärke sind 50 cm Achsabstand üblich. Bei WPC- oder dünnen Dielen gilt meist 40 cm, maßgeblich ist die Herstellerangabe.',
          kreuz?'Die Grundhölzer liegen auf Stelzlagern im Abstand von 1 m, die Hölzer darüber spannen zwischen den Grundhölzern.':'Hölzer nie direkt auf Erde legen. Darunter Unkrautvlies und Splitt, Gefälle von 1 bis 2 % vom Haus weg.'],
        plan:{w:v.L,h:v.B,items:it},
        side:uk.side(0)};
    }
  }
  ,
  /* ---------- Weihnachtsprojekte ---------- */
  weihnachtsbaum:{
    label:'Weihnachtsbaum aus Holz', postLabel:'Stamm und Fuß', round:1,
    fields:[
      {id:'H',label:'Höhe gesamt',unit:'m',min:.5,max:3,step:.05,value:1.6},
      {id:'B',label:'Breite unten',unit:'m',min:.3,max:2,step:.05,value:.9},
      {id:'LB',label:'Lattenbreite',unit:'cm',min:2,max:12,step:.1,value:4.8},
      {id:'S',label:'Abstand zwischen den Latten',unit:'cm',min:0,max:25,step:.5,value:5}
    ],
    woods:['fichte','kdi','laerche','douglasie'],
    option:'Zum Aufhängen an der Wand (ohne Fuß)',
    calc(v,wand){
      const lt=2.4, lb=v.LB/100, gap=v.S/100;
      const st=v.H>1.5?[4.5,7]:[3,5], sw=st[0]/100;
      const fh=wand?0:.045, F=wand?0:Math.max(.4,Math.min(1,.5*v.B+.1));
      const z0=fh+Math.min(.4,Math.max(.1,.12*v.H)), zTop=v.H-.02;
      const n=Math.max(1,Math.floor((zTop-z0+gap)/(lb+gap)+1e-9));
      const lens=[], zs=[];
      for(let i=0;i<n;i++){const zb=z0+i*(lb+gap), frac=(zb+lb/2-z0)/(v.H-z0);
        zs.push(zb); lens.push(Math.max(.06,Math.round(v.B*(1-frac)*200)/200));}
      const pieces=[pieceVar('Querlatten (Äste)',lt,v.LB,lens),piece('Stamm',st[0],st[1],v.H-fh,1)];
      if(!wand) pieces.push(piece('Fuß (Kreuz)',4.5,7,F,2));
      const bars=stangen(lens), lm=lens.reduce((a,x)=>a+x,0);
      const c=Math.max(v.B,F)/2, it=[];
      if(!wand) it.push({k:'post',x:c-F/2,z:0,w:F,h:fh});
      it.push({k:'post',x:c-sw/2,z:fh,w:sw,h:v.H-fh});
      lens.forEach((l,i)=>it.push({k:'board',x:c-l/2,z:zs[i],w:l,h:lb}));
      return {pieces,hw:n*2*.08+(wand?4:12),hwLabel:wand?'Schrauben, Aufhänger':'Schrauben, Winkel für den Fuß',
        notes:[`${n} ${n===1?'Querlatte':'Querlatten'}${v.S?` mit ${cm(v.S)} cm Abstand`:' ohne Abstand'}. Zuschnitt von unten nach oben in cm: ${lens.map(l=>cm(l*100)).join(' / ')}.`,
          `Zusammen ${fmt(lm,1)} Laufmeter Latte, das ${bars.n===1?'ist 1 Latte':`sind ${bars.n} Latten`} à ${cm(bars.L)} m.`,
          wand?'Der Stamm wird mit zwei Aufhängern an der Wand befestigt.':`Der Fuß ist ein Kreuz aus zwei Hölzern à ${cm(F*100)} cm, in der Mitte überblattet.${v.H>2?' Bei dieser Höhe den Fuß beschweren oder den Baum zusätzlich an der Wand sichern.':''}`,
          `Für Lichter entlang jeder Latte brauchst du rund ${Math.ceil(lm)} m Lichterkette. Lichter und Deko sind nicht enthalten.`],
        side:{title:'Ansicht',w:2*c,zTop:v.H,items:it,noGround:wand}};
    }
  },
  gluehweinhuette:{
    label:'Glühweinhütte',
    fields:[
      {id:'L',label:'Breite (Front)',unit:'m',min:1.5,max:5,step:.1,value:3},
      {id:'T',label:'Tiefe',unit:'m',min:1.2,max:3,step:.1,value:2},
      {id:'H',label:'Wandhöhe',unit:'m',min:1.9,max:2.6,step:.05,value:2.2},
      {id:'N',label:'Dachneigung',unit:'°',min:15,max:45,step:1,value:25}
    ],
    woods:['kvh','douglasie','laerche','kdi'],
    option:'Mit Holzboden (OSB auf Lagerhölzern)',
    calc(v,boden){
      const p=.08, a=Math.tan(v.N*DEG), co=Math.cos(v.N*DEG), ue=.25, ug=.15;
      const nf=Math.ceil((v.L-p)/2.5-1e-9)+1, af=(v.L-p)/(nf-1), hp=v.H-.16;
      const ls=(v.T/2+ue)/co, ns=Math.ceil((v.L+2*ug-.06)/.8-1e-9)+1, sa=(v.L+2*ug-.06)/(ns-1);
      const Lo=v.L-2*p-.2, ho=Math.min(1,hp-1.0-.12), zT=1.0;
      const pf=pick(T_PFETTE,v.L-p), np=2+nf+(v.T>2.5?2:0);
      const pieces=[
        piece('Pfosten',8,8,hp,np),
        piece('Schwellen längs',8,8,v.L,2),
        piece('Schwellen und Rähm quer',8,8,v.T-2*p,4),
        piece('Rähm hinten',8,8,v.L,1),
        piece('Rähm vorne (über der Öffnung)',pf[0],pf[1],v.L,1),
        pieceVar('Riegel',6,8,[v.L-2*p,v.L-2*p,v.T-2*p,v.T-2*p]),
        piece('Sparren',6,10,ls,2*ns),
        piece('Kehlbalken',4,10,v.T/2+.1,ns),
        piece('Thekenbrett',4,30,v.L+.1,1),
        pieceVar('Rahmen Verkaufsklappe',4.5,7,[Lo+.1,Lo+.1,ho,ho])
      ];
      if(boden) pieces.push(piece('Lagerhölzer Boden',6,8,v.T-2*p,Math.ceil((v.L-2*p)/.5-1e-9)+1));
      const wand=2*v.H*(v.L+v.T)+v.T*v.T*a/2, dach=2*(v.L+2*ug)*ls, nd=platten(dach);
      const extras=[extra('Profilbretter 19 mm für Wände und Klappe',`${fmt(wand*1.1,1)} m² à ca. 20 €`,wand*1.1*20),
        extra('OSB-Platten 18 mm fürs Dach',`${nd} Platten 2,50 × 1,25 m à ca. 28 €`,nd*28),
        extra('Dachpappe, besandet',`${fmt(dach*1.15,1)} m² à ca. 5 €`,dach*1.15*5)];
      if(boden){const nb=platten((v.L-2*p)*(v.T-2*p)); extras.push(extra('OSB-Platten 22 mm für den Boden',`${nb} Platten à ca. 35 €`,nb*35));}
      const first=v.H+a*v.T/2;
      /* Draufsicht: Front unten */
      const it=[{k:'outline',x:0,y:0,w:v.L,h:v.T},
        {k:'beam',x:0,y:0,w:v.L,h:p},{k:'beam',x:0,y:v.T-p,w:v.L,h:p},{k:'beam',x:0,y:p,w:p,h:v.T-2*p},{k:'beam',x:v.L-p,y:p,w:p,h:v.T-2*p},
        {k:'hidden',x:.05,y:v.T-.22,w:v.L-.1,h:.3}];
      if(boden){const n2=Math.ceil((v.L-2*p)/.5-1e-9); for(let i=0;i<=n2;i++) it.push({k:'hidden',x:p+i*(v.L-2*p-.06)/n2,y:p,w:.06,h:v.T-2*p});}
      for(let i=0;i<nf;i++) it.push({k:'post',x:i*af,y:0,w:p,h:p});
      it.push({k:'post',x:0,y:v.T-p,w:p,h:p},{k:'post',x:v.L-p,y:v.T-p,w:p,h:p});
      if(v.T>2.5) it.push({k:'post',x:0,y:v.T/2-p/2,w:p,h:p},{k:'post',x:v.L-p,y:v.T/2-p/2,w:p,h:p});
      /* Giebelansicht: Front rechts */
      const sv=.1/co, sp=x=>v.H+a*x;
      const s2=[{k:'beam',x:0,z:0,w:v.T,h:.08},{k:'post',x:0,z:.08,w:p,h:hp},{k:'post',x:v.T-p,z:.08,w:p,h:hp},
        {k:'beam',x:p,z:1.06,w:v.T-2*p,h:.08},{k:'beam',x:0,z:v.H-.08,w:v.T,h:.08},{k:'beam',x:v.T-pf[0]/100,z:v.H-pf[1]/100,w:pf[0]/100,h:pf[1]/100},
        {k:'beam',pts:[[-ue,sp(-ue)],[v.T/2,sp(v.T/2)],[v.T/2,sp(v.T/2)+sv],[-ue,sp(-ue)+sv]]},
        {k:'beam',pts:[[v.T+ue,sp(-ue)],[v.T/2,sp(v.T/2)],[v.T/2,sp(v.T/2)+sv],[v.T+ue,sp(-ue)+sv]]},
        {k:'beam',x:v.T/4-.05,z:v.H+a*v.T/4,w:v.T/2+.1,h:.1},
        {k:'board',x:v.T-.12,z:zT-.04,w:.3,h:.04}];
      return {pieces,extras,hw:np*6+ns*2*3+100+(boden?15:0),hwLabel:'Winkel, Schrauben, Scharniere, Klappenstützen',
        notes:[`${np} Pfosten, ${ns} Sparrenpaare mit rund ${Math.round(sa*100)} cm Abstand, ${v.N}° Dachneigung. Firsthöhe außen ${fmt(first+sv)} m.`,
          `Verkaufsöffnung ${cm(Math.round(Lo*100))} × ${cm(Math.round(ho*100))} cm ohne Mittelpfosten, Klappe nach oben, Theke auf 1,00 m Höhe. Darüber trägt ein Rähm mit ${pf[0]} × ${pf[1]} cm.`,
          'Eine Tür in der Rückwand baust du aus den Profilbrettern. Fenster, Strom und Beleuchtung sind nicht enthalten.',
          'Auf dem Markt die Hütte mit Gewichten oder Erdankern gegen Wind sichern. Dauerhaft im Garten gehört sie auf Punktfundamente.'],
        plan:{w:v.L,h:v.T,bottom:v.T+.1,items:it},
        side:{title:'Giebelansicht',x0:-ue-.05,w:v.T+ue+.05,dimW:v.T,zTop:first+sv,items:s2,right:v.H}};
    }
  },
  krippe:{
    label:'Krippenstall', round:1,
    fields:[
      {id:'B',label:'Breite',unit:'cm',min:25,max:150,step:1,value:50},
      {id:'T',label:'Tiefe',unit:'cm',min:15,max:80,step:1,value:30},
      {id:'H',label:'Wandhöhe',unit:'cm',min:15,max:80,step:1,value:25},
      {id:'N',label:'Dachneigung',unit:'°',min:20,max:50,step:1,value:35}
    ],
    woods:['fichte','laerche','eiche'],
    option:'Mit Heuboden (Zwischenboden hinten)',
    calc(v,heu){
      const b=v.B/100, T=v.T/100, h=v.H/100, a=Math.tan(v.N*DEG), co=Math.cos(v.N*DEG);
      const q=.03, t=.012, f=.018, ue=.04, bw=.1;
      const rows=Math.ceil(h/bw-1e-9), slope=(b/2+ue)/co, rd=Math.ceil(slope/(bw-.02)-1e-9);
      const nr=Math.ceil(b/bw-1e-9), rw=[];
      for(let i=0;i<nr;i++){const x=Math.min(b,(i+.5)*b/nr); rw.push(Math.round((h+(b/2-Math.abs(x-b/2))*a)*200)/200);}
      const pieces=[
        piece('Bodenplatte (Bretter)',1.8,12,b+.06,Math.ceil((T+.06)/.12-1e-9)),
        piece('Eckpfosten',3,3,h-q,4),
        piece('Rähm und First',3,3,T+.05,3),
        piece('Giebelbalken vorne',3,4,b,1),
        piece('Sparren',2,4,(b/2+ue)/co,4),
        piece('Bretter Seitenwände',1.2,10,T,2*rows),
        pieceVar('Bretter Rückwand',1.2,10,rw),
        piece('Dachbretter',1.2,10,T+.06,2*rd)
      ];
      const zh=f+h*.62;
      if(heu) pieces.push(piece('Heuboden',1.2,10,b-2*t,Math.ceil(T*.5/bw-1e-9)),piece('Auflageleisten',2,2,T*.5,2));
      const first=f+h+a*b/2, sv=.04/co+t;
      /* Ansicht von vorne */
      const s2=[{k:'board',x:-.03,z:0,w:b+.06,h:f},
        {k:'board',pts:[[0,f],[b,f],[b,f+h],[b/2,f+h+a*b/2],[0,f+h]]}];
      if(heu) s2.push({k:'board',x:t,z:zh,w:b-2*t,h:t});
      s2.push({k:'post',x:0,z:f,w:q,h:h-q},{k:'post',x:b-q,z:f,w:q,h:h-q},{k:'beam',x:0,z:f+h-.04,w:b,h:.04},
        {k:'beam',pts:[[-ue,f+h-a*ue],[b/2,f+h+a*b/2],[b/2,f+h+a*b/2+sv],[-ue,f+h-a*ue+sv]]},
        {k:'beam',pts:[[b+ue,f+h-a*ue],[b/2,f+h+a*b/2],[b/2,f+h+a*b/2+sv],[b+ue,f+h-a*ue+sv]]});
      /* Draufsicht: offene Seite unten */
      const it=[{k:'outline',x:-.03,y:0,w:b+.06,h:T+.03},{k:'board',x:0,y:0,w:b,h:t},{k:'board',x:0,y:t,w:t,h:T-t},{k:'board',x:b-t,y:t,w:t,h:T-t}];
      if(heu) it.push({k:'hidden',x:t,y:t,w:b-2*t,h:T*.5});
      [[0,0],[b-q,0],[0,T-q],[b-q,T-q]].forEach(([x,y])=>it.push({k:'post',x,y,w:q,h:q}));
      const fig1=Math.round(v.H/2), fig2=Math.round(v.H/1.5);
      return {pieces,hw:6+(heu?1:0),hwLabel:'Holzleim, Nägel, Schrauben',
        notes:[`Gesamthöhe ${cm(Math.round((first+sv)*100))} cm mit Bodenplatte und Dach. Rückwand aus ${nr} senkrechten Brettern, Seitenwände aus je ${rows} waagrechten Brettern, Dach mit je ${rd} Brettern pro Seite (2 cm überlappend).`,
          `Faustregel: Die Wandhöhe ist etwa das 1,5- bis 2-Fache der stehenden Figuren. Dieser Stall passt zu Figuren von rund ${fig1} bis ${fig2} cm.`,
          heu?`Der Heuboden liegt auf ${cm(Math.round(h*62))} cm Höhe über der hinteren Hälfte.`:'Mit der Option Heuboden kommt ein Zwischenboden über der hinteren Hälfte dazu.',
          'Für den Altholz-Look die Bretter mit einer Drahtbürste ausbürsten und dunkel beizen. Moos, Rinde, Beleuchtung und Figuren sind nicht enthalten.'],
        plan:{w:b,h:T,x0:-.03,bottom:T+.03,items:it,unit:'cm',maxH:150},
        side:{title:'Ansicht von vorne',x0:-ue-.03,w:b+ue+.03,dimW:b,zTop:first+sv,items:s2,unit:'cm'}};
    }
  },
  holzstern:{
    label:'Holzstern', postLabel:null, round:1,
    fields:[
      {id:'W',label:'Breite von Spitze zu Spitze',unit:'m',min:.4,max:3,step:.05,value:1},
      {id:'LB',label:'Lattenbreite',unit:'cm',min:2,max:10,step:.1,value:4.8},
      {id:'LT',label:'Lattenstärke',unit:'cm',min:1,max:5,step:.1,value:2.4},
      {id:'N',label:'Anzahl Sterne',unit:'Stück',min:1,max:20,step:1,value:1}
    ],
    woods:['fichte','kdi','laerche','douglasie'],
    option:'Als Umriss aus 10 Latten (auf Gehrung)',
    calc(v,umriss){
      const lb=v.LB/100, d=(lb/2)/Math.sin(18*DEG), Ro=v.W/(2*Math.sin(72*DEG));
      const R=Math.max(Ro-d,2.5*lb), knapp=Ro-d<2.5*lb, Rr=R+d;
      const cx=Rr*Math.sin(72*DEG), cy=Rr;      // Mittelpunkt, Spitze oben bei y=0
      const pt=(r,k,off=0)=>{const w=(-90+72*k+off)*DEG; return [cx+r*Math.cos(w),cy+r*Math.sin(w)];};
      const sub=(A,B)=>[A[0]-B[0],A[1]-B[1]], len=A=>Math.hypot(A[0],A[1]);
      /* Gerade durch Punkt P mit Richtung D, um o seitlich verschoben; Schnitt zweier Geraden */
      const shift=(P,D,o)=>{const l=len(D); return [[P[0]-D[1]/l*o,P[1]+D[0]/l*o],D];};
      const cut=([P,D],[Q,E])=>{const den=D[0]*E[1]-D[1]*E[0], t=((Q[0]-P[0])*E[1]-(Q[1]-P[1])*E[0])/den; return [P[0]+t*D[0],P[1]+t*D[1]];};
      /* [äußere Kante, innere Kante] einer Latte: außen ist die Kante, deren Mitte weiter vom Sternmittelpunkt weg liegt */
      const C=[cx,cy], mid=([Q,D])=>[Q[0]+D[0]/2,Q[1]+D[1]/2];
      const out=(P,D)=>{const a=shift(P,D,lb/2), b=shift(P,D,-lb/2); return len(sub(mid(a),C))>len(sub(mid(b),C))?[a,b]:[b,a];};
      const it=[]; let L, nl, lm, schnitt;
      if(!umriss){
        const P=[0,1,2,3,4].map(k=>pt(R,k)), lines=[0,1,2,3,4].map(k=>{const A=P[k],B=P[(k+2)%5]; return {A,B,D:sub(B,A),e:out(A,sub(B,A))};});
        /* Latte k läuft von Spitze k nach Spitze k+2; an Spitze k trifft sie Latte k-2 (die bei k endet) */
        lines.forEach((l,k)=>{const prev=lines[(k+3)%5], next=lines[(k+2)%5];
          const t1=cut(l.e[0],prev.e[0]), u1=cut(l.e[1],prev.e[0]), t2=cut(l.e[0],next.e[0]), u2=cut(l.e[1],next.e[0]);
          l.poly=[t1,t2,u2,u1]; l.L=len(sub(t1,t2));});
        lines.forEach(l=>it.push({k:'board',pts:l.poly}));
        L=Math.ceil(lines[0].L*200)/200; nl=5; lm=5*R*2*Math.sin(72*DEG);
        schnitt='Die Enden im Winkel von 36° zur Längsachse ablängen (an der Kappsäge 54° einstellen), dann liegen die Spitzen bündig aufeinander. Die Latten an den 10 Kreuzungen miteinander verschrauben.';
      } else {
        const r=R*Math.sin(18*DEG)/Math.sin(126*DEG), V=[];
        for(let k=0;k<5;k++){V.push(pt(R,k),pt(r,k,36));}
        const E=V.map((A,j)=>{const B=V[(j+1)%10]; return out(A,sub(B,A));});
        const O=V.map((_,j)=>cut(E[(j+9)%10][0],E[j][0])), I=V.map((_,j)=>cut(E[(j+9)%10][1],E[j][1]));
        let mx=0;
        for(let j=0;j<10;j++){const j2=(j+1)%10; it.push({k:'board',pts:[O[j],O[j2],I[j2],I[j]]});
          mx=Math.max(mx,len(sub(O[j],O[j2])),len(sub(I[j],I[j2])));}
        L=Math.ceil(mx*200)/200; nl=10; lm=10*len(sub(O[0],O[1]));
        schnitt='An den Spitzen im Winkel von 18° zur Längsachse schneiden, an den Innenecken 54°. Die Spitzen am besten mit Stich- oder Handsäge, die meisten Kappsägen schaffen so spitze Winkel nicht. Die Ecken leimen und von hinten mit Flachverbindern sichern.';
      }
      const all=Array(nl*v.N).fill(L), bars=stangen(all);
      const H=Rr*(1+Math.cos(36*DEG));
      return {pieces:[piece(umriss?'Latten Umriss':'Latten',v.LT,v.LB,L,nl*v.N)],
        hw:v.N*(umriss?8:3),hwLabel:umriss?'Flachverbinder, Leim, Aufhänger':'Schrauben, Aufhänger',
        notes:[`${nl} Latten à ${cm(L*100)} cm${v.N>1?` pro Stern, zusammen ${nl*v.N} Stück`:''}. ${bars.n===1?'Das ist 1 Latte':`Das sind ${bars.n} Latten`} à ${cm(bars.L)} m aus dem Handel.`,
          schnitt,
          `Der Stern ist ${fmt(2*cx)} m breit und ${fmt(H)} m hoch. Für eine Lichterkette entlang der Latten brauchst du pro Stern rund ${fmt(Math.ceil(lm*10)/10,1)} m.`,
          knapp?'Die Latten sind für diese Sterngröße sehr breit. Mit schmaleren Latten wirkt der Stern filigraner.':'Für draußen Lärche, Douglasie oder imprägnierte Latten nehmen und die Schnittkanten lasieren.'],
        plan:{title:'Ansicht',w:2*cx,h:H,items:it,maxH:240}};
    }
  },
  adventskalender:{
    label:'Adventskalender', postLabel:null, round:1,
    fields:[
      {id:'C',label:'Fächer pro Reihe',unit:'Stück',min:3,max:8,step:1,value:6},
      {id:'FB',label:'Fachbreite (innen)',unit:'cm',min:5,max:25,step:.5,value:10},
      {id:'FH',label:'Fachhöhe (innen)',unit:'cm',min:5,max:25,step:.5,value:10},
      {id:'FT',label:'Fachtiefe',unit:'cm',min:4,max:20,step:.5,value:8},
      {id:'BS',label:'Brettstärke',unit:'cm',min:.6,max:2,step:.1,value:1.2}
    ],
    woods:['fichte','eiche','laerche'],
    option:'Mit Türchen vor jedem Fach',
    calc(v,tuer){
      const C=Math.round(v.C), rows=Math.ceil(24/C), cells=rows*C, frei=cells-24;
      const t=v.BS/100, fb=v.FB/100, fh=v.FH/100, W=C*fb+(C+1)*t, H=rows*fh+(rows+1)*t;
      const pieces=[
        piece('Boden und Deckel',v.BS,v.FT,W,2),
        piece('Seitenteile',v.BS,v.FT,H-2*t,2)
      ];
      if(rows>1) pieces.push(piece('Zwischenböden',v.BS,v.FT,W-2*t,rows-1));
      pieces.push(piece('Trennwände',v.BS,v.FT,fh,rows*(C-1)));
      const lm=pieces.reduce((a,x)=>a+x.len*x.qty,0);
      const extras=[extra('Rückwand Sperrholz 4 mm',`${cm(Math.round(W*100))} × ${cm(Math.round(H*100))} cm, ca. 12 €/m²`,Math.max(4,W*H*12))];
      if(tuer) extras.push(extra('Türchen Sperrholz 4 mm',`24 Stück à ${cm(v.FB+.6)} × ${cm(v.FH+.6)} cm`,Math.max(4,24*(fb+.006)*(fh+.006)*12*1.2)));
      /* Ansicht mit gemischten Zahlen */
      const NUM=[7,15,2,21,11,18,4,23,9,1,13,20,6,17,24,3,12,8,19,5,22,10,16,14];
      const it=[{k:'board',x:0,y:0,w:W,h:t},{k:'board',x:0,y:H-t,w:W,h:t},{k:'board',x:0,y:t,w:t,h:H-2*t},{k:'board',x:W-t,y:t,w:t,h:H-2*t}];
      let n=0;
      for(let rI=0;rI<rows;rI++){const y=t+rI*(fh+t);
        if(rI>0) it.push({k:'board',x:t,y:y-t,w:W-2*t,h:t});
        for(let c=0;c<C;c++){const x=t+c*(fb+t);
          if(c>0) it.push({k:'board',x:x-t,y,w:t,h:fh});
          if(tuer) it.push({k:'hidden',x:x+.004,y:y+.004,w:fb-.008,h:fh-.008});
          if(n<24) it.push({k:'label',x:x+fb/2,y:y+fh/2,text:NUM[n++],size:Math.max(8,Math.min(13,Math.round(fb*100)))});}}
      return {pieces,extras,hw:5+(tuer?24*1.3:0),hwLabel:tuer?'Leim, Nägel, Scharniere und Knöpfe für die Türchen':'Leim, Nägel',
        notes:[`${rows} Reihen mit je ${C} Fächern ergeben ${cells} Fächer${frei?`, ${frei===1?'1 davon bleibt':`${frei} davon bleiben`} frei für Deko`:''}.`,
          `Außenmaß ${cm(Math.round(W*1000)/10)} × ${cm(Math.round(H*1000)/10)} cm, ${cm(v.FT+.4)} cm tief mit Rückwand.`,
          `Zusammen ${fmt(lm,1)} Laufmeter Brett mit ${cm(v.BS)} × ${cm(v.FT)} cm. Leisten in dieser Breite gibt es im Baumarkt fertig zugeschnitten.`,
          'Zahlen mit Brandmalkolben, Stempel oder aufgeklebten Holzziffern. Füllung und Farbe sind nicht enthalten.'],
        plan:{title:'Ansicht von vorne',w:W,h:H,items:it,unit:'cm',maxH:260}};
    }
  }
};

/* Kopfband unter 45°: am Pfosten senkrecht, an der Pfette waagrecht abgeschnitten, damit beide Enden bündig anliegen.
   xf = Pfostenseite, zt = Pfettenunterkante, d = Abstand der Innenkante vom Eck, bw = Holzbreite, dir = 1 nach rechts / -1 nach links */
function kopfband(xf,zt,d,bw,dir){
  const c=bw*Math.SQRT2;
  return {k:'beam',pts:[[xf,zt-d-c],[xf,zt-d],[xf+dir*d,zt],[xf+dir*(d+c),zt]]};
}

/* Unterkonstruktion einer Terrasse: Hölzer 4,5 × 7 cm quer zu den Dielen, optional auf Grundhölzern 7 × 7 cm.
   L = Länge in Dielenrichtung, B = Breite, u = max. Achsabstand, A = Auflagerabstand */
function terrassenUK(L,B,u,A,kreuz){
  const e=.04, nu=Math.ceil((L-2*e)/u-1e-9)+1, ua=(L-2*e)/(nu-1), xs=[];
  for(let i=0;i<nu;i++) xs.push(e+i*ua);
  const pieces=[piece('Unterkonstruktion',4.5,7,B,nu)], padPos=[];
  let ys=[];
  if(kreuz){
    const ng=Math.ceil((B-.1)/A-1e-9)+1, ga=(B-.1)/(ng-1);
    for(let i=0;i<ng;i++) ys.push(.05+i*ga);
    pieces.push(piece('Grundhölzer',7,7,L,ng));
    const np=Math.ceil(L/1-1e-9)+1, pa=(L-.1)/(np-1);
    ys.forEach(y=>{for(let j=0;j<np;j++) padPos.push([.05+j*pa,y]);});
  } else {
    const np=Math.ceil((B-.1)/A-1e-9)+1, pa=(B-.1)/(np-1);
    xs.forEach(x=>{for(let j=0;j<np;j++) padPos.push([x,.05+j*pa]);});
  }
  /* Seitenansicht als Ausschnitt entlang der Dielen: Anfang der Terrasse mit zwei Hölzern */
  const side=td=>{
    const w=Math.min(L,e+ua+.25), it=[], ph=.04, gh=kreuz?.07:0, z1=ph+gh, z2=z1+.07;
    if(kreuz){ [.12,Math.min(w-.08,1.05)].forEach(x=>{ if(x<w) it.push({k:'post',x:x-.05,z:0,w:.1,h:ph}); });
      it.push({k:'beam',x:0,z:ph,w,h:gh}); }
    xs.filter(x=>x<w).forEach(x=>{ if(!kreuz) it.push({k:'post',x:x-.05,z:0,w:.1,h:ph}); it.push({k:'beam',x:x-.0225,z:z1,w:.045,h:.07}); });
    if(td) it.push({k:'board',x:0,z:z2,w,h:td/100});
    else it.push({k:'hidden',x:0,z:z2,w,h:.028});
    return {w,zTop:z2+(td?td/100:.028),items:it,topLabel:`Ausschnitt: ${fmt(w)} m ab Terrassenrand`};
  };
  return {pieces,nu,u:ua,xs,ys,pads:padPos.length,padPos,side};
}

function qsIcon(b,h){const s=1.5,W=Math.max(b*s,3),H=Math.max(h*s,3);
  return `<svg width="${W+2}" height="${H+2}" aria-hidden="true"><rect x="1" y="1" width="${W}" height="${H}" fill="var(--timber-soft)" stroke="var(--timber)"/></svg>`;}

const dim=(n,u)=>u==='cm'?cm(Math.round(n*1000)/10)+' cm':fmt(n)+' m';
function planSvg(plan,label){
  const padL=38,padT=30,padR=10,padB=10, top=plan.top||0, x0=plan.x0||0, x1=plan.x1||plan.w, bot=plan.bottom||plan.h;
  const s=Math.min(330/(x1-x0),(plan.maxH||190)/(bot-top));
  const W=(x1-x0)*s+padL+padR, H=(bot-top)*s+padT+padB;
  const X=x=>padL+(x-x0)*s, Y=y=>padT+(y-top)*s;
  const pst={beam:'fill="var(--timber-soft)" stroke="var(--timber)" stroke-width=".8"',post:'fill="var(--plan)"',
    hidden:'fill="none" stroke="var(--muted)" stroke-dasharray="3 2"',outline:'fill="none" stroke="var(--muted)" stroke-dasharray="4 3"'};
  pst.board=pst.beam;
  let g='';
  for(const i of plan.items){
    if(i.pts){g+=`<polygon points="${i.pts.map(([x,y])=>X(x).toFixed(1)+','+Y(y).toFixed(1)).join(' ')}" ${pst[i.k]} stroke-linejoin="round"/>`;continue;}
    if(i.k==='label'){g+=`<text x="${X(i.x).toFixed(1)}" y="${Y(i.y).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${i.size||10}" fill="var(--muted)" font-family="Barlow, system-ui, sans-serif">${i.text}</text>`;continue;}
    const a=`x="${X(i.x)}" y="${Y(i.y)}" width="${Math.max(i.w*s,1.2)}" height="${Math.max(i.h*s,1.2)}"`;
    if(i.k==='outline') g+=`<rect ${a} fill="none" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
    else if(i.k==='beam'||i.k==='board') g+=`<rect ${a} fill="var(--timber-soft)" stroke="var(--timber)" stroke-width=".8"/>`;
    else if(i.k==='post') g+=`<rect ${a} fill="var(--plan)"/>`;
    else if(i.k==='hidden') g+=`<rect ${a} fill="none" stroke="var(--muted)" stroke-dasharray="3 2"/>`;
    else if(i.k==='wall') g+=`<rect ${a} fill="var(--muted)"/>`;
  }
  const x1d=X(0), x2=X(plan.w), y1=Y(0), y2=Y(plan.h), t='font-size="12" fill="var(--ink)" font-family="Barlow, system-ui, sans-serif"';
  g+=`<path d="M${x1d} 14H${x2}M${x1d} 9V19M${x2} 9V19M18 ${y1}V${y2}M13 ${y1}H23M13 ${y2}H23" stroke="var(--muted)"/>`;
  g+=`<text x="${(x1d+x2)/2}" y="10" text-anchor="middle" ${t}>${dim(plan.w,plan.unit)}</text>`;
  g+=`<text x="12" y="${(y1+y2)/2}" text-anchor="middle" ${t} transform="rotate(-90 12 ${(y1+y2)/2})">${dim(plan.h,plan.unit)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${plan.title||'Draufsicht'} ${label}">${g}</svg>`;
}

/* Seitenansicht: x nach rechts, z = Höhe über Boden */
function sideSvg(v,label){
  const x0=v.x0||0, x1=v.w, zt=v.zTop, r=n=>Math.round(n*10)/10;
  const padL=38,padT=30,padB=14,padR=v.right?40:12;
  const s=Math.min(330/(x1-x0),190/zt);
  const W=r((x1-x0)*s+padL+padR), H=r(zt*s+padT+padB);
  const X=x=>r(padL+(x-x0)*s), Y=z=>r(padT+(zt-z)*s);
  const st={beam:'fill="var(--timber-soft)" stroke="var(--timber)" stroke-width=".8"',
    post:'fill="var(--plan)"', hidden:'fill="none" stroke="var(--muted)" stroke-dasharray="3 2"',
    wall:'fill="var(--rule)"'};
  st.board=st.beam;
  let g='';
  for(const i of v.items){
    if(i.pts) g+=`<polygon points="${i.pts.map(([x,z])=>X(x)+','+Y(z)).join(' ')}" ${st[i.k]} stroke-linejoin="round"/>`;
    else g+=`<rect x="${X(i.x)}" y="${Y(i.z+i.h)}" width="${r(Math.max(i.w*s,1.2))}" height="${r(Math.max(i.h*s,1.2))}" ${st[i.k]}/>`;
  }
  if(v.wallLabel){const wx=r(X(x0)+(X(0)-X(x0))/2+4), wy=r((Y(0)+Y(zt))/2);
    g+=`<text x="${wx}" y="${wy}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="Barlow, system-ui, sans-serif" transform="rotate(-90 ${wx} ${wy})">Hauswand</text>`;}
  /* Boden mit Schraffur */
  const gx0=X(x0)-6, gx1=X(x1)+6, gy=Y(0);
  if(!v.noGround){
    let hatch=''; for(let x=gx0+4;x<=gx1;x+=8) hatch+=`M${r(x)} ${gy}l-5 6`;
    g+=`<path d="M${r(gx0)} ${gy}H${r(gx1)}" stroke="var(--muted)" stroke-width="1.5"/><path d="${hatch}" stroke="var(--muted)" stroke-width=".7"/>`;
  }
  /* Bemaßung: Breite oben, Gesamthöhe links, optional Pfostenhöhe rechts */
  const t='font-size="12" fill="var(--ink)" font-family="Barlow, system-ui, sans-serif"';
  const xa=X(0), xb=X(v.dimW||x1), zl=v.left||zt, ya=Y(zl);
  g+=`<path d="M${xa} 14H${xb}M${xa} 9V19M${xb} 9V19M18 ${ya}V${gy}M13 ${ya}H23M13 ${gy}H23" stroke="var(--muted)"/>`;
  g+=`<text x="${r((xa+xb)/2)}" y="10" text-anchor="middle" ${t}>${v.topLabel||dim(v.dimW||x1,v.unit)}</text>`;
  g+=`<text x="12" y="${r((ya+gy)/2)}" text-anchor="middle" ${t} transform="rotate(-90 12 ${r((ya+gy)/2)})">${dim(zl,v.unit)}</text>`;
  if(v.right){const xr=W-24, yr=Y(v.right), ym=r((yr+gy)/2);
    g+=`<path d="M${xr} ${yr}V${gy}M${xr-5} ${yr}H${xr+5}M${xr-5} ${gy}H${xr+5}" stroke="var(--muted)"/>`;
    g+=`<text x="${W-6}" y="${ym}" text-anchor="middle" ${t} transform="rotate(-90 ${W-6} ${ym})">${dim(v.right,v.unit)}</text>`;}
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Seitenansicht ${label}">${g}</svg>`;
}

function mount(root){
  const key=root.dataset.rechner, p=PROJECTS[key];
  if(!p) return;
  const woods=p.woods.filter(k=>PREISE[k]);
  const s={vals:Object.fromEntries(p.fields.map(f=>[f.id,f.value])),wood:woods[0],price:PREISE[woods[0]].preis,waste:10,opt:false};
  root.innerHTML=`
  <div class="tool">
    <section aria-label="Eingaben">
      <h2>Maße eingeben</h2>
      <div class="fields"></div>
      <div class="plan"><h2 class="plan-title">Draufsicht</h2><div class="plan-svg"></div>
        <h2 class="side-title">Seitenansicht</h2><div class="side-svg"></div>
        <div class="legend">${p.postLabel===null?'':`<span><i class="sw" style="background:var(--plan)"></i>${p.postLabel||'Pfosten'}</span>`}<span><i class="sw" style="background:var(--timber-soft);border:1px solid var(--timber)"></i>Balken, Bretter</span><span><i class="sw" style="border:1px dashed var(--muted)"></i>verdeckt oder Umriss</span></div>
      </div>
    </section>
    <section aria-label="Ergebnis" aria-live="polite">
      <h2>Kostenüberschlag</h2>
      <div class="total"></div><p class="sub"></p>
      <div class="tablebox"><table>
        <thead><tr><th>Bauteil</th><th>Querschnitt</th><th class="num">Länge</th><th class="num">Stück</th><th class="num">m³</th></tr></thead>
        <tbody></tbody><tfoot><tr><td colspan="4">Summe ohne Verschnitt</td><td class="num vol"></td></tr></tfoot>
      </table></div>
      <dl class="costlines"></dl>
      <ul class="notes"></ul>
      <div class="actions"><button class="btn copy" type="button">Holzliste kopieren</button><button class="btn ghost print" type="button">Drucken oder als PDF speichern</button></div>
    </section>
  </div>`;
  const q=sel=>root.querySelector(sel), fields=q('.fields');

  function numField(id,label,unit,val,min,max,step,set,wide){
    const d=document.createElement('div'); d.className='field'+(wide?' wide':'');
    const fid=`${key}_${id}`;
    d.innerHTML=`<label for="${fid}">${label}</label><div class="inputbox"><input id="${fid}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${val}"><span class="unit">${unit}</span></div>`;
    const inp=d.querySelector('input');
    inp.addEventListener('input',()=>{const x=parseFloat(inp.value); if(!isNaN(x)){set(Math.min(max,Math.max(min,x)));update();}});
    inp.addEventListener('change',()=>{let x=parseFloat(inp.value); if(isNaN(x)) x=min; x=Math.min(max,Math.max(min,x)); inp.value=x; set(x); update();});
    return d;
  }
  p.fields.forEach(f=>fields.appendChild(numField(f.id,f.label,f.unit,s.vals[f.id],f.min,f.max,f.step,x=>s.vals[f.id]=x)));
  const w=document.createElement('div'); w.className='field wide';
  w.innerHTML=`<label for="${key}_wood">Holzart</label><div class="inputbox"><select id="${key}_wood">${woods.map(k=>`<option value="${k}">${PREISE[k].label}</option>`).join('')}</select></div>`;
  fields.appendChild(w);
  const pf=numField('price','Holzpreis','€/m³',s.price,100,10000,10,x=>s.price=x);
  fields.appendChild(pf);
  fields.appendChild(numField('waste','Verschnitt','%',s.waste,0,40,1,x=>s.waste=x));
  w.querySelector('select').addEventListener('change',e=>{s.wood=e.target.value;s.price=PREISE[s.wood].preis;pf.querySelector('input').value=s.price;update();});
  if(p.option){
    const c=document.createElement('label'); c.className='check';
    c.innerHTML=`<input type="checkbox"> ${p.option}`;
    c.querySelector('input').addEventListener('change',e=>{s.opt=e.target.checked;update();});
    fields.appendChild(c);
  }

  let last;
  function update(){
    const r=p.calc(s.vals,s.opt), ex=r.extras||[], st=p.round||10, E=n=>eur(n,st);
    const vol=r.pieces.reduce((a,x)=>a+x.vol,0), volW=vol*(1+s.waste/100), wood=volW*s.price;
    const total=wood+r.hw+ex.reduce((a,x)=>a+x.cost,0);
    q('.total').textContent=`${E(total*.85)} bis ${E(total*1.15)}`;
    q('.sub').textContent=`${fmt(volW,3)} m³ ${PREISE[s.wood].label} inklusive ${s.waste} % Verschnitt. Die Spanne von ±15 % deckt regionale Preisunterschiede ab.`;
    q('tbody').innerHTML=r.pieces.map(x=>`<tr><td class="name">${x.name}</td><td><span class="qs">${qsIcon(x.b,x.h)}${cm(x.b)} × ${cm(x.h)} cm</span></td><td class="num">${x.lenLabel||fmt(x.len)+' m'}</td><td class="num">${x.qty}</td><td class="num">${fmt(x.vol,3)}</td></tr>`).join('');
    q('.vol').textContent=fmt(vol,3);
    q('.costlines').innerHTML=`<dt>Holz (${fmt(volW,3)} m³ × ${s.price.toLocaleString('de-DE')} €)</dt><dd>${E(wood)}</dd>`+
      ex.map(x=>`<dt>${x.label}: ${x.menge} (Schätzung)</dt><dd>${E(x.cost)}</dd>`).join('')+
      `<dt>${r.hwLabel} (Schätzung)</dt><dd>${E(r.hw)}</dd>`;
    q('.notes').innerHTML=r.notes.map(n=>`<li>${n}</li>`).join('');
    q('.plan-title').hidden=q('.plan-svg').hidden=!r.plan;
    if(r.plan) q('.plan-title').textContent=r.plan.title||'Draufsicht';
    q('.plan-svg').innerHTML=r.plan?planSvg(r.plan,p.label):'';
    const sti=q('.side-title'); sti.hidden=!r.side; sti.textContent=(r.side&&r.side.title)||'Seitenansicht'; sti.classList.toggle('first',!r.plan);
    q('.side-svg').innerHTML=r.side?sideSvg(r.side,p.label):'';
    last={r,volW,total};
  }
  q('.copy').addEventListener('click',async e=>{
    const {r,volW,total}=last, btn=e.currentTarget, E=n=>eur(n,p.round||10);
    const text=[`Holzliste ${p.label} (${PREISE[s.wood].label})`,
      ...r.pieces.map(x=>`${x.qty} × ${x.name}, ${cm(x.b)} × ${cm(x.h)} cm, `+(x.lens?x.lens.map(l=>cm(l*100)).join(' / ')+' cm':fmt(x.len)+' m')),
      `Gesamt: ${fmt(volW,3)} m³ inkl. ${s.waste} % Verschnitt`,
      ...(r.extras||[]).map(x=>`${x.label}: ${x.menge}`),
      `Kostenüberschlag: ${E(total*.85)} bis ${E(total*1.15)}`].join('\n');
    try{await navigator.clipboard.writeText(text);btn.textContent='Kopiert';}catch{btn.textContent='Kopieren nicht möglich';}
    setTimeout(()=>btn.textContent='Holzliste kopieren',1800);
  });
  q('.print').addEventListener('click',()=>window.print());
  update();
}

if(typeof document!=='undefined') document.querySelectorAll('[data-rechner]').forEach(mount);
if(typeof module!=='undefined') module.exports={PROJECTS};
})();
