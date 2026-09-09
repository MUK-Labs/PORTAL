import { fetchJSON, normaliseProject, normaliseEvents, safeURL, selectEvents, eventState, eventTimeLabel, viennaFormat } from './core.mjs';
import { mountField } from './field.mjs';
const $ = selector => document.querySelector(selector);
const base = new URL('../', import.meta.url);
const registryURL = new URL('data/projects.json', base);
let projects = [], filter = 'all', events = [], eventView = 'upcoming';
const frames = new Map();
let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
try { const p=localStorage.getItem('prl:motion'); if(p!==null)motion=p==='on'; } catch {}
const element = (tag, className, content) => { const node=document.createElement(tag); if(className)node.className=className;if(content!=null)node.textContent=content;return node; };
function link(label, href, className='text-link') { const a=element('a',className,label);a.href=href;return a; }
function message(host, title, copy) { host.replaceChildren();const p=element('p','empty-state');if(title)p.append(element('strong','',title));p.append(document.createTextNode(copy));host.append(p);return p; }
function notifyFrames() {
  for (const [frame, record] of frames) frame.contentWindow?.postMessage({type:'prl:visibility',token:record.token,active:record.visible&&!document.hidden&&motion},'*');
}
window.addEventListener('prl:motion', e=>{motion=e.detail.running;notifyFrames();});
document.addEventListener('visibilitychange',()=>{notifyFrames();if(!document.hidden)renderEvents();});
window.addEventListener('message',e=>{
  for(const [frame,record] of frames){
    if(e.source!==frame.contentWindow||e.data?.token!==record.token)continue;
    if(e.data.type==='prl:ready'){clearTimeout(record.timer);record.note.textContent='Interactive sketch supplied by the project. Open the full app above for MIDI and audio.';}
    if(e.data.type==='prl:resize'&&Number.isFinite(e.data.height))frame.style.height=`${Math.max(180,Math.min(520,e.data.height))}px`;
  }
});
function destroyFrames(){for(const [frame,r] of frames){r.observer.disconnect();clearTimeout(r.timer);frame.remove();}frames.clear();}
function togglePreview(project, card, button) {
  const existing=card.querySelector('.embed-region');
  if(existing){const frame=existing.querySelector('iframe');frames.get(frame)?.observer.disconnect();clearTimeout(frames.get(frame)?.timer);frames.delete(frame);existing.remove();button.textContent='Load interactive preview ▷';button.setAttribute('aria-expanded','false');return;}
  const region=element('div','embed-region'), frame=document.createElement('iframe');
  const token=crypto.randomUUID(), url=new URL(project.embed);
  url.searchParams.set('prlToken',token);url.searchParams.set('motion',motion?'on':'off');url.searchParams.set('embed','1');
  frame.title=`${project.title} — interactive preview`;
  // Opaque origin, no parent access, no popups, forms, navigation or hardware permissions.
  frame.setAttribute('sandbox','allow-scripts');
  frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; midi 'none'; autoplay 'none'");
  frame.referrerPolicy='no-referrer';frame.loading='lazy';frame.src=url.href;
  const observer=new IntersectionObserver(entries=>{const record=frames.get(frame);if(record){record.visible=entries[0].isIntersecting;notifyFrames();}},{threshold:.01});
  const note=element('p','','Loading the project preview…');
  const timer=setTimeout(()=>{note.textContent='No ready signal from this preview. If it is blank, use Open project above.';},10000);
  frames.set(frame,{token,observer,visible:true,note,timer});observer.observe(frame);frame.addEventListener('load',notifyFrames);
  region.append(frame,note);
  card.append(region);button.textContent='Close preview ×';button.setAttribute('aria-expanded','true');
}
function renderProjects() {
  destroyFrames();
  const grid=$('#projects-grid');grid.replaceChildren();
  const shown=projects.filter(p=>filter==='all'||p.category.toLowerCase()===filter||p.tags.some(t=>t.toLowerCase()===filter));
  $('#project-count').textContent=`${String(shown.length).padStart(2,'0')} projects`;
  for(const p of shown){
    const card=element('article','project-card');card.dataset.project=p.id;card.dataset.source=p.source||'manifest';
    const visual=element('div','project-visual');
    if(p.preview){const img=document.createElement('img');img.src=p.preview;img.alt=p.previewAlt;img.width=600;img.height=380;img.loading='lazy';img.addEventListener('error',()=>img.remove(),{once:true});visual.append(img);}
    visual.append(element('span','project-number',`${String(projects.indexOf(p)+1).padStart(2,'0')} / EXPLORE`),element('span','project-format',p.format));
    const content=element('div','project-content');
    content.append(element('p','project-category',p.category+(p.status?` / ${p.status}`:'')),element('h3','',p.title),element('p','project-summary',p.description));
    const tags=element('div','project-tags');for(const t of p.tags)tags.append(element('span','',t));content.append(tags);
    if(p.people.length)content.append(element('p','project-people',p.people.join(' · ')));
    const actions=element('div','project-actions');actions.append(link('Open project ↗',p.project||p.repository));
    if(p.repository&&p.repository!==p.project)actions.append(link('Source ↗',p.repository,'repo-link'));
    if(p.documentation)actions.append(link('Documentation ↗',p.documentation,'repo-link'));
    if(p.publication)actions.append(link('Publication ↗',p.publication,'repo-link'));
    if(p.embed){const button=element('button','preview-toggle','Load interactive preview ▷');button.type='button';button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>togglePreview(p,card,button));actions.append(button);}
    content.append(actions);card.append(visual,content);grid.append(card);
  }
  if(!shown.length)message(grid,'More explorations to come.','No projects match this filter yet.');
  grid.setAttribute('aria-busy','false');
}
async function loadProjects(){
  const grid=$('#projects-grid'),notice=$('#project-notice');
  try{
    const registry=await fetchJSON(registryURL);
    if(!Array.isArray(registry.projects)||registry.projects.length>100)throw new Error('Invalid project registry');
    const ids=new Set(),active=registry.projects.filter(e=>e.enabled!==false);
    for(const e of active){if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(e.id)||ids.has(e.id))throw new Error('Project ids must be valid and unique');ids.add(e.id);}
    const failures=[];
    const resolved=await Promise.all(active.map(async entry=>{
      const manifest=safeURL(entry.manifest,registryURL);
      if(manifest)try{
        const raw=await fetchJSON(manifest,{timeout:6500,maxBytes:65536});
        const p=normaliseProject(raw,manifest,entry.id);
        return {...p,documentation:safeURL(raw.documentation,manifest),source:'manifest'};
      }catch(error){console.info(`[portal] ${entry.id}: ${error.message}`);}
      failures.push(entry);
      try{return {...normaliseProject(entry.fallback,registryURL,entry.id),source:'fallback'};}catch{return null;}
    }));
    projects=resolved.filter(Boolean);renderProjects();
    if(!projects.length&&active.length)message(grid,'The collection is temporarily unavailable.','Please reload, or open the projects directly below.');
    if(failures.length){
      notice.hidden=false;notice.replaceChildren(document.createTextNode('Some project metadata could not be loaded. '));
      for(const e of failures){const manifest=safeURL(e.manifest,registryURL);if(manifest)notice.append(link(`Open ${e.id} ↗`,new URL('../',manifest).href),document.createTextNode('  '));}
    }
  }catch(error){message(grid,'The collection could not be loaded.','Please reload the page or open the source repository linked below.');grid.setAttribute('aria-busy','false');console.warn(error);}
}
function renderEvents(){
  const host=$('#events-list');if(!host||host.getAttribute('aria-busy')==='true')return;
  const shown=selectEvents(events,eventView);host.replaceChildren();
  if(!shown.length){
    const copy=eventView==='upcoming'?'New dates will appear here as they are announced. ':'There are no archived events in this feed yet.';
    const p=message(host,eventView==='upcoming'?'A little quiet, for now.':'The story is just beginning.',copy);
    if(eventView==='upcoming'&&selectEvents(events,'past').length){const b=element('button','','Explore the archive ↗');b.type='button';b.addEventListener('click',()=>setEventView('past'));p.append(b);}
    return;
  }
  for(const event of shown){
    const row=element('article','event-row'), date=element('div','event-date');
    const time=element('time','');time.dateTime=new Date(event.start).toISOString();time.append(element('strong','',viennaFormat(event.start,{day:'2-digit'})));date.append(time,element('span','',viennaFormat(event.start,{month:'short',year:'numeric'})));
    const body=element('div','event-main'), state=eventState(event);
    body.append(element('p','event-kind',[event.kind,event.status||(state==='ongoing'?'Happening now':'')].filter(Boolean).join(' · ')),element('h3','',event.title));
    const details=[eventTimeLabel(event),event.location].filter(Boolean);
    if(event.allDay&&event.end-event.start>26*3600000)details.unshift(`Until ${viennaFormat(event.end-1,{day:'numeric',month:'short',year:'numeric'})}`);
    body.append(element('p','event-details',details.join(' · ')));
    if(event.description)body.append(element('p','event-description',event.description));
    row.append(date,body);if(event.url)row.append(link(`${event.linkLabel} ↗`,event.url));host.append(row);
  }
}
function setEventView(view){eventView=view;document.querySelectorAll('#event-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));renderEvents();}
async function loadEvents(){
  const host=$('#events-list');
  try{const url=new URL('data/events.json',base),payload=await fetchJSON(url);events=normaliseEvents(payload,url);host.setAttribute('aria-busy','false');renderEvents();
    if(payload.feed?.state==='fallback'){const note=$('#events-note');note.hidden=false;note.textContent='The external feed could not be refreshed at the last build. These are the saved local listings; please check the event details before visiting.';}
  }catch(error){host.setAttribute('aria-busy','false');message(host,'Events are temporarily unavailable.','Please check the MUK website for current announcements.');console.warn(error);}
}
$('#filters').addEventListener('click',e=>{const button=e.target.closest('button[data-filter]');if(!button)return;filter=button.dataset.filter;document.querySelectorAll('#filters button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderProjects();});
$('#event-filters').addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(b)setEventView(b.dataset.view);});
mountField($('#signal-field'),$('#field'),$('#motion-toggle'));
loadProjects();loadEvents();
setInterval(()=>{if(!document.hidden)renderEvents();},60000);
