(() => {
  'use strict';
  const canvas=document.querySelector('.vortex-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d'),scene=canvas.closest('.spiral');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,visible=false,frame=0,last=0,time=0;
  // Illustrative streamlines: inward radial contraction and axial stretching.
  // This is a visual flow model, not a numerical Navier–Stokes solution.
  function point(u,strand,t) {
    const z=u*2-1, envelope=Math.exp(-3.4*z*z);
    const radius=(.08+.72*envelope)*( .72+.28*Math.sin(strand*12.9898)**2);
    const angle=strand*2.39996+u*19-t*(.38+1.1*(1-envelope));
    const x=radius*Math.cos(angle), depth=radius*Math.sin(angle);
    const scale=Math.min(width*.43,height*.44);
    return {x:width/2+x*scale,y:height/2-z*scale*1.03+depth*scale*.22,depth};
  }
  function render() {
    ctx.clearRect(0,0,width,height);
    const segments=[];
    for(let k=0;k<46;k++) {
      for(let j=0;j<95;j++) {
        const u=j/95,a=point(u,k,time),b=point((j+1)/95,k,time);
        segments.push({a,b,k,u});
      }
    }
    segments.sort((a,b)=>a.a.depth-b.a.depth);
    for(const {a,b,k,u} of segments) {
      const front=(a.depth+1)/2, taper=Math.pow(Math.sin(Math.PI*u),.6);
      ctx.strokeStyle=k%5===0?`hsla(35,80%,${42+front*30}%,${.25+taper*.6})`:`hsla(${k%3===0?185:210},80%,${30+front*40}%,${.2+taper*.62})`;
      ctx.lineWidth=(.5+front*2.3)*taper+.25;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    // Tracers travel through the strands rather than rotating a flat picture.
    for(let k=0;k<46;k++) {
      const u=(k*.618+time*.075)%1,p=point(u,k,time);
      ctx.fillStyle=k%5===0?'#ffd491':'#a3f4ff';
      ctx.beginPath();ctx.arc(p.x,p.y,1.4,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#99b0c1';ctx.font='12px monospace';ctx.textAlign='left';
    ctx.fillText('INWARD SPIRAL',16,height*.52);
    ctx.textAlign='right';ctx.fillText('AXIAL STRETCHING ↑',width-16,68);
  }
  function running(){return visible&&!document.hidden&&!reduce.matches&&!scene.classList.contains('paused');}
  function tick(now){frame=0;if(!running()){last=0;return;}time+=last?Math.min(.05,(now-last)/1000):0;last=now;render();frame=requestAnimationFrame(tick);}
  function sync(){if(running()&&!frame)frame=requestAnimationFrame(tick);else if(!running()){cancelAnimationFrame(frame);frame=0;last=0;}render();}
  new ResizeObserver(()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(2,devicePixelRatio||1);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);sync();}).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(canvas);
  new MutationObserver(sync).observe(scene,{attributes:true,attributeFilter:['class']});
  reduce.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
})();
