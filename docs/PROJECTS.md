# Connect a project to the portal

The central portal controls layout; the project repository is the source of its own description, image, links and optional interaction. No submodules, GitHub API calls, API keys or duplicated application code are required at runtime.

## 1. Add the public presentation folder

Copy `templates/portal/` from this repository to the directory **actually published by your project’s GitHub Pages configuration**. If the project publishes `/docs`, the repository folder is `docs/portal/`. If a custom workflow assembles an artifact, add `portal/` to that artifact. Merely committing a folder that is excluded from the build will not make it available on the web.

```text
portal/
├── metadata.json
├── preview.svg
└── index.html
```

Replace the template’s title, description, image, people and links. The supplied `index.html` is a self-contained, silent visual study to illustrate the embedding contract, not an actual project demonstration. Adapt it to the project, or delete it and omit `embed`.

## 2. Use this metadata contract

```json
{
  "version": 1,
  "title": "PianoRules",
  "description": "Rule-based interaction for MIDI pianos.",
  "category": "performance",
  "format": "Browser tool",
  "status": "active",
  "people": ["Adrián Artacho"],
  "tags": ["MIDI", "Disklavier"],
  "preview": "./preview.webp",
  "previewAlt": "A description of the image for screen-reader users.",
  "embed": "./index.html",
  "project": "../",
  "repository": "https://github.com/MUK-research/PianoRules",
  "publication": null
}
```

Required: `title`, plus at least one of `project` or `repository`. Everything else is optional. Version 1 is supported; omit `version` for compatibility with the original proposal. `subtitle` is accepted as a fallback for `description`, and the original `portal` field is accepted as an alias for `embed`. `embed` can also be an object with a `src` property. People are supported in the contract for project metadata but are not currently shown on cards.

Current category filters are `performance`, `learning` and `listening`; other values remain visible under All projects. A matching tag can also make a project appear under a filter. Titles/descriptions/tags are treated as **plain text**, not Markdown or HTML. HTTPS URLs are required; local HTTP is accepted only for localhost testing. Relative URLs resolve beside `metadata.json`, including images, project links and embeds.

## 3. Register the public URL

Add an entry to `data/projects.json` in the central repository:

```json
{
  "id": "my-project",
  "manifest": "https://my-org.github.io/my-project/portal/metadata.json"
}
```

The registry is an object with a `projects` array. IDs must be unique. Array order controls card order. Set `"enabled": false` to hide a project without deleting it. The owner can be any organization/account: URLs are explicit, not constructed from repository names.

A `fallback` object may use the same metadata contract. Its relative paths resolve against the central `data/projects.json`, not the remote manifest. For example, `"preview": "../assets/pianorules.svg"` addresses a central illustration. Curated fallback data appears immediately; a valid remote manifest replaces it. Failed/malformed/oversized requests time out after 4.5 seconds. A project with neither a valid remote manifest nor a valid fallback is omitted without breaking the collection.

The manifest server must permit browser cross-origin reads (for example `Access-Control-Allow-Origin: *` for public data). A normal `github.com/.../blob/...` link is not a Pages manifest URL. No proxy, HTML scraping or authentication is attempted. Private application source can remain private, but portal metadata/images must be publicly readable. Never put secrets in them.

## 4. Optional interactive previews

Previews appear beneath the card **only after a visitor clicks Load interactive preview**. They should be compact, responsive and silent. The full MIDI/DAW/hardware application belongs behind Open project, not inside a tiny portal card.

The iframe uses only `sandbox="allow-scripts"`; it does not receive `allow-same-origin`. This deliberately gives the document an opaque origin, including for projects on the same `muk-research.github.io` origin. Do not remove this separation. Camera, microphone, MIDI, geolocation and autoplay are denied. Forms, popups and top navigation are not enabled. Avoid external module imports or fetches that assume a normal origin; the template inlines its CSS and script and uses no storage.

A fixed 270 px height works without any messaging. Optional auto-resizing and motion control use a per-frame random token. The portal adds `prlToken`, `motion=on|off` and `embed=1` query parameters. A preview can send:

```js
const token = new URLSearchParams(location.search).get('prlToken');
parent.postMessage({
  type: 'prl:resize',
  token,
  height: document.body.scrollHeight
}, '*');
```

Height is constrained to 180–520 px. The parent validates both `event.source === iframe.contentWindow` and the token; it does not rely on the opaque `null` origin. Because the preview’s origin is opaque, the parent must use `'*'` as its message target. No private information belongs in these messages.

The parent sends `{ type: 'prl:visibility', token, active: boolean }` when the frame is offscreen, the tab is hidden or global motion is disabled. A cooperative preview should validate `event.source === parent` and the token and pause its animation when inactive. The starter implements this. The parent cannot force a third-party script to honour the pause message: review previews before listing them. Closing a preview destroys its frame; changing project filters destroys existing previews too.

GitHub Pages must allow framing of the preview. A server with `X-Frame-Options` or CSP frame restrictions can refuse it; the portal always retains the normal Open project link. No automatic sound is implemented in the portal or starter, but listed project content remains the responsibility of its maintainers.

## Initial project entries

PianoRules, Tutor and 440 Hz are registered with their intended `/portal/metadata.json` URLs and curated fallback cards. This portal deployment does not modify their repositories or publishing workflows. Publish each project’s folder when ready; the next portal visit will use it automatically. There is no central rebuild needed for a metadata change, subject to the source host’s cache.
