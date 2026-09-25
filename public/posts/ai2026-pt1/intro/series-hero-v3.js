/* Cached canvas paths: draw once in three seconds, then release the frame loop. */
(()=>{
const canvas=document.querySelector('#series-hero-canvas');
const hero=canvas?.closest('.series-hero');
const ctx=canvas?.getContext('2d');
if(!ctx||!hero)return;
const layer=document.createElement('canvas'),saved=layer.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const strokes=[];
const add=(points,start,end,width=2,alpha=1,fill=false,glow=false)=>{
 const path=new Path2D();path.moveTo(...points[0]);
 const lengths=[0];let length=0;
 for(let i=1;i<points.length;i++){
  length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  lengths.push(length);path.lineTo(...points[i]);
 }
 strokes.push({points,path,lengths,length,start,end,width,alpha,fill,glow,cached:false});
};
const cubic=(a,b,c,d)=>Array.from({length:33},(_,i)=>{
 const t=i/32,u=1-t;
 return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];
});
const ink=(curves,start,end,width=2,alpha=1,fill=false)=>add(curves.flatMap((c,i)=>cubic(...c).slice(i?1:0)),start,end,width,alpha,fill);
const arc=(a,b,start,end,width=2,alpha=1)=>{
 const dx=b[0]-a[0];
 ink([[a,[a[0]+dx*.48,a[1]],[b[0]-dx*.44,b[1]],b]],start,end,width,alpha);
};
const dot=(x,y,start)=>add(Array.from({length:25},(_,i)=>[x+3.2*Math.cos(i*Math.PI/12),y+3.2*Math.sin(i*Math.PI/12)]),start,start+.15,1.25,.95,true);

// Equal logical dimensions and a uniform canvas scale keep this a true square.
add([[139,249],[261,249],[261,371],[139,371],[139,249]],0,.47,2.7);
arc([261,310],[352,310],.4,.7,2.7);

// Curved, weighted connections retain a pen-like gesture while explicit nodes
// and multiple connected layers make the model recognizably a neural network.
const nodes=[
 [[397,244],[413,310],[397,376]],
 [[509,191],[525,270],[516,351],[505,431]],
 [[640,159],[650,234],[663,310],[650,390],[636,464]],
 [[758,216],[776,310],[756,408]],
];
for(let l=0;l<nodes.length;l++){
 const from=l?nodes[l-1]:[[352,310]];
 const to=nodes[l];
 for(let i=0;i<from.length;i++){
  const nearest=Math.round(i*(to.length-1)/Math.max(1,from.length-1));
  for(let j=0;j<to.length;j++){
   if(l===0||Math.abs(j-nearest)<=1){
    const primary=j===nearest;
    const begin=.63+l*.25+i*.028+j*.013;
    arc(from[i],to[j],begin,begin+.45,primary?2.25:1.15,primary?.9:.34);
   }
  }
 }
 to.forEach(([x,y],i)=>dot(x,y,.93+l*.25+i*.028));
}
// A pair of long skip connections gives the web an expansive, organic envelope.
ink([[[397,244],[469,139],[561,125],[640,159]]],.93,1.68,1.15,.43);
ink([[[397,376],[454,462],[566,503],[636,464]]],1.0,1.77,1.15,.43);
arc([758,216],[864,245],1.68,2.08,1.7,.7);
arc([776,310],[869,310],1.75,2.15,2.15,.9);
arc([756,408],[881,369],1.82,2.22,1.7,.7);

// One restrained synthetic face: a shell, a visor, and a few faceplate seams.
ink([
 [[864,235],[864,174],[910,146],[974,146]],
 [[974,146],[1038,146],[1084,174],[1084,235]],
 [[1084,235],[1084,274],[1080,313],[1076,343]],
 [[1076,343],[1073,377],[1047,410],[1018,432]],
 [[1018,432],[991,459],[978,466],[955,451]],
 [[955,451],[910,421],[877,389],[872,343]],
 [[872,343],[868,305],[864,267],[864,235]],
],1.88,2.62,2.8,.96,true);
ink([
 [[881,254],[931,236],[1017,236],[1067,254]],
 [[1067,254],[1067,266],[1062,281],[1058,292]],
 [[1058,292],[1018,306],[930,306],[890,292]],
 [[890,292],[885,281],[881,266],[881,254]],
],2.3,2.72,1.7,.95,true);
// Small luminous eye apertures, deliberately without human eyes, nose or lips.
add([[902,267],[950,273],[947,282],[908,278],[902,267]],2.65,2.93,1.5,1,true,true);
add([[998,273],[1046,267],[1040,278],[1001,282],[998,273]],2.67,2.95,1.5,1,true,true);
ink([[[892,315],[903,337],[922,353],[940,361]],[[940,361],[946,392],[959,414],[974,424]]],2.5,2.91,1.65,.72);
ink([[[1056,315],[1045,337],[1026,353],[1008,361]],[[1008,361],[1002,392],[989,414],[974,424]]],2.53,2.94,1.65,.72);
add([[974,315],[974,346]],2.64,2.9,1.4,.6);
add([[962,386],[986,386]],2.77,2.97,1.4,.65);
ink([[[877,209],[908,167],[949,164],[974,164]],[[974,164],[999,164],[1040,167],[1071,209]]],2.32,2.8,1,.35);

let frame=0,last=0,elapsed=0,visible=false,done=false,penScale=1;
function configure(target,scale,x,y){
 target.setTransform(scale,0,0,scale,x,y);
 const gradient=target.createLinearGradient(130,0,1100,0);
 gradient.addColorStop(0,'#edf6ff');gradient.addColorStop(.45,'#bcdfff');gradient.addColorStop(1,'#69acf0');
 target.strokeStyle=gradient;target.fillStyle=gradient;
 target.lineCap='round';target.lineJoin='round';
}
function trace(target,s,p){
 let path=s.path;
 if(p<1){
  path=new Path2D();path.moveTo(...s.points[0]);
  const remaining=s.length*p;
  for(let i=1;i<s.points.length;i++){
   if(s.lengths[i]<=remaining)path.lineTo(...s.points[i]);
   else{
    const a=s.points[i-1],b=s.points[i],f=(remaining-s.lengths[i-1])/(s.lengths[i]-s.lengths[i-1]);
    path.lineTo(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f);break;
   }
  }
 }
 if(s.fill&&p===1){target.globalAlpha=s.glow?.8:(s.length<30?.75:.045);target.fill(path);}
 if(s.glow){target.globalAlpha=.13;target.lineWidth=7*penScale;target.stroke(path);}
 target.globalAlpha=s.alpha;target.lineWidth=s.width*penScale;target.stroke(path);
}
function render(t){
 for(const s of strokes)if(t>=s.end&&!s.cached){trace(saved,s,1);s.cached=true;}
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;ctx.drawImage(layer,0,0);ctx.restore();
 for(const s of strokes)if(t>s.start&&t<s.end)trace(ctx,s,(t-s.start)/(s.end-s.start));
}
function finish(){done=true;elapsed=3;render(3);hero.dataset.art='complete';cancelAnimationFrame(frame);frame=0;}
function tick(now){
 frame=0;if(!visible||document.hidden||done)return;
 if(last)elapsed=Math.min(3,elapsed+(now-last)/1000);
 last=now;render(elapsed);
 if(elapsed>=3)finish();else frame=requestAnimationFrame(tick);
}
function resume(){
 if(visible&&!document.hidden&&!done&&!frame){last=0;frame=requestAnimationFrame(tick);}
}
function resize(){
 const {width,height}=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 if(!width||!height)return;
 const w=Math.round(width*dpr),h=Math.round(height*dpr);
 if(w===canvas.width&&h===canvas.height)return;
 canvas.width=layer.width=w;canvas.height=layer.height=h;
 // Frame the artwork tightly without distorting either axis on short screens.
 const scale=Math.min(w/1200,h/440);
 const x=(w-1200*scale)/2,y=(h-440*scale)/2-90*scale;
 penScale=width<600?1.35:1;
 configure(ctx,scale,x,y);configure(saved,scale,x,y);
 strokes.forEach(s=>s.cached=false);render(elapsed);
}
resize();
new ResizeObserver(resize).observe(canvas);
const observer=new IntersectionObserver(entries=>{
 visible=entries[0].isIntersecting;
 if(!visible){cancelAnimationFrame(frame);frame=0;last=0;}else resume();
},{threshold:.05});
observer.observe(canvas);
if(reduce.matches)finish();
reduce.addEventListener('change',()=>{if(reduce.matches)finish();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}else resume();
});
})();
