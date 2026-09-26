const state = {venues:[], filtered:[], type:'all', selected:null, map:null, clusterLayer:null, markers:[], mobileMap:false};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value) => `$${Number(value).toLocaleString('en-US')}`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeUrl = (value) => { try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; } };
const text = (value) => String(value || '').replace(/\s+/g,' ').trim();

function getFilters(){
  return {
    query:$('#search').value.trim().toLowerCase(),
    maxPrice:Number($('#max-price').value)||null,
    maxBooking:Number($('#max-booking').value)||null,
    guests:Number($('#min-guests').value)||null,
    private:$('#private-only').checked,
    semi:$('#semi-only').checked,
    buyout:$('#buyout-only').checked,
    dropin:$('#dropin-only').checked,
  };
}

function hasActiveFilters(f){return Boolean(f.query || f.maxPrice || f.maxBooking || f.guests || f.private || f.semi || f.buyout || f.dropin || state.type!=='all');}

function matches(v,f){
  if(state.type==='dinner' && !['dinner','both'].includes(v.category))return false;
  if(state.type==='drinks' && !['drinks','both'].includes(v.category))return false;
  if(f.query && ![v.name,v.neighborhood,v.cuisine,v.details,v.address].some(x=>String(x||'').toLowerCase().includes(f.query)))return false;
  if(f.maxPrice && (!v.pricePerHead || v.pricePerHead>f.maxPrice))return false;
  if(f.maxBooking){
    const privacySelected=f.private||f.semi||f.buyout;
    if(privacySelected){
      const pricedRoom=v.rooms?.some(room=>{
        const type=String(room.privacy||'').toLowerCase();
        const allowed=(f.private&&type.startsWith('private'))||(f.semi&&type.startsWith('semi'))||(f.buyout&&/buyout|exclusive/.test(type));
        return allowed&&room.minimum!==null&&room.minimum!==undefined&&room.minimum<=f.maxBooking;
      });
      if(!pricedRoom)return false;
    }else if(!v.fullBookingPrice||v.fullBookingPrice>f.maxBooking)return false;
  }
  if(f.guests && (!v.maxGuests || v.maxGuests<f.guests))return false;
  const selected=[f.private&&v.private,f.semi&&v.semiPrivate,f.buyout&&v.buyout,f.dropin&&v.sources?.includes("Rhys's drop-in map")].filter(Boolean);
  if((f.private||f.semi||f.buyout||f.dropin) && !selected.length)return false;
  return true;
}

function sortVenues(venues){
  const sorted=[...venues];
  switch($('#sort').value){
    case 'price-low':sorted.sort((a,b)=>(a.pricePerHead??Infinity)-(b.pricePerHead??Infinity)||a.name.localeCompare(b.name));break;
    case 'capacity-high':sorted.sort((a,b)=>(b.maxGuests??0)-(a.maxGuests??0)||a.name.localeCompare(b.name));break;
    default:sorted.sort((a,b)=>{
      const score=x=>(x.sources?.some(s=>s.startsWith('Rhys'))?4:0)+(x.pricePerHead?1:0)+(x.rooms?.length?1:0)+(x.image?0.25:0);
      return score(b)-score(a)||a.name.localeCompare(b.name);
    });
  }
  return sorted;
}

function categoryLabel(v){return v.category==='dinner'?'Private dining':v.category==='drinks'?'Drinks & casual':'Dinner & drinks';}
function privacyLabel(v){
  const labels=[];
  if(v.private)labels.push('Private room');
  if(v.semiPrivate)labels.push('Semi-private');
  if(v.buyout)labels.push('Buyout');
  if(v.sources?.includes("Rhys's drop-in map"))labels.push('Drop-in');
  return labels.slice(0,2);
}
function priceLabel(v){return v.pricePerHead?`${money(v.pricePerHead)} / guest`:'Price on request';}

