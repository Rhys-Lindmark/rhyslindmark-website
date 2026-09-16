/* The lede's "Day N of the singularity" counter.
   It counts up from 1 the first time it scrolls into view, then stays live:
   the number rises as the reader scrolls up, falls as they scroll down, and
   eases back to today's real figure whenever they stop. */
(()=>{
const el=document.querySelector('[data-day-count]');if(!el)return;
const now=new Date(),year=now.getFullYear();
const days=Math.max(1,Math.round((new Date(year,now.getMonth(),now.getDate())-new Date(year,0,1))/864e5));
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const show=v=>{const n=String(Math.max(1,Math.round(v)));if(el.textContent!==n)el.textContent=n;};
if(reduce.matches){show(days);return;}
el.textContent='1';

const SENS=.05;   // days per pixel of scroll
const DRIFT=45;   // furthest it ever wanders from today
const DECAY=.94;  // how fast it settles back once scrolling stops

let offset=0,lastY=window.scrollY,raf=0,live=false;

const settle=()=>{
 raf=0;
 offset*=DECAY;
 if(Math.abs(offset)<.5){offset=0;show(days);return;}
 show(days+offset);
 raf=requestAnimationFrame(settle);
};
const onScroll=()=>{
 const y=window.scrollY,delta=y-lastY;lastY=y;
 if(!live||!delta)return;
 // Scrolling up pushes the count up; scrolling down pulls it down.
 offset=Math.max(-DRIFT,Math.min(DRIFT,offset-delta*SENS));
 show(days+offset);
 if(!raf)raf=requestAnimationFrame(settle);
};
addEventListener('scroll',onScroll,{passive:true});

const countUp=()=>{
 const t0=performance.now(),dur=2600;
 const tick=t=>{
  const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,2.2);
  show(e*days);
  if(k<1)requestAnimationFrame(tick);
  else{live=true;lastY=window.scrollY;}
 };
 requestAnimationFrame(tick);
};

// Wait until the line has cleared the lower quarter of the screen, so the
// opening count does not finish before the reader's eye arrives.
let started=false;
const io=new IntersectionObserver(entries=>{
 if(!entries[0].isIntersecting||started)return;
 started=true;io.disconnect();countUp();
},{threshold:1,rootMargin:'0px 0px -25% 0px'});
io.observe(el);

/* Jensen, briefly, at half opacity as his line goes by. */
const jensen=document.querySelector('[data-jensen]'),jensenLine=document.querySelector('[data-jensen-line]');
if(jensen&&jensenLine&&!reduce.matches){
 jensen.addEventListener('error',()=>jensen.remove());
 let hide=0,cooling=false;
 const flash=()=>{
  if(cooling)return;
  cooling=true;
  jensen.classList.add('is-on');
  clearTimeout(hide);
  hide=setTimeout(()=>{jensen.classList.remove('is-on');cooling=false;},1100);
 };
 new IntersectionObserver(entries=>{if(entries[0].isIntersecting)flash();},
  {rootMargin:'-45% 0px -45% 0px'}).observe(jensenLine);
}
})();
