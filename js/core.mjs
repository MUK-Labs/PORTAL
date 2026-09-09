/** Shared, dependency-free data contract. No HTML from feeds is ever executed. */
export const TIME_ZONE = 'Europe/Vienna';
export const text = (value, limit = 2000) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export function safeURL(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) return null;
    return url.href;
  } catch { return null; }
}

export async function fetchText(url, { timeout = 6000, maxBytes = 1048576 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-cache', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Feed is too large');
    if (!response.body?.getReader) {
      const body = await response.text();
      if (new TextEncoder().encode(body).length > maxBytes) throw new Error('Feed is too large');
      return body;
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let size = 0, body = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('Feed is too large'); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { clearTimeout(timer); }
}
export async function fetchJSON(url, options) { return JSON.parse(await fetchText(url, options)); }

export function normaliseProject(raw, base, id = '') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid project object');
  if (raw.version != null && raw.version !== 1) throw new Error('Unsupported project contract version');
  const title = text(raw.title, 120);
  if (!title) throw new Error('Project title is required');
  const project = safeURL(raw.project, base), repository = safeURL(raw.repository, base);
  if (!project && !repository) throw new Error('A project or repository URL is required');
  const embedSrc = typeof raw.embed === 'object' && raw.embed ? raw.embed.src : (raw.embed || raw.portal);
  return {
    id: text(id || raw.id, 100), title,
    description: text(raw.description || raw.subtitle, 700),
    category: text(raw.category, 60) || 'research',
    format: text(raw.format, 60) || 'Project',
    status: text(raw.status, 40),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 8).map(v => text(v, 40)).filter(Boolean) : [],
    people: Array.isArray(raw.people) ? raw.people.slice(0, 12).map(v => text(v, 120)).filter(Boolean) : [],
    preview: safeURL(raw.preview, base),
    previewAlt: text(raw.previewAlt, 300) || `${title} — project illustration`,
    embed: safeURL(embedSrc, base),
    project, repository,
    publication: safeURL(raw.publication, base)
  };
}

/** RFC 4180-style CSV: supports BOM, CRLF, commas, escaped quotes and multiline cells. */
export function parseCSV(source) {
  const input = source.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, afterQuote = false;
  const finishCell = () => { row.push(cell); cell = ''; afterQuote = false; };
  const finishRow = () => { finishCell(); if (row.some(v => v.trim())) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') { if (input[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; afterQuote = true; } }
      else cell += c;
    } else if (c === ',') finishCell();
    else if (c === '\r' || c === '\n') { if (c === '\r' && input[i + 1] === '\n') i++; finishRow(); }
    else if (c === '"' && cell === '' && !afterQuote) quoted = true;
    else if (afterQuote && /\s/.test(c)) continue;
    else if (afterQuote || c === '"') throw new Error('Malformed CSV quote');
    else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell || row.length || afterQuote) finishRow();
  if (!rows.length) throw new Error('CSV needs a header row');
  const headers = rows.shift().map(v => v.trim());
  if (headers.some(v => !v) || new Set(headers).size !== headers.length) throw new Error('Invalid or duplicate CSV headers');
  if (!headers.includes('title') || !headers.includes('start')) throw new Error('CSV needs title and start columns');
  return rows.map((values, i) => {
    if (values.length > headers.length) throw new Error(`Too many columns in CSV row ${i + 2}`);
    return Object.fromEntries(headers.map((key, j) => [key, values[j]?.trim() || '']));
  });
}

function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
const zoneParts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
/** Local midnight, including Vienna DST days (which are not always 24 hours). */
export function midnightVienna(day) {
  if (!validDay(day)) throw new Error(`Invalid date: ${day}`);
  const desired = Date.parse(`${day}T00:00:00Z`);
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(zoneParts.formatToParts(new Date(instant)).map(v => [v.type, v.value]));
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    instant += desired - represented;
  }
  return instant;
}
export function parseEventTime(value) {
  if (typeof value !== 'string') throw new Error('A date string is required');
  if (validDay(value)) return { instant: midnightVienna(value), allDay: true };
  const pattern = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
  const match = value.match(pattern);
  if (!match || !validDay(match[1]) || !Number.isFinite(Date.parse(value))) throw new Error(`Use YYYY-MM-DD or an ISO time with timezone offset: ${value}`);
  return { instant: Date.parse(value), allDay: false };
}
function nextDay(day) { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }

export function normaliseEvents(input, base) {
  const list = Array.isArray(input) ? input : input?.events;
  if (!Array.isArray(list) || list.length > 1000) throw new Error('Expected at most 1000 events');
  const ids = new Set();
  return list.filter(raw => raw && !['false', 'no', '0'].includes(String(raw.published).toLowerCase())).map((raw, i) => {
    const title = text(raw.title, 200);
    if (!title) throw new Error(`Missing title in event ${i + 1}`);
    const start = parseEventTime(text(raw.start));
    const explicitEnd = text(raw.end);
    const end = explicitEnd ? parseEventTime(explicitEnd) : { allDay: start.allDay, instant: start.allDay ? midnightVienna(nextDay(text(raw.start))) : start.instant + 1 };
    if (start.allDay !== end.allDay || end.instant <= start.instant) throw new Error(`Invalid end date for ${title}`);
    const id = text(raw.id, 120) || `${raw.start}-${title}`;
    if (ids.has(id)) throw new Error(`Duplicate event id: ${id}`);
    ids.add(id);
    return { id, title, start: start.instant, end: end.instant, allDay: start.allDay,
      kind: text(raw.kind, 80), location: text(raw.location, 250), description: text(raw.description, 1200),
      url: safeURL(raw.url, base), status: text(raw.status, 60), linkLabel: text(raw.linkLabel, 70) || 'Details' };
  });
}
export function eventState(event, now = Date.now()) { return now >= event.end ? 'past' : (now >= event.start ? 'ongoing' : 'upcoming'); }
export function selectEvents(events, view, now = Date.now()) {
  return events.filter(e => view === 'past' ? eventState(e, now) === 'past' : eventState(e, now) !== 'past')
    .sort((a, b) => view === 'past' ? b.start - a.start : a.start - b.start);
}
export function viennaFormat(time, options) { return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: TIME_ZONE }).format(new Date(time)); }
export function eventTimeLabel(event) {
  if (event.allDay) return 'All day';
  const a = viennaFormat(event.start, { hour:'2-digit', minute:'2-digit' });
  if (event.end - event.start <= 1) return a;
  const sameDay = viennaFormat(event.start, { dateStyle:'short' }) === viennaFormat(event.end, { dateStyle:'short' });
  const b = viennaFormat(event.end, sameDay ? { hour:'2-digit', minute:'2-digit' } : { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  return `${a}–${b}`;
}