function cardHtml(v){
  const image=v.image?`<img src="${esc(safeUrl(v.image))}" alt="" loading="lazy" onerror="this.parentElement.classList.add('no-image');this.remove()">`:'';
  const tags=privacyLabel(v).map(x=>`<span>${esc(x)}</span>`).join('');
  const summary=text(v.details||v.cuisine||'').slice(0,110);
  return `<article class="venue-card" data-id="${esc(v.id)}" tabindex="0" role="button" aria-label="View ${esc(v.name)} details">
    <div class="card-image ${image?'':'no-image'}">${image}<div class="image-fallback"><span>${esc(v.neighborhood||'San Francisco')}</span><strong>${esc(v.name)}</strong></div><span class="card-category">${esc(categoryLabel(v))}</span></div>
    <div class="card-body"><div class="card-title-row"><h2>${esc(v.name)}</h2>${v.maxGuests?`<span class="guest-count">Up to ${esc(v.maxGuests)}</span>`:''}</div>
      <div class="card-location">${esc(v.neighborhood||'San Francisco')} ${v.cuisine?`· ${esc(v.cuisine.split(/[\/,]/)[0])}`:''}</div>
      <p class="card-summary">${esc(summary)}</p>
      <div class="card-tags">${tags}</div>
      <div class="card-footer"><div><strong>${esc(priceLabel(v))}</strong><small>${v.pricePerHead?esc(v.priceKind?.startsWith('estimated')?'estimated all-in':'starting menu price'):'ask venue for quote'}</small></div><span aria-hidden="true">↗</span></div>
    </div></article>`;
}

function renderCards(){
  $('#cards').innerHTML=state.filtered.map(cardHtml).join('');
  $('#result-count').textContent=`${state.filtered.length} ${state.filtered.length===1?'place':'places'}`;
  $('#empty-state').hidden=state.filtered.length!==0;
  $('#cards').hidden=state.filtered.length===0;
  $$('.venue-card').forEach(card=>{
    card.addEventListener('click',()=>openVenue(card.dataset.id));
    card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openVenue(card.dataset.id);}});
  });
}

function initMap(){
  if(!window.L){$('#map').innerHTML='<div class="map-unavailable">Map unavailable. Browse the list and open a place for directions.</div>';return;}
  state.map=L.map('map',{zoomControl:false,scrollWheelZoom:false}).setView([37.7749,-122.4194],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:18}).addTo(state.map);
  L.control.zoom({position:'bottomright'}).addTo(state.map);
  if(L.markerClusterGroup){
    state.clusterLayer=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:55,disableClusteringAtZoom:15,iconCreateFunction:cluster=>L.divIcon({className:'cluster-wrap',html:`<span class="cluster-pin">${cluster.getChildCount()}</span>`,iconSize:[40,40],iconAnchor:[20,20]})});
    state.map.addLayer(state.clusterLayer);
  }
  renderMap(true);
}

function renderMap(initial=false){
  if(!state.map)return;
  if(state.clusterLayer)state.clusterLayer.clearLayers();
  else state.markers.forEach(marker=>marker.remove());
  state.markers=[];
  const bounds=[];
  for(const v of state.filtered){
    if(!v.lat||!v.lng)continue;
    const label=v.pricePerHead?money(v.pricePerHead):'●';
    const marker=L.marker([v.lat,v.lng],{icon:L.divIcon({className:'price-pin-wrap',html:`<span class="price-pin ${state.selected===v.id?'selected':''} ${v.pricePerHead?'':'pin-dot'}">${esc(label)}</span>`,iconSize:v.pricePerHead?[68,34]:[36,36],iconAnchor:v.pricePerHead?[34,34]:[18,30]})});
    if(state.clusterLayer)state.clusterLayer.addLayer(marker);else marker.addTo(state.map);
    marker.on('click',()=>openVenue(v.id));
    marker.bindTooltip(esc(v.name),{direction:'top',offset:[0,-30],opacity:0.95});
    state.markers.push(marker);bounds.push([v.lat,v.lng]);
  }
  $('#map-counter').textContent=`${state.markers.length} shown on map`;
  if(bounds.length && (initial||state.filtered.length<state.venues.length))state.map.fitBounds(bounds,{padding:[36,36],maxZoom:13,animate:!initial});
}

