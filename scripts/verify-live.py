"""Verify the deployed public artifact, including its exact source commit.
Runs after deploy-pages. Bounded retries allow the CDN to finish updating.
"""
import json
import os
import time
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

base = os.environ['PORTAL_URL'].rstrip('/') + '/'
expected = os.environ['GITHUB_SHA']
assert urlsplit(base).scheme == 'https', 'Public deployment must use HTTPS'

def get(path):
    request = Request(urljoin(base,path) + '?verify=' + expected, headers={'Cache-Control':'no-cache','User-Agent':'PORTAL-deployment-check'})
    with urlopen(request,timeout=20) as response:
        assert response.status == 200, (path,response.status)
        body=response.read(2*1024*1024)
        assert body, f'Empty response: {path}'
        return body

for attempt in range(12):
    try:
        info=json.loads(get('data/build.json'))
        assert info['commit']==expected, f"CDN has commit {info.get('commit')}, expecting {expected}"
        assert b'id="projects-grid"' in get('index.html')
        assert b'--bg:' in get('assets/site.css')
        assert b'loadProjects' in get('js/app.mjs')
        assert b'TIME_ZONE' in get('js/core.mjs')
        assert b'mountField' in get('js/field.mjs')
        assert isinstance(json.loads(get('data/projects.json'))['projects'],list)
        assert json.loads(get('data/events.json'))['feed']['state'] in ['local','external','fallback']
        assert b'prl:resize' in get('templates/portal/index.html')
        print(f'PUBLIC SITE VERIFIED: {base}')
        print(f'Commit: {expected}. HTML, CSS, all JS modules, registry, events snapshot and embed starter returned HTTP 200.')
        break
    except Exception as error:
        if attempt==11: raise
        print(f'Deployment propagation check {attempt+1}/12: {error}')
        time.sleep(10)
