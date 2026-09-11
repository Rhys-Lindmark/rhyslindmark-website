(()=>{
'use strict';
const NS='http://www.w3.org/2000/svg',background='#070b10',signatureURL='/posts/ai2026-pt1/rhys-signature.png';
const styleKeys=['color','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','visibility','display','font-family','font-size','font-weight','font-style','font-variant','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','text-decoration','paint-order','clip-path','clip-rule','mask','filter','stop-color','stop-opacity','flood-color','flood-opacity','vector-effect','shape-rendering','text-rendering','transform','transform-origin','transform-box'];
function localReferences(value){return value.replace(/url\(["']?[^)"']*#([^\s)"']+)["']?\)/g,'url(#$1)');}
function visible(node){if(!node||node.closest('[hidden]'))return false;for(let n=node;n instanceof Element;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;}
function prose(node){if(!node)return '';const clone=node.cloneNode(true);clone.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));return clone.textContent.replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').trim();}
function passageFor(scene){
 const candidates=[...scene.querySelectorAll('.passage h2[data-passage], .passage > h2, .passage > p[data-passage]')],active=candidates.find(n=>visible(n));
 if(active)return active;
 if(scene.classList.contains('chart-only')){let previous=scene.previousElementSibling;while(previous&&!previous.classList.contains('scene'))previous=previous.previousElementSibling;return previous?.querySelector('.passage h2, .passage p')||null;}
 return null;
}
function snapshot(svg,figure){
 const scene=figure.closest('.scene'),passage=passageFor(scene),box=svg.viewBox.baseVal,rect=svg.getBoundingClientRect(),width=box.width||rect.width,height=box.height||rect.height;
 if(!(width>0&&height>0)||!svg.children.length)throw new Error('This chart is still loading. Please try again in a moment.');
 const clone=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
 originals.forEach((node,i)=>{const style=getComputedStyle(node);for(const key of styleKeys){const value=style.getPropertyValue(key);if(value)copies[i].style.setProperty(key,localReferences(value));}copies[i].style.setProperty('animation','none');copies[i].style.setProperty('transition','none');});
 clone.setAttribute('xmlns',NS);clone.setAttribute('width',width);clone.setAttribute('height',height);clone.style.width=`${width}px`;clone.style.height=`${height}px`;clone.style.maxWidth='none';
 if(!box.width)clone.setAttribute('viewBox',`0 0 ${width} ${height}`);
 // Only self-contained SVG resources may be rasterized into a downloadable image.
 for(const image of clone.querySelectorAll('image')){const href=image.getAttribute('href')||image.getAttribute('xlink:href')||'';if(href&&!href.startsWith('data:')&&!href.startsWith('#'))throw new Error('This chart contains an image that cannot be exported yet.');}
 const legends=[...figure.querySelectorAll('.legend span')].filter(visible).map(n=>{const marker=n.querySelector('i'),s=marker?getComputedStyle(marker):null;return {text:prose(n),color:s?.getPropertyValue('--color').trim()||s?.borderTopColor||getComputedStyle(n).color,bar:!!s&&parseFloat(s.height)>parseFloat(s.width),dashed:s?.borderTopStyle==='dashed'};});
 const caption=figure.querySelector('figcaption'),sourceText=prose(caption),sources=caption?[...caption.querySelectorAll('a[href]')].map(a=>`${prose(a)}: ${a.href}`):[];
 const rawStep=scene.dataset.currentStep||passage?.dataset.passage||scene.dataset.step||scene.id,step=String(Math.floor(Number(rawStep)))||rawStep;
 return {xml:new XMLSerializer().serializeToString(clone),width,height,text:prose(passage),legends,sources:sources.length?sources:sourceText?[sourceText]:[],step,url:`https://www.rhyslindmark.com/posts/ai2026-pt1/#${encodeURIComponent(step)}`,title:prose(svg.querySelector('title'))||svg.getAttribute('aria-label')||'Chart'};
}
function imageFrom(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The chart image could not be prepared. Please try again.'));image.src=url;});}
function wrap(ctx,value,width){const lines=[];for(const paragraph of value.split('\n')){if(!paragraph){lines.push('');continue;}let line='';for(const word of paragraph.split(/\s+/)){if(ctx.measureText(line?`${line} ${word}`:word).width<=width){line=line?`${line} ${word}`:word;continue;}if(line)lines.push(line);line='';for(const letter of word){if(line&&ctx.measureText(line+letter).width>width){lines.push(line);line='';}line+=letter;}}lines.push(line);}return lines;}
function jpegBlob(canvas){return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Your browser could not create the JPG. Please try again.')),'image/jpeg',.94);}catch(error){reject(new Error('Your browser could not export this chart as a JPG.'));}});}
async function renderJPG(shot){
 const svgURL=URL.createObjectURL(new Blob([shot.xml],{type:'image/svg+xml;charset=utf-8'}));let chart,signature;
 try{[chart,signature]=await Promise.all([imageFrom(svgURL),imageFrom(signatureURL)]);}finally{URL.revokeObjectURL(svgURL);}
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser does not support chart image export.');
 const w=shot.width,h=shot.height,pad=Math.max(10,w*.015),font=Math.max(10,Math.min(15,w*.022)),lineHeight=font*1.45;
 ctx.font=`${font}px system-ui, sans-serif`;
 let legendX=pad,legendY=pad;const legendItems=[];
 for(const item of shot.legends){const lines=wrap(ctx,item.text,Math.max(30,w-pad*2-28)),itemWidth=Math.min(w-pad*2,ctx.measureText(item.text).width+42);if(legendX>pad&&legendX+itemWidth>w-pad){legendX=pad;legendY+=lineHeight+8;}legendItems.push({...item,x:legendX,y:legendY,lines});legendX+=itemWidth; if(lines.length>1){legendX=pad;legendY+=lines.length*lineHeight+8;}}
 const legendHeight=legendItems.length?legendY+lineHeight+pad:0,footerLines=shot.sources.flatMap(s=>wrap(ctx,s,w-pad*2)),urlLines=wrap(ctx,shot.url,w-pad*2),footerHeight=pad*2+(footerLines.length+urlLines.length)*lineHeight,totalHeight=h+legendHeight+footerHeight;
 const scale=Math.min(Math.max(1.5,1800/w),2800/w,5200/totalHeight);canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(totalHeight*scale);ctx.scale(scale,scale);ctx.fillStyle=background;ctx.fillRect(0,0,w,totalHeight);ctx.drawImage(chart,0,0,w,h);
 if(shot.text){
  const boxWidth=Math.min(360,w*.35),innerPad=Math.max(8,boxWidth*.07);let textSize=Math.max(10,Math.min(19,w*.028)),lines;
  do{ctx.font=`${textSize}px system-ui, sans-serif`;lines=wrap(ctx,shot.text,boxWidth-innerPad*2);if(lines.length*textSize*1.45+innerPad*2<=h-pad*2||textSize<=8)break;textSize-=1;}while(true);
  const boxHeight=lines.length*textSize*1.45+innerPad*2;ctx.fillStyle='#0f1821';ctx.fillRect(pad,pad,boxWidth,boxHeight);ctx.strokeStyle='#526a7a';ctx.lineWidth=1;ctx.strokeRect(pad,pad,boxWidth,boxHeight);ctx.fillStyle='#fff';ctx.textBaseline='top';lines.forEach((line,i)=>ctx.fillText(line,pad+innerPad,pad+innerPad+i*textSize*1.45));
 }
 const signatureWidth=Math.min(150,w*.16),signatureHeight=signatureWidth*signature.naturalHeight/signature.naturalWidth;ctx.drawImage(signature,w-pad-signatureWidth,pad,signatureWidth,signatureHeight);
 ctx.font=`${font}px system-ui, sans-serif`;ctx.textBaseline='top';
 for(const item of legendItems){const y=h+item.y;ctx.strokeStyle=item.color;ctx.fillStyle=item.color;ctx.lineWidth=item.bar?5:2;ctx.setLineDash(item.dashed?[4,3]:[]);ctx.beginPath();if(item.bar){ctx.moveTo(item.x+7,y+2);ctx.lineTo(item.x+7,y+font);}else{ctx.moveTo(item.x,y+font/2);ctx.lineTo(item.x+18,y+font/2);}ctx.stroke();ctx.setLineDash([]);item.lines.forEach((line,i)=>ctx.fillText(line,item.x+26,y+i*lineHeight));}
 const footerY=h+legendHeight;ctx.strokeStyle='#2a3a47';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad,footerY);ctx.lineTo(w-pad,footerY);ctx.stroke();ctx.fillStyle='#9aafbf';[...footerLines,...urlLines].forEach((line,i)=>ctx.fillText(line,pad,footerY+pad+i*lineHeight));
 return jpegBlob(canvas);
}
function makeDialog(button,shot){
 const dialog=document.createElement('dialog');dialog.className='chart-share-dialog';dialog.setAttribute('aria-label','Share chart image');
 const close=document.createElement('button');close.type='button';close.className='chart-share-close';close.textContent='Close';
 const status=document.createElement('p');status.className='chart-share-status';status.setAttribute('role','status');status.textContent='Preparing JPG…';
 const preview=document.createElement('img');preview.className='chart-share-preview';preview.alt=`${shot.title}. ${shot.text}`;preview.hidden=true;
 const actions=document.createElement('div');actions.className='chart-share-actions';dialog.append(close,status,preview,actions);document.body.appendChild(dialog);
 let blobURL='',disposed=false;
 function cleanup(){if(disposed)return;disposed=true;if(blobURL)URL.revokeObjectURL(blobURL);dialog.remove();button.focus();}
 close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',cleanup);dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.showModal();
 return {show(blob){if(disposed)return;blobURL=URL.createObjectURL(blob);preview.src=blobURL;preview.hidden=false;status.textContent='Your JPG is ready.';const filename=`rhys-ai2026-${shot.step}.jpg`,download=document.createElement('a');download.href=blobURL;download.download=filename;download.textContent='Download JPG';actions.appendChild(download);
  if(typeof File==='function'&&typeof navigator.canShare==='function'&&typeof navigator.share==='function'){const file=new File([blob],filename,{type:'image/jpeg'});let supported=false;try{supported=navigator.canShare({files:[file]});}catch(error){}if(supported){const share=document.createElement('button');share.type='button';share.textContent='Share JPG';share.addEventListener('click',async()=>{share.disabled=true;try{await navigator.share({files:[file],title:shot.title});status.textContent='Image shared.';}catch(error){status.textContent=error.name==='AbortError'?'Your JPG is ready.':'Sharing was unavailable. Use Download JPG instead.';}finally{share.disabled=false;}});actions.appendChild(share);}}
 },error(error){if(!disposed)status.textContent=error.message||'Could not create the JPG. Please try again.';}};
}
for(const svg of document.querySelectorAll('.scene figure .plot-wrap svg, .benchmark-figure svg')){
 const figure=svg.closest('figure');if(!figure||figure.querySelector('.chart-share-button'))continue;
 figure.classList.add('shareable-chart');const button=document.createElement('button');button.type='button';button.className='chart-share-button';button.setAttribute('aria-label','Share this chart as a JPG');button.title='Share chart';button.textContent='↗';figure.appendChild(button);
 button.addEventListener('click',async()=>{
  let shot;try{shot=snapshot(svg,figure);}catch(error){const status=document.createElement('span');status.className='chart-share-status';status.setAttribute('role','alert');status.textContent=error.message;figure.querySelector('.chart-share-status')?.remove();figure.appendChild(status);return;}
  figure.querySelector('.chart-share-status')?.remove();const dialog=makeDialog(button,shot);try{dialog.show(await renderJPG(shot));}catch(error){dialog.error(error);}
 });
}
})();