function roomHtml(room){
  const capacity=room.seated?`<span>${esc(room.seated)} seated</span>`:'';
  const minimum=room.minimum?`<span>${money(room.minimum)} minimum</span>`:'';
  const fee=room.fee?`<span>${money(room.fee)} fee</span>`:'';
  return `<div class="room-card"><div class="room-heading"><strong>${esc(room.name)}</strong><span>${esc(room.privacy)}</span></div><div class="room-facts">${capacity}${minimum}${fee}</div>${room.note?`<p>${esc(room.note)}</p>`:''}${room.source?`<a href="${esc(safeUrl(room.source))}" target="_blank" rel="noopener noreferrer">Room source ↗</a>`:''}</div>`;
}

function openVenue(id){
  const v=state.venues.find(x=>x.id===id);if(!v)return;
  state.selected=id;
  const image=v.image?`<img src="${esc(safeUrl(v.image))}" alt="" onerror="this.parentElement.classList.add('no-image');this.remove()">`:'';
  const site=v.source||v.website;
  const maps=v.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name+' '+v.address)}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name+' San Francisco')}`;
  const hasInquiry=Boolean(v.inquiry||v.website);
  const primaryUrl=hasInquiry?(v.inquiry||v.website):maps;
  const primaryLabel=hasInquiry?'Ask about an event ↗':'View venue listing ↗';
  $('#detail-drawer').innerHTML=`<button class="drawer-close" aria-label="Close details" type="button">×</button><div class="drawer-image ${image?'':'no-image'}">${image}<div class="image-fallback"><span>${esc(v.neighborhood||'San Francisco')}</span><strong>${esc(v.name)}</strong></div></div><div class="drawer-content"><div class="drawer-category">${esc(categoryLabel(v))}</div><h2>${esc(v.name)}</h2><p class="drawer-location">${esc(v.neighborhood||'San Francisco')}${v.cuisine?` · ${esc(v.cuisine)}`:''}</p><div class="drawer-actions"><a href="${esc(safeUrl(primaryUrl))}" target="_blank" rel="noopener noreferrer">${primaryLabel}</a><a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">Directions ↗</a></div><div class="detail-prices"><div><span>Per guest</span><strong>${v.pricePerHead?money(v.pricePerHead):'Quote required'}</strong><small>${esc(v.priceKind||'Ask venue for a menu quote')}</small></div><div><span>Space minimum</span><strong>${v.fullBookingPrice?`${money(v.fullBookingPrice)}+`:'Quote required'}</strong><small>${esc(v.fullBookingKind||'Varies by room and date')}</small></div></div>${v.details?`<p class="drawer-description">${esc(v.details)}</p>`:''}<div class="detail-section"><h3>Spaces & rooms</h3>${v.rooms?.length?v.rooms.map(roomHtml).join(''):`<p class="unknown-rooms">${esc(privacyLabel(v).join(' · ')||'Contact venue for group options')} · ${v.maxGuests?`up to ${esc(v.maxGuests)} guests`: 'capacity on request'}. Ask for current room choices and minimums.</p>`}</div><div class="detail-section"><h3>Sources & verification</h3><p>Last checked: ${esc(v.verified||'September 2026')}. Terms may have changed.</p>${site?`<a href="${esc(safeUrl(site))}" target="_blank" rel="noopener noreferrer">View venue information ↗</a>`:''}</div></div>`;
  $('#drawer-backdrop').hidden=false;
  $('#detail-drawer').classList.add('open');$('#detail-drawer').setAttribute('aria-hidden','false');
  document.body.classList.add('drawer-open');
  $('#detail-drawer .drawer-close').addEventListener('click',closeVenue);
  history.replaceState(null,'',`${location.pathname}?venue=${encodeURIComponent(v.id)}`);
  renderMap();
}

