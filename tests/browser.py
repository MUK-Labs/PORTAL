"""Browser tests under /PORTAL/, real project endpoints and simulated microphone input.
The registry determines project count/order; new entries receive generic live checks.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import tempfile
import threading
import shutil
from urllib.request import urlopen
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'test-results'
OUTPUT.mkdir(exist_ok=True)
REGISTRY=json.loads((ROOT/'data/projects.json').read_text())
ENTRIES=[e for e in REGISTRY['projects'] if e.get('enabled') is not False]
IDS=[e['id'] for e in ENTRIES]
COUNT=len(IDS)
NAMES={'pianorules':'PianoRules','tesserakt':'Tesserakt 2.0','klavier':'Expressive Performance Lab','stargaze':'Stargaze','tutor':'Tutor'}

def fixture(entry,url):
    name=NAMES.get(entry['id'],entry['id'])
    return {'version':1,'title':name,'description':'Test fixture only.',
        'category':'learning' if entry['id'] in ('tutor','klavier') else 'performance',
        'tags':['Performance'] if entry['id']=='klavier' else [],
        'project':'../','preview':url+'templates/portal/preview.svg',
        'embed':url+'templates/portal/','people':['Fixture author']}

def fixture_names(category=None):
    result=[]
    for entry in ENTRIES:
        f=fixture(entry,'https://example.org/')
        if not category or f['category']==category or category in [t.lower() for t in f['tags']]:result.append(f['title'])
    return result

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

def fixture_routes(page,url):
    for entry in ENTRIES:
        def respond(route,entry=entry):
            route.fulfill(content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(fixture(entry,url)))
        page.route(entry['manifest'],respond)

# Fail explicitly on missing publication, rather than presenting a fixture as live.
public={}
manifest_report=[]
for entry in ENTRIES:
    try:
        with urlopen(entry['manifest'],timeout=20) as response:
            raw=response.read(65537)
            if len(raw)>65536:raise ValueError('Manifest exceeds 64 KiB')
            public[entry['id']]=json.loads(raw)
            manifest_report.append({'id':entry['id'],'url':entry['manifest'],'status':response.status,
                'cors':response.headers.get('Access-Control-Allow-Origin'),'title':public[entry['id']].get('title')})
    except Exception as error:
        manifest_report.append({'id':entry['id'],'url':entry['manifest'],'error':str(error)})
(OUTPUT/'project-endpoints.json').write_text(json.dumps(manifest_report,indent=2)+'\n')
print('PUBLIC PROJECT ENDPOINTS:',json.dumps(manifest_report),flush=True)
assert all('error' not in r for r in manifest_report),'Publish each project portal/ folder before deploying the registry; see project-endpoints.json'

with tempfile.TemporaryDirectory() as temp:
    shutil.copytree(ROOT/'_site',Path(temp)/'PORTAL')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=temp))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/PORTAL/'
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.getenv('CHROME_BIN'),args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
        errors=[]
        def watch(page):
            def error(e):
                errors.append(str(e));print('BROWSER ERROR:',e,flush=True)
            page.on('pageerror',error)
            page.on('console',lambda m:print('CONSOLE ERROR:',m.text,flush=True) if m.type=='error' else None)
        context=browser.new_context(viewport={'width':1440,'height':1000},timezone_id='America/New_York')
        page=context.new_page();watch(page);fixture_routes(page,url)
        page.add_init_script("window.__micRequests=0;const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(options)=>{window.__micRequests++;window.__micStream=await original(options);return window.__micStream;};")
        page.goto(url)
        expect(page.locator('.project-card')).to_have_count(COUNT)
        expect(page.locator('#project-count')).to_have_text(f'{COUNT:02d} projects')
        expect(page.locator('.project-card h3')).to_have_text(fixture_names())
        assert page.locator('iframe').count()==0
        assert page.evaluate('window.__micRequests')==0
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.locator('#field').evaluate('(el)=>el.getBoundingClientRect().width >= innerWidth*.98')
        page.locator('#field-pulse').click();page.locator('#field-remix').click()
        page.locator('#microphone-toggle').click()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','live')
        page.locator('#microphone-toggle').click()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','off')
        assert page.evaluate('window.__micStream.getTracks().every(t=>t.readyState==="ended")')
        page.locator('#microphone-toggle').click()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','live')
        page.get_by_role('button',name='Pause generative graphics').click()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','off')
        assert page.evaluate('window.__micStream.getTracks().every(t=>t.readyState==="ended")')
        page.get_by_role('button',name='Enable generative graphics').click();page.locator('#microphone-toggle').click()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','live')
        page.locator('#lab').scroll_into_view_if_needed()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','off')
        assert page.evaluate('window.__micStream.getTracks().every(t=>t.readyState==="ended")')
        for category in ['Performance','Learning']:
            page.get_by_role('button',name=category,exact=True).click()
            expected=fixture_names(category.lower())
            expect(page.locator('.project-card')).to_have_count(len(expected))
            expect(page.locator('.project-card h3')).to_have_text(expected)
        page.get_by_role('button',name='All projects',exact=True).click()
        page.get_by_role('button',name='Archive',exact=True).click()
        expect(page.locator('.event-row')).to_have_count(1)
        assert '10:00–16:30' in page.locator('.event-row').inner_text()
        page.get_by_role('button',name='Pause generative graphics').click()
        page.reload();expect(page.locator('#motion-toggle')).to_have_attribute('aria-pressed','false')
        expect(page.locator('#microphone-toggle')).to_be_disabled()
        page.set_viewport_size({'width':375,'height':812});page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUTPUT/'mobile-fixture.png'),full_page=True)
        page.goto(url+'privacy.html');expect(page.locator('h1')).to_have_text('Privacy & credits.')
        context.close()
        context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
        page=context.new_page();fixture_routes(page,url)
        page.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('storage disabled')}})")
        page.goto(url);expect(page.locator('.project-card')).to_have_count(COUNT)
        expect(page.locator('#motion-toggle')).to_have_attribute('aria-pressed','false')
        expect(page.locator('#microphone-toggle')).to_be_disabled();context.close()
        context=browser.new_context();page=context.new_page();fixture_routes(page,url)
        page.add_init_script("navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}")
        page.goto(url);page.locator('#microphone-toggle').click()
        expect(page.locator('#signal-field')).to_have_attribute('data-microphone','error')
        expect(page.locator('#field-status')).to_contain_text('permission declined');context.close()
        context=browser.new_context();page=context.new_page();watch(page)
        registry={'projects':[{'id':'fixture','manifest':'https://project.example/portal/metadata.json'}]}
        manifest={'version':1,'title':'<img onerror=alert(1)>','project':url,'embed':url+'templates/portal/','repository':'javascript:alert(1)'}
        page.route('**/data/projects.json',lambda route:route.fulfill(content_type='application/json',body=json.dumps(registry)))
        page.route('https://project.example/portal/metadata.json',lambda route:route.fulfill(content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(manifest)))
        page.goto(url);expect(page.locator('.project-card h3')).to_have_text('<img onerror=alert(1)>')
        assert page.locator('.project-card h3 img').count()==0
        assert page.locator('.repo-link').count()==0
        page.get_by_role('button',name='Load interactive preview').click()
        expect(page.locator('iframe')).to_have_attribute('sandbox','allow-scripts')
        page.frame_locator('iframe').get_by_role('button',name='New pattern').click()
        page.get_by_role('button',name='Close preview').click();expect(page.locator('iframe')).to_have_count(0);context.close()
        # No mocked manifests, thumbnails or HTML in this integration check.
        context=browser.new_context(viewport={'width':1440,'height':1000})
        page=context.new_page();watch(page)
        page.add_init_script("if(/\\/(Klavier|Stargaze)\\/portal\\//.test(location.pathname)){window.__previewHardwareRequests=0;navigator.requestMIDIAccess=()=>{window.__previewHardwareRequests++;throw Error('MIDI forbidden in preview')};if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{window.__previewHardwareRequests++;throw Error('Media forbidden in preview')}}")
        page.goto(url)
        expect(page.locator('.project-card[data-source="manifest"]')).to_have_count(COUNT,timeout=15000)
        expect(page.locator('#project-count')).to_have_text(f'{COUNT:02d} projects')
        expect(page.locator('#project-notice')).to_be_hidden()
        assert page.locator('.project-card').evaluate_all('(cards)=>cards.map(c=>c.dataset.project)')==IDS
        for position,entry in enumerate(ENTRIES,1):
            name=entry['id'];metadata=public[name]
            card=page.locator(f'[data-project="{name}"]')
            card.scroll_into_view_if_needed()
            expect(card.locator('h3')).to_have_text(metadata['title'])
            expect(card.locator('.project-number')).to_have_text(f'{position:02d} / EXPLORE')
            if metadata.get('preview'):
                expect(card.locator('img')).to_have_count(1)
                assert card.locator('img').get_attribute('src')==urljoin(entry['manifest'],metadata['preview'])
                expect(card.locator('img')).to_have_js_property('complete',True,timeout=10000)
                assert card.locator('img').evaluate('el=>el.naturalWidth>0')
            if not (metadata.get('embed') or metadata.get('portal')):continue
            card.get_by_role('button',name='Load interactive preview').click()
            frame=card.frame_locator('iframe')
            try:
                expect(card.locator('.embed-region p')).to_contain_text('Interactive sketch supplied',timeout=15000)
                expect(card.locator('iframe')).to_have_attribute('sandbox','allow-scripts')
                page.wait_for_timeout(250)
                if name=='pianorules':
                    frame.get_by_role('button',name='Dm7',exact=True).click()
                    expect(frame.locator('#chord-label')).to_have_text('D · F · A · C')
                    frame.locator('#mode').click()
                elif name=='tutor':
                    frame.locator('#dynamics').fill('16');expect(frame.locator('#dynamics-value')).to_have_text('+16')
                    frame.locator('#reset').click();expect(frame.locator('#dynamics-value')).to_have_text('0')
                elif name=='tesserakt':
                    for index,label in enumerate(['Operators','Bridges','Morphisms','Agents']):
                        control=frame.locator(f'[data-layer="{index}"]')
                        control.click();expect(control).to_have_attribute('aria-pressed','true')
                        expect(frame.locator('[data-layer-title]')).to_contain_text(label)
                    frame.get_by_role('button',name='Send a pulse',exact=True).click()
                    frame.get_by_role('button',name='Pause motion',exact=True).click()
                    expect(frame.locator('[data-motion]')).to_have_attribute('aria-pressed','false')
                    frame.get_by_role('button',name='Enable motion',exact=True).click()
                    assert card.locator('a',has_text='Open project').get_attribute('href')=='https://adrianartacho.github.io/TesserAkt/site/'
                elif name=='klavier':
                    assert card.locator('a',has_text='Open project').get_attribute('href')=='https://muk-research.github.io/Klavier/'
                    assert frame.locator('body').evaluate('()=>window.__previewHardwareRequests')==0
                    frame.locator('#arc').fill('25');expect(frame.locator('#arc-value')).to_have_text('25%')
                    frame.locator('#sway').fill('80');expect(frame.locator('#sway-value')).to_have_text('80%')
                    for label,arc,sway in [('Even','0%','0%'),('Linger','90%','95%'),('Arch','70%','55%')]:
                        frame.get_by_role('button',name=label,exact=True).click()
                        expect(frame.locator('#arc-value')).to_have_text(arc)
                        expect(frame.locator('#sway-value')).to_have_text(sway)
                    frame.locator('#arc').focus();page.keyboard.press('ArrowRight');expect(frame.locator('#arc-value')).to_have_text('71%')
                    frame.get_by_role('button',name='Pause motion',exact=True).click()
                    expect(frame.locator('body')).to_have_attribute('data-running','false')
                    frame.get_by_role('button',name='Enable motion',exact=True).click()
                    expect(frame.locator('#motion')).to_have_attribute('aria-pressed','true')
                    assert frame.locator('body').evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
                    assert frame.locator('body').evaluate('()=>document.body.scrollHeight<=innerHeight')
                elif name=='stargaze':
                    assert card.locator('a',has_text='Open project').get_attribute('href')==urljoin(entry['manifest'],metadata['project'])
                    assert frame.locator('body').evaluate('()=>window.__previewHardwareRequests')==0
                    expect(frame.locator('header')).to_contain_text('SILENT SKETCH')
                    # Pause through the real parent protocol, then use keyboard input.
                    page.get_by_role('button',name='Pause generative graphics',exact=True).click()
                    card.scroll_into_view_if_needed();page.wait_for_timeout(150)
                    before=frame.locator('canvas').evaluate('(el)=>el.toDataURL()')
                    page.wait_for_timeout(150)
                    assert before==frame.locator('canvas').evaluate('(el)=>el.toDataURL()'),'Stargaze did not pause'
                    control=frame.get_by_role('button',name='New sky')
                    control.focus();page.keyboard.press('Enter')
                    assert before!=frame.locator('canvas').evaluate('(el)=>el.toDataURL()'),'Stargaze keyboard control had no effect'
                    assert frame.locator('body').evaluate('()=>window.__previewHardwareRequests')==0
                    page.set_viewport_size({'width':390,'height':844});card.scroll_into_view_if_needed();page.wait_for_timeout(150)
                    assert frame.locator('body').evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
                    page.screenshot(path=str(OUTPUT/'stargaze-mobile-preview.png'),full_page=True)
                    page.set_viewport_size({'width':1440,'height':1000})
                    page.get_by_role('button',name='Enable generative graphics',exact=True).click();card.scroll_into_view_if_needed()
                assert 180 <= card.locator('iframe').evaluate('(el)=>el.getBoundingClientRect().height') <= 520
            except Exception:
                print('PREVIEW DIAGNOSTICS:',name,errors,card.locator('.embed-region p').text_content(),flush=True)
                page.screenshot(path=str(OUTPUT/f'{name}-failure.png'),full_page=True)
                raise
            page.screenshot(path=str(OUTPUT/f'{name}-live-preview.png'),full_page=True)
            card.get_by_role('button',name='Close preview').click()
        page.locator('.site-header').scroll_into_view_if_needed();page.wait_for_timeout(100)
        page.screenshot(path=str(OUTPUT/'desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(OUTPUT/'mobile.png'),full_page=True)
        assert not errors,errors
        (OUTPUT/'summary.json').write_text(json.dumps({'passed':True,'project_ids':IDS,'count':COUNT,'page_errors':errors,
            'checks':['public manifests and thumbnails','registry order and numbering','sandboxed previews','Stargaze keyboard and pause controls','desktop/mobile','opt-in microphone','filters and Vienna events']},indent=2)+'\n')
        context.close();browser.close()
    server.shutdown()
print(f'PASS: {COUNT} live project-owned cards in registry order {IDS}; sandboxed sketches; desktop/mobile; keyboard and motion controls; microphone opt-in/stop/denial; reduced motion; disabled storage; safe metadata; category filters and Vienna events.')
