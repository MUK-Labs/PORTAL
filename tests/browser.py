"""Browser tests under /PORTAL/, real project endpoints and simulated microphone input."""
import functools
import http.server
import json
import os
from pathlib import Path
import tempfile
import threading
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'test-results'
OUTPUT.mkdir(exist_ok=True)
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

def fixture_routes(page,url):
    def respond(route):
        names={'/Tutor/':'Tutor','/TesserAkt/':'Tesserakt 2.0','/Klavier/':'Expressive Performance Lab'}
        name=next((title for path,title in names.items() if path in route.request.url),'PianoRules')
        manifest={'version':1,'title':name,'description':'Test fixture only.','category':'learning' if name in ('Tutor','Expressive Performance Lab') else 'performance','tags':['Performance'] if name=='Expressive Performance Lab' else [],'project':'../','preview':url+'templates/portal/preview.svg','embed':url+'templates/portal/','people':['Fixture author']}
        route.fulfill(content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(manifest))
    page.route('https://muk-research.github.io/*/portal/metadata.json',respond)
    page.route('https://adrianartacho.github.io/TesserAkt/portal/metadata.json',respond)

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
        expect(page.locator('.project-card')).to_have_count(4)
        expect(page.locator('#project-count')).to_have_text('04 projects')
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
        page.get_by_role('button',name='Performance',exact=True).click()
        expect(page.locator('.project-card')).to_have_count(3)
        expect(page.locator('.project-card h3')).to_have_text(['PianoRules','Tesserakt 2.0','Expressive Performance Lab'])
        page.get_by_role('button',name='Learning',exact=True).click()
        expect(page.locator('.project-card')).to_have_count(2)
        expect(page.locator('.project-card h3')).to_have_text(['Tutor','Expressive Performance Lab'])
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
        page.goto(url);expect(page.locator('.project-card')).to_have_count(4)
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
        page.add_init_script("if(location.pathname.startsWith('/Klavier/portal/')){window.__previewHardwareRequests=0;navigator.requestMIDIAccess=()=>{window.__previewHardwareRequests++;throw Error('MIDI forbidden in preview')};if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{window.__previewHardwareRequests++;throw Error('Media forbidden in preview')}}")
        page.goto(url)
        expect(page.locator('.project-card[data-source="manifest"]')).to_have_count(4,timeout=15000)
        expect(page.locator('#project-count')).to_have_text('04 projects')
        expect(page.locator('#project-notice')).to_be_hidden()
        assert page.locator('[data-project="440hz"]').count()==0
        expect(page.locator('.project-card h3')).to_have_text(['PianoRules','Tutor','Tesserakt 2.0','Expressive Performance Lab'])
        for name in ['pianorules','tutor','tesserakt','klavier']:
            card=page.locator(f'[data-project="{name}"]')
            card.scroll_into_view_if_needed()
            expect(card.locator('img')).to_have_count(1)
            assert '/portal/preview.svg' in card.locator('img').get_attribute('src')
            expect(card.locator('img')).to_have_js_property('complete',True,timeout=10000)
            assert card.locator('img').evaluate('el=>el.naturalWidth>0')
            card.get_by_role('button',name='Load interactive preview').click()
            frame=card.frame_locator('iframe')
            try:
                # A streamed iframe can show buttons before its final script/resize runs.
                # Wait for the explicit ready handshake before sending the first input.
                expect(card.locator('.embed-region p')).to_contain_text('Interactive sketch supplied',timeout=15000)
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
                    expect(card.locator('.project-number')).to_have_text('04 / EXPLORE')
                    expect(card.locator('iframe')).to_have_attribute('sandbox','allow-scripts')
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
        context.close();browser.close()
    server.shutdown()
print('PASS: four live project-owned cards and sketches including Expressive Performance Lab fourth; no 440; full-bleed desktop/mobile field; pointer controls; fake-device microphone opt-in, disable, pause and offscreen stop; denial; reduced motion; disabled storage; safe metadata; sandboxed embeds; learning/performance filters and Vienna events.')
