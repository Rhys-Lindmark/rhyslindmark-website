/* A lightweight, one-shot drawing for the Chips / Models / Agents series. */
(()=>{
const canvas=document.querySelector('#series-hero-canvas');
if(!canvas)return;
const ctx=canvas.getContext('2d');
if(!ctx)return;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const strokes=[];
const add=(points,start,end,width=2.2,alpha=1)=>strokes.push({points,start,end,width,alpha});
const line=(x1,y1,x2,y2,start,end,width=2.2,alpha=1)=>add([[x1,y1],[x2,y2]],start,end,width,alpha);
const box=(x,y,w,h,start,end,width=2.2)=>add([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],start,end,width);
const circle=(x,y,r,start,end,width=2.2)=>add(Array.from({length:33},(_,i)=>[x+r*Math.cos(i*Math.PI/16),y+r*Math.sin(i*Math.PI/16)]),start,end,width);
const curve=(a,b,start,end,width=2,alpha=1)=>{
 const mid=(a[0]+b[0])/2;
 add(Array.from({length:19},(_,i)=>{const t=i/18,u=1-t;return [u*u*u*a[0]+3*u*u*t*mid+3*u*t*t*mid+t*t*t*b[0],u*u*u*a[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*b[1]];}),start,end,width,alpha);
};
// The chip is deliberately schematic: a few strokes are enough to read at thumbnail size.
box(132,247,124,124,.03,.42,3);
box(150,265,88,88,.18,.49,2);
line(170,298,216,298,.28,.42,1.5,.75);
line(170,317,216,317,.33,.47,1.5,.75);
for(let i=0;i<5;i++){
 const p=263+i*23;
 line(119,p,132,p,.27+i*.025,.48+i*.025,2);
 line(256,p,269,p,.32+i*.025,.53+i*.025,2);
 line(p,234,p,247,.28+i*.025,.49+i*.025,2);
 line(p,371,p,384,.33+i*.025,.54+i*.025,2);
}
// A single expanding trunk leads from hardware into the model.
curve([269,309],[390,309],.5,.93,2.8);
const layers=[
 [[429,246],[429,309],[429,372]],
 [[525,203],[525,256],[525,309],[525,362],[525,415]],
 [[627,162],[627,211],[627,260],[627,309],[627,358],[627,407],[627,456]],
];
for(let j=0;j<layers.length;j++){
 const from=j===0?[[390,309]]:layers[j-1];
 const to=layers[j];
 to.forEach((node,k)=>{
  const nearest=from.reduce((best,p)=>Math.abs(p[1]-node[1])<Math.abs(best[1]-node[1])?p:best,from[0]);
  curve(nearest,node,.83+j*.27+k*.022,1.16+j*.27+k*.022,1.75,.82);
  if(j>0&&k%2===0){const other=from[Math.min(from.length-1,Math.floor(k*from.length/to.length))];if(other!==nearest)curve(other,node,1.03+j*.27+k*.02,1.28+j*.27+k*.02,1.2,.4);}
  circle(node[0],node[1],5,1.02+j*.26+k*.025,1.22+j*.26+k*.025,1.6);
 });
}
// Four branches become twenty small agents, preserving the visual expansion.
const columns=[774,850,926,1002,1078],rows=[165,260,355,450];
rows.forEach((y,r)=>{
 curve([627,rows[r]+(r-1.5)*9],[751,y],1.58+r*.06,1.92+r*.06,1.8,.85);
 for(let c=0;c<columns.length;c++){
  const x=columns[c],when=1.9+r*.08+c*.11;
  if(c)line(columns[c-1]+18,y,x-18,y,when-.1,when+.13,1.4,.46);
  // Rounded, friendly robot face: outline, two eyes, and a short mouth.
  add([[x-18,y-14],[x-13,y-19],[x+13,y-19],[x+18,y-14],[x+18,y+13],[x+13,y+18],[x-13,y+18],[x-18,y+13],[x-18,y-14]],when,when+.3,1.9);
  circle(x-7,y-3,2,when+.1,when+.25,1.45);
  circle(x+7,y-3,2,when+.14,when+.29,1.45);
  line(x-7,y+9,x+7,y+9,when+.2,when+.39,1.35);
 }
});
let frame=0,startTime=0,done=false,visible=true;
function drawStroke(s,t){
 const progress=Math.max(0,Math.min(1,(t-s.start)/(s.end-s.start)));
 if(!progress)return;
 const lengths=[];let total=0;
 for(let i=1;i<s.points.length;i++){const d=Math.hypot(s.points[i][0]-s.points[i-1][0],s.points[i][1]-s.points[i-1][1]);lengths.push(d);total+=d;}
 let remain=total*progress;
 ctx.globalAlpha=s.alpha;ctx.lineWidth=s.width;ctx.beginPath();ctx.moveTo(...s.points[0]);
 for(let i=1;i<s.points.length;i++){
  const d=lengths[i-1];
  if(remain>=d){ctx.lineTo(...s.points[i]);remain-=d;}
  else{const p=s.points[i-1],q=s.points[i],f=d?remain/d:0;ctx.lineTo(p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f);break;}
 }
 ctx.stroke();
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
 ctx.strokeStyle=ink;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#6ebaff';ctx.shadowBlur=5;
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
