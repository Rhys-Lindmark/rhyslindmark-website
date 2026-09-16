/* Counts the lede's "Day N of the singularity" up from 1 when it scrolls into view. */
(()=>{
const el=document.querySelector('[data-day-count]');if(!el)return;
const now=new Date(),year=now.getFullYear();
const days=Math.max(1,Math.round((new Date(year,now.getMonth(),now.getDate())-new Date(year,0,1))/864e5));
el.textContent='1';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const settle=()=>{el.textContent=String(days);};
if(reduce.matches){settle();return;}
let started=false;
const run=()=>{
 const t0=performance.now(),dur=1800;
 const tick=t=>{
  const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);
  el.textContent=String(Math.max(1,Math.round(e*days)));
  if(k<1)requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
};
const io=new IntersectionObserver(entries=>{
 if(!entries[0].isIntersecting||started)return;
 started=true;io.disconnect();run();
},{threshold:.6});
io.observe(el);
})();
