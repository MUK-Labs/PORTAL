import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchText, parseCSV, normaliseEvents, safeURL } from '../js/core.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicBase = 'https://muk-research.github.io/PORTAL/data/events.json';

/** The browser only reads a same-origin snapshot: no Google scripts, keys or CORS proxy. */
export async function resolveEventFeed(config, saved, fetcher = fetchText) {
  normaliseEvents(saved, publicBase); // A broken local fallback must fail the build.
  const checkedAt = new Date().toISOString();
  const feed = config?.eventsFeed;
  if (!feed?.url?.trim()) return { ...saved, feed:{ state:'local', checkedAt } };
  try {
    const url = safeURL(feed.url);
    if (!url || !url.startsWith('https://')) throw new Error('External event feed must use HTTPS');
    if (!['csv','json'].includes(feed.format)) throw new Error('Feed format must be csv or json');
    const source = await fetcher(url, { timeout:15000, maxBytes:1048576 });
    const parsed = feed.format === 'csv' ? parseCSV(source) : JSON.parse(source);
    const records = Array.isArray(parsed) ? parsed : parsed.events;
    normaliseEvents(records, url);
    const events = records.map(event => ({ ...event, url:safeURL(event.url,url) }));
    return { version:1, events, feed:{ state:'external', checkedAt } };
  } catch (error) {
    console.warn(`External events feed unavailable; using data/events.json. ${error.message}`);
    return { ...saved, feed:{ state:'fallback', checkedAt } };
  }
}

export async function build() {
  const target = resolve(root, '_site');
  const config = JSON.parse(await readFile(resolve(root,'data/config.json'),'utf8'));
  const saved = JSON.parse(await readFile(resolve(root,'data/events.json'),'utf8'));
  const events = await resolveEventFeed(config,saved);
  await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
  // Explicit allow-list: never publish .git, workflows, tests or arbitrary local files.
  for(const name of ['index.html','privacy.html','assets','js','data','templates','Reference'])
    await cp(resolve(root,name),resolve(target,name),{recursive:true});
  await writeFile(resolve(target,'.nojekyll'),'');
  await writeFile(resolve(target,'data/events.json'),JSON.stringify(events,null,2)+'\n');
  await writeFile(resolve(target,'data/build.json'),JSON.stringify({commit:process.env.GITHUB_SHA||'local',builtAt:new Date().toISOString()},null,2)+'\n');
  console.log(`Built _site/ · ${events.events.length} event(s) · feed: ${events.feed.state}`);
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await build();
