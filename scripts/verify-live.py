"""Verify the deployed artifact/commit, plus the project-owned public endpoints."""
import json
import os
import time
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
base=os.environ['PORTAL_URL'].rstrip('/')+'/'
expected=os.environ['GITHUB_SHA']
assert urlsplit(base).scheme=='https'
def get(path):
    url=urljoin(base,path)
    request=Request(url+('&' if '?' in url else '?')+'verify='+expected,headers={'Cache-Control':'no-cache','User-Agent':'PORTAL-deployment-check'})
    with urlopen(request,timeout=20) as response:
        assert response.status==200,(path,response.status)
        body=response.read(2*1024*1024)
        assert body,f'Empty response: {path}'
        return body
for attempt in range(12):
    try:
        info=json.loads(get('data/build.json'))
        assert info['commit']==expected,f"CDN has {info.get('commit')}, expecting {expected}"
        assert b'id="microphone-toggle"' in get('index.html')
        assert b'--bg:' in get('assets/site.css')
        assert b'Full-bleed' in get('assets/field.css')
        assert b'loadProjects' in get('js/app.mjs')
        assert b'TIME_ZONE' in get('js/core.mjs')
        assert b'mountField' in get('js/field.mjs')
        assert b'LocalMicrophone' in get('js/microphone.mjs')
        registry=json.loads(get('data/projects.json'))['projects']
        assert isinstance(registry,list)
        assert json.loads(get('data/events.json'))['feed']['state'] in ['local','external','fallback']
        assert b'prl:resize' in get('templates/portal/index.html')
        print(f'PUBLIC SITE VERIFIED: {base} · commit {expected}')
        break
    except Exception as error:
        if attempt==11:raise
        print(f'Propagation check {attempt+1}/12: {error}');time.sleep(10)
# Project-owned content is external to PORTAL. Surface outages, do not mislabel them
# as a failed central deployment. Browser integration tests also exercise these URLs.
for entry in registry:
    try:
        manifest=entry['manifest'];data=json.loads(get(manifest))
        assert data['title']
        assert get(urljoin(manifest,data['preview']))
        assert b'prl:ready' in get(urljoin(manifest,data['embed']))
        print(f"PROJECT ENDPOINTS VERIFIED: {entry['id']} · {manifest} · thumbnail + interactive HTML HTTP 200")
    except Exception as error:
        print(f"::warning::External project check failed for {entry['id']}: {error}")
