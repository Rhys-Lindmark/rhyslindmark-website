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

const SENS=.25;   // days per pixel of scroll
const DRIFT=180;  // furthest it ever wanders from today
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

/* Jensen fades up across slide one, reaching half opacity as it ends. */
const jensen=document.querySelector('[data-jensen]'),slideOne=document.querySelector('.lede-one');
if(jensen&&slideOne&&!reduce.matches){
 // Take the file under whatever extension it was saved with; give up quietly if absent.
 const tries=['jensen.jpg','jensen.jpeg','jensen.png','jensen.webp'];let at=0;
 jensen.addEventListener('error',()=>{at++;at<tries.length?jensen.src='/posts/ai2026-pt1/'+tries[at]:jensen.remove();});
 let jraf=0;
 const paintJensen=()=>{
  jraf=0;
  const r=slideOne.getBoundingClientRect(),travel=Math.max(1,r.height-innerHeight);
  const through=Math.min(1,Math.max(0,-r.top/travel));
  // An apparition: nothing at first, up to half opacity near the end of the slide,
  // then gone again before the next one arrives.
  // The text clears early, then he has the black to himself for most of the slide.
  const k=Math.min(1,Math.max(0,(through-.15)/.85));
  // Symmetric: eased in over the first third, held bright through the middle,
  // eased out over the last third.
  const ease=v=>v*v*(3-2*v);
  const env=k<.3?ease(k/.3):k>.7?ease((1-k)/.3):1;
  jensen.style.opacity=String(Math.max(0,env));
 };
 const queueJensen=()=>{if(!jraf)jraf=requestAnimationFrame(paintJensen);};
 addEventListener('scroll',queueJensen,{passive:true});
 addEventListener('resize',queueJensen,{passive:true});
 paintJensen();
}
})();
