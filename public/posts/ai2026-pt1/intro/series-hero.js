/* A lightweight, one-shot drawing for the Chips / Models / Agents series. */
(()=>{
const canvas=document.querySelector('#series-hero-canvas');
if(!canvas)return;
const ctx=canvas.getContext('2d');
if(!ctx)return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const strokes=[];
const add=(points,start,end,width=2.2,alpha=1,brush=false)=>strokes.push({points,start,end,width,alpha,brush});
const cubic=(a,b,c,d)=>Array.from({length:49},(_,i)=>{
 const t=i/48,u=1-t;
 return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];
});
const ink=(segments,start,end,width=3,alpha=1)=>add(segments.flatMap((s,i)=>cubic(...s).slice(i?1:0)),start,end,width,alpha,true);
const sq=(x,y,size,start,end)=>add([[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]],start,end,3.5);

// One quiet square opens into a much larger, hand-drawn form.
sq(145,245,130,.04,.46);
ink([[[275,310],[320,310],[342,307],[365,307]]],.43,.73,3.8);

// The model is a braided family of expressive strokes, with loops instead of nodes.
const strands=[
 [[[355,307],[424,283],[442,204],[510,174]],[[510,174],[546,156],[590,184],[572,217]],[[572,217],[545,241],[519,212],[558,188]],[[558,188],[636,132],[705,160],[779,192]]],
 [[[355,307],[429,327],[451,411],[524,428]],[[524,428],[562,439],[592,403],[569,381]],[[569,381],[545,361],[532,392],[576,413]],[[576,413],[641,474],[700,452],[792,399]]],
 [[[365,307],[448,269],[483,329],[538,296]],[[538,296],[582,267],[547,227],[520,263]],[[520,263],[505,289],[581,353],[631,307]],[[631,307],[681,263],[715,229],[786,244]]],
 [[[365,307],[443,348],[479,251],[544,238]],[[544,238],[617,219],[619,330],[677,354]],[[677,354],[721,371],[733,307],[792,295]]],
 [[[377,307],[434,307],[464,348],[504,335]],[[504,335],[564,316],[609,267],[650,222]],[[650,222],[697,177],[732,180],[801,173]]],
 [[[380,307],[449,335],[491,396],[555,376]],[[555,376],[615,355],[655,409],[711,433]],[[711,433],[748,445],[775,421],[819,408]]],
];
strands.forEach((path,i)=>ink(path,.63+i*.07,1.48+i*.06,i%2?2.5:3.6,i%2?.68:.9));
// Delicate secondary pen marks provide depth without restoring a flowchart grid.
ink([[[448,296],[498,151],[632,126],[754,179]]],.85,1.45,1.4,.38);
ink([[[440,327],[501,487],[648,506],[799,441]]],1.0,1.58,1.5,.4);
ink([[[535,310],[602,352],[675,322],[780,285]]],1.2,1.7,1.2,.35);

// The same line becomes one large side-profile face, drawn like a cursive portrait.
ink([
 [[777,218],[794,157],[871,129],[929,164]],
 [[929,164],[965,185],[977,220],[966,252]],
 [[966,252],[962,267],[1007,288],[1028,311]],
 [[1028,311],[1037,321],[1008,329],[990,330]],
 [[990,330],[983,337],[1006,344],[1015,351]],
 [[1015,351],[1006,357],[986,355],[989,365]],
 [[989,365],[1000,376],[988,408],[957,430]],
 [[957,430],[925,454],[897,448],[883,494]],
],1.52,2.66,4.4);
// Hair, ear, brow, eye, cheek, and neck are separate weighted strokes.
ink([[[779,215],[741,265],[751,352],[790,403]],[[790,403],[810,427],[819,462],[798,482]]],1.68,2.62,3,.85);
ink([[[794,260],[812,240],[833,261],[827,292]],[[827,292],[820,328],[788,328],[791,295]]],1.84,2.53,2.6,.8);
ink([[[859,244],[886,229],[920,232],[947,247]]],2.08,2.42,3.4,.85);
ink([[[871,265],[898,253],[924,257],[949,271]],[[949,271],[921,281],[898,282],[871,265]]],2.18,2.62,2.5);
ink([[[919,262],[928,268],[925,276],[918,277]]],2.35,2.6,3.6,.8);
ink([[[858,296],[878,338],[915,343],[947,332]]],2.32,2.75,1.8,.48);
ink([[[884,494],[914,470],[950,489],[997,509]]],2.52,2.94,2.8,.7);
ink([[[798,482],[841,470],[857,495],[868,518]]],2.58,2.97,1.8,.5);
let frame=0,startTime=0,done=false,visible=true;
function drawStroke(s,t){
 const progress=Math.max(0,Math.min(1,(t-s.start)/(s.end-s.start)));
 if(!progress)return;
 const lengths=[];let total=0;
 for(let i=1;i<s.points.length;i++){const d=Math.hypot(s.points[i][0]-s.points[i-1][0],s.points[i][1]-s.points[i-1][1]);lengths.push(d);total+=d;}
 let remain=total*progress,walked=0;
 ctx.globalAlpha=s.alpha;
 for(let i=1;i<s.points.length;i++){
  const d=lengths[i-1];
  if(remain<=0)break;
  const p=s.points[i-1],q=s.points[i],f=Math.min(1,remain/d);
  const u=(walked+d*.5)/total;
  const pressure=s.brush?(0.68+.32*Math.sin(u*17+1.2)**2)*Math.min(1,.35+u*9,.35+(1-u)*9):1;
  ctx.lineWidth=s.width*pressure*(canvas.clientWidth<600?1.5:1);
  ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f);ctx.stroke();
  remain-=d;walked+=d;
 }
}
function render(t){
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
 }
 ctx.setTransform(canvas.width/1200,0,0,canvas.height/620,0,0);
 ctx.clearRect(0,0,1200,620);
 const ink=ctx.createLinearGradient(120,0,1100,0);
 ink.addColorStop(0,'#f3f8fc');ink.addColorStop(.38,'#cdeaff');ink.addColorStop(.72,'#87c4f5');ink.addColorStop(1,'#438fe0');
 ctx.strokeStyle=ink;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#6ebaff';ctx.shadowBlur=2.5;
 for(const stroke of strokes)drawStroke(stroke,t);
 ctx.globalAlpha=1;ctx.shadowBlur=0;
}
function tick(now){
 if(!visible)return;
 if(!startTime)startTime=now;
 const t=Math.min(3,(now-startTime)/1000);
 render(t);
 if(t<3)frame=requestAnimationFrame(tick);else{frame=0;done=true;}
}
const observer=new IntersectionObserver(entries=>{
 visible=entries[0].isIntersecting;
 if(visible&&!done&&!frame&&!reduce.matches)frame=requestAnimationFrame(tick);
 else if(!visible&&frame){cancelAnimationFrame(frame);frame=0;}
},{threshold:.05});
observer.observe(canvas);
if(reduce.matches){render(3);done=true;}
else render(0);
addEventListener('resize',()=>render(done||reduce.matches?3:Math.min(3,(performance.now()-startTime)/1000)),{passive:true});
})();
