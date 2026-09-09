# Connect a project to the portal

The portal controls layout; the project repository owns its description, credits, image, links and optional interactive sketch. No submodules, GitHub API keys or duplicated application code are required at runtime.

## 1. Publish the presentation folder

Copy `templates/portal/` to the directory **actually published by the project's Pages configuration**. For a `/docs` publishing source use `docs/portal/`; when a workflow packages an artifact, explicitly copy `portal/` into it. Merely committing an excluded directory does not publish it.

```text
portal/
├── metadata.json
├── preview.svg
└── index.html
```

Replace the template's title, description, image, people and links. Adapt the self-contained visual starter, or remove it and omit `embed` for a thumbnail-only card.

## 2. Metadata contract

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
  "previewAlt": "Describe the image for screen-reader users.",
  "embed": "./index.html",
  "project": "../",
  "repository": "https://github.com/MUK-research/PianoRules",
  "documentation": "../docs/",
  "publication": null
}
```

Required: `title`, plus at least one of `project` or `repository`. Everything else is optional. Version 1 is supported; omit `version` for compatibility with the original proposal. `subtitle` is accepted for `description`, and `portal` as an alias for `embed`. An embed may also be an object with a `src` property. People and documentation links appear on cards when provided.

Current filters are `performance` and `learning`; other categories remain visible under All projects. Matching tags also qualify a card for a filter. Text is plain text, not HTML or Markdown. Relative URLs resolve beside the manifest, never beside the central portal. Links must use HTTPS (localhost HTTP is allowed for development). Thumbnail images may be SVG, WebP, PNG or JPEG.

## 3. Central registry

Add to the `projects` array in `data/projects.json`:

```json
{
  "id": "my-project",
  "manifest": "https://my-org.github.io/my-project/portal/metadata.json"
}
```

IDs must be unique, begin with a letter/number and contain only letters, numbers, `_` and `-`. Array order is card order; `enabled: false` hides an entry. URLs can point to different accounts, organizations or custom domains.

The browser retrieves manifests on page load with a 6.5-second timeout and 64 KiB limit per manifest. Valid cards are rendered after requests settle. A failed project does not break the others; a notice supplies a direct project link. An optional `fallback` object can use the metadata contract, resolving relative paths against the central registry. The current collection deliberately has **no duplicate fallback descriptions**: its content lives in the three project repositories.

The manifest server must permit public cross-origin reads, for example `Access-Control-Allow-Origin: *`. A `github.com/.../blob/...` URL is not a published Pages JSON endpoint. No proxy or authentication is attempted; never put secrets in metadata.

## 4. Interactive previews

A preview is fetched only after **Load interactive preview** is clicked. Keep it compact, responsive and silent. Full hardware/MIDI applications belong behind Open project, outside the frame.

The iframe has `sandbox="allow-scripts"` only. It has an opaque origin even when the project and portal share a `muk-research.github.io` host. Do not add `allow-same-origin`. Camera, microphone, MIDI, geolocation and autoplay are denied; popups, forms and top navigation are not enabled. Prefer inline CSS/classic JavaScript; module imports, storage and fetches that assume a normal origin may fail. The main portal's opt-in microphone is separate and never delegated to these frames.

The portal adds `prlToken`, `motion=on|off` and `embed=1` query parameters. A ready signal lets it distinguish an initialized sketch from a blank/blocked page:

```js
const token = new URLSearchParams(location.search).get('prlToken');
parent.postMessage({type: 'prl:ready', token}, '*');
parent.postMessage({
  type: 'prl:resize', token,
  height: document.body.scrollHeight
}, '*');
```

The initial height is 270 px; resizing is clamped to 180–520 px. The parent checks both the source iframe window and its random token. No ready signal within ten seconds produces a notice; Open project remains available. These messages contain no private information.

The parent sends `{type:'prl:visibility', token, active:boolean}` when visibility or global motion changes. A preview should verify `event.source === parent` and the token, and pause its animation when inactive. Also honor the initial `motion` query parameter and document visibility. Closing a preview or changing filters destroys the frame. A parent cannot force arbitrary third-party scripts to honor a pause message; review content before registering it.

A host's frame restrictions can block a preview, so always retain the full project link. Test the real iframe, not merely the standalone page, with keyboard controls and a narrow screen.

## Current connections

- **PianoRules** owns its metadata, SVG and silent chord-pattern sketch in [PianoRules/portal](https://github.com/MUK-research/PianoRules/tree/main/portal).
- **Tutor** owns its metadata, SVG and interactive axis sketch in [Tutor/portal](https://github.com/MUK-research/Tutor/tree/main/portal). Its Pages workflow explicitly copies this folder into the public artifact.
- **Tesserakt 2.0** owns its metadata, four-colour SVG and interactive tesseract sketch in [TesserAkt/portal](https://github.com/AdrianArtacho/TesserAkt/tree/main/portal). Its Pages artifact publishes `portal/` and the full presentation at `site/`.

The central registry now contains only these three manifest URLs and IDs. 440 Hz is not listed, and its repository was not changed. Their full applications remain unchanged. Update content in the project's folder, let that project's Pages deployment complete, then reload the portal. No central content copy or rebuild is required for a metadata change, subject to the source host's cache.

The browser integration suite tests all three public manifests, project-owned thumbnails and actual sandboxed sketches. When adding projects, update the fixture/count assertions in `tests/core.test.mjs` and `tests/browser.py` to match the intended collection.
