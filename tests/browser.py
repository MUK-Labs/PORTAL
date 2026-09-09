"""Browser smoke tests. Run: CHROME_BIN=/usr/bin/chromium python tests/browser.py
Requires Playwright; serves the built site under /PORTAL/ to test Pages subpaths.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import tempfile
import threading
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'test-results'
OUTPUT.mkdir(exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

with tempfile.TemporaryDirectory() as temp:
    shutil.copytree(ROOT / '_site', Path(temp) / 'PORTAL')
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=temp))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/PORTAL/'
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.getenv('CHROME_BIN'), args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440,'height':1000}, timezone_id='America/New_York')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('https://**/*', lambda route: route.fulfill(status=404,body='Not available'))
        page.goto(url)
        expect(page.locator('.project-card')).to_have_count(3)
        # Compare DOM text, not innerText (CSS deliberately displays uppercase).
        expect(page.locator('#project-count')).to_have_text('03 projects')
        assert page.locator('iframe').count() == 0
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Desktop overflow'
        assert page.locator('#field').evaluate('(el) => el.width > 500')
        page.screenshot(path=str(OUTPUT/'desktop.png'), full_page=True)
        page.get_by_role('button',name='Performance',exact=True).click()
        expect(page.locator('.project-card')).to_have_count(1)
        expect(page.locator('.project-card h3')).to_have_text('PianoRules')
        page.get_by_role('button',name='All projects',exact=True).click()
        page.get_by_role('button',name='Archive',exact=True).click()
        expect(page.locator('.event-row')).to_have_count(1)
        assert '10:00–16:30' in page.locator('.event-row').inner_text(), 'Must display Vienna time, not browser timezone'
        assert page.locator('.event-row a').get_attribute('href').endswith('Reference/Eroeffnung_BoesendorferPerformanceLab_Programminfo.pdf')
        page.get_by_role('button',name='Pause generative graphics').click()
        expect(page.locator('#motion-toggle')).to_have_attribute('aria-pressed','false')
        page.reload()
        expect(page.locator('#motion-toggle')).to_have_attribute('aria-pressed','false')
        page.set_viewport_size({'width':375,'height':812})
        page.wait_for_timeout(200)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow'
        page.screenshot(path=str(OUTPUT/'mobile.png'),full_page=True)
        page.goto(url+'privacy.html')
        expect(page.locator('h1')).to_have_text('Privacy & credits.')
        context.close()

        # Reduced motion defaults to off and survives unavailable storage.
        context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
        page = context.new_page()
        page.route('https://**/*', lambda route: route.fulfill(status=404,body='Not available'))
        page.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw new Error('storage disabled')}})")
        page.goto(url)
        expect(page.locator('.project-card')).to_have_count(3)
        expect(page.locator('#motion-toggle')).to_have_attribute('aria-pressed','false')
        context.close()

        # Exercise a project-owned manifest and an actual isolated iframe.
        context = browser.new_context(viewport={'width':1200,'height':900})
        page = context.new_page()
        page.on('pageerror',lambda error: errors.append(str(error)))
        registry = {'projects':[{'id':'fixture','manifest':'https://project.example/portal/metadata.json'}]}
        manifest = {'version':1,'title':'<img onerror=alert(1)>','description':'A fixture, not a public project.','category':'performance','project':url,'preview':url+'templates/portal/preview.svg','embed':url+'templates/portal/','repository':'javascript:alert(1)'}
        page.route('**/data/projects.json',lambda route: route.fulfill(content_type='application/json',body=json.dumps(registry)))
        page.route('https://project.example/portal/metadata.json',lambda route: route.fulfill(content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(manifest)))
        page.goto(url)
        expect(page.locator('.project-card')).to_have_count(1)
        expect(page.locator('.project-card h3')).to_have_text('<img onerror=alert(1)>')
        assert page.locator('.project-card h3 img').count() == 0, 'Metadata must never become HTML'
        assert page.locator('.repo-link').count() == 0, 'Unsafe URLs must be dropped'
        assert page.locator('iframe').count() == 0, 'No automatic iframe requests'
        page.get_by_role('button',name='Load interactive preview').click()
        frame = page.locator('iframe')
        expect(frame).to_have_attribute('sandbox','allow-scripts')
        page.frame_locator('iframe').get_by_role('button',name='New pattern').click()
        expect(frame).to_have_count(1)
        page.wait_for_timeout(200)
        assert 180 <= frame.evaluate('(el)=>el.getBoundingClientRect().height') <= 520
        page.get_by_role('button',name='Close preview').click()
        expect(frame).to_have_count(0)
        assert not errors, errors
        context.close()
        browser.close()
    server.shutdown()
print('PASS: desktop, mobile, subpath assets, project filters, Vienna event times, archive, motion persistence, reduced motion, disabled storage, plain-text metadata, unsafe URLs, deferred sandboxed iframe, resize and close.')