function closeVenue(){
  state.selected=null;$('#detail-drawer').classList.remove('open');$('#detail-drawer').setAttribute('aria-hidden','true');
  $('#drawer-backdrop').hidden=true;document.body.classList.remove('drawer-open');
  history.replaceState(null,'',location.pathname);
  renderMap();
}

function applyFilters(){
  const f=getFilters();state.filtered=sortVenues(state.venues.filter(v=>matches(v,f)));
  $('#clear-filters').hidden=!hasActiveFilters(f);
  $('#result-context').textContent=f.query?` matching “${f.query}”`:' in San Francisco';
  renderCards();renderMap();
}

function clearFilters(){
  $('#search').value='';$('#max-price').value='';$('#max-booking').value='';$('#min-guests').value='';
  ['#private-only','#semi-only','#buyout-only','#dropin-only'].forEach(s=>$(s).checked=false);
  state.type='all';$$('.type-tab').forEach(tab=>{const active=tab.dataset.type==='all';tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',active);});
  applyFilters();
}

function closePopovers(){
  $$('.filter-popover').forEach(panel=>panel.hidden=true);
  $$('.filter-button').forEach(button=>button.setAttribute('aria-expanded','false'));
}

function sizeMobileMap(){
  const header=$('.site-header').getBoundingClientRect().height;
  const controls=$('.controls').getBoundingClientRect().height;
  document.body.style.setProperty('--mobile-header-height',`${header}px`);
  document.body.style.setProperty('--mobile-map-top',`${header+controls}px`);
  state.map?.invalidateSize();
}

function wireEvents(){
  $$('.type-tab').forEach(tab=>tab.addEventListener('click',()=>{state.type=tab.dataset.type;$$('.type-tab').forEach(t=>{const active=t===tab;t.classList.toggle('active',active);t.setAttribute('aria-pressed',active);});applyFilters();}));
  ['#search','#max-price','#max-booking','#min-guests'].forEach(s=>$(s).addEventListener('input',applyFilters));
  ['#private-only','#semi-only','#buyout-only','#dropin-only','#sort'].forEach(s=>$(s).addEventListener('change',applyFilters));
  $('#clear-filters').addEventListener('click',clearFilters);$('#empty-clear').addEventListener('click',clearFilters);
  $$('.filter-button').forEach(button=>button.addEventListener('click',()=>{const panel=$(`#${button.dataset.opens}`),opening=panel.hidden;closePopovers();panel.hidden=!opening;button.setAttribute('aria-expanded',String(opening));}));
  $$('.popover-close').forEach(button=>button.addEventListener('click',closePopovers));
  document.addEventListener('click',event=>{if(!event.target.closest('.filter-popover,.filter-button'))closePopovers();});
  $('#drawer-backdrop').addEventListener('click',closeVenue);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closePopovers();if(state.selected)closeVenue();}});
  $('#mobile-map-toggle').addEventListener('click',()=>{state.mobileMap=!state.mobileMap;sizeMobileMap();document.body.classList.toggle('show-mobile-map',state.mobileMap);$('#mobile-map-toggle').innerHTML=state.mobileMap?'<span aria-hidden="true">☷</span> Show list':'<span aria-hidden="true">⌖</span> Show map';$('#mobile-map-toggle').setAttribute('aria-pressed',state.mobileMap);setTimeout(sizeMobileMap,100);});
  window.addEventListener('resize',()=>{if(state.mobileMap)sizeMobileMap();});
  const dialog=$('#about-dialog');$('#about-data').addEventListener('click',()=>dialog.showModal());$('#about-dialog .dialog-close').addEventListener('click',()=>dialog.close());
}

async function init(){
  wireEvents();
  try{
    const response=await fetch('/data/sf-hosting.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();state.venues=data.venues;$('#total-count').textContent=state.venues.length;
    applyFilters();initMap();
    const selected=new URLSearchParams(location.search).get('venue');if(selected)openVenue(selected);
  }catch(error){
    $('#result-count').textContent='Places could not load';$('#cards').innerHTML='<div class="load-error">Please refresh the page to try again.</div>';
    console.error('SF Hosting data failed to load',error);
  }
}
init();
