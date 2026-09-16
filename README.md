# [Performance Research Lab · MUK@OWA](https://muk-research.github.io/PORTAL/)

A responsive, dependency-free portal around the Bösendorfer Performance Lab. Dark editorial typography, a full-bleed interactive RGB ribbon field and the supplied event artwork. No framework, external fonts, analytics or runtime API keys.

## Play the light field

The graphic occupies the full width of the opening section rather than a small panel. Move the pointer to bend and rotate the ribbons; click/tap or use **Send a pulse** to disturb them; **Remix** changes their configuration. The button controls also work by keyboard. Touch scrolling remains available.

**Enable microphone** is optional and off by default. After permission, Web Audio analyses transient audio buffers locally: level drives expansion/speed, low-frequency energy broadens the field and higher-frequency energy adds detail. The mapping is an artistic response, not a calibrated measurement or pitch detector. Nothing is recorded, uploaded, stored or routed to the speakers. The input level meter and live status show when it is active.

**Disable microphone**, **Pause motion**, scrolling the field fully offscreen, hiding the tab or leaving the page stops the audio tracks and closes the context. Microphone access never restarts automatically. A late permission grant after cancellation/timeout is immediately released. Pointer mode remains available after a denied permission or missing device. No permission is requested merely by opening the portal.

Reduced motion is respected by default. Motion preference (`prl:motion`) is saved locally when possible. A paused field disables microphone activation until motion is enabled; rendering stops in background tabs and offscreen. Canvas resolution/frame rate are capped. See [the privacy notice](privacy.html).

## Project ownership — registered collection

**PianoRules, Tesserakt 2.0, Expressive Performance Lab, Stargaze and Tutor own their portal content in their own repositories.** This is the display order in `data/projects.json`; their full apps are unchanged. Each presentation layer uses:

```text
portal/
├── metadata.json
├── preview.svg
└── index.html
```

A project may also include a `portal/README.md` for maintenance notes. The central `data/projects.json` contains only an id and a published `manifest` URL for each project. There is no second copy of their descriptions, thumbnails or credits in the registry. The browser fetches metadata on page load; all relative assets and links resolve beside the project's manifest. After a project's Pages deployment/cache updates, reload the portal to see its new content without editing this repository.

- [PianoRules presentation layer](https://github.com/MUK-research/PianoRules/tree/main/portal): choose a chord and switch between cloud/ostinato visual sketches.
- [Tesserakt 2.0 presentation layer](https://github.com/AdrianArtacho/TesserAkt/tree/main/portal): explore operators, bridges, morphisms and agents through a silent tesseract projection. Its full presentation lives in `site/`.
- [Expressive Performance Lab presentation layer](https://github.com/MUK-research/Klavier/tree/main/portal): shape a dynamic arc and timing sway, following illustrative feature curves and a fading Performance Worm. It appears under Learning and Performance; its full MIDI app stays at the Klavier root.
- [Stargaze presentation layer](https://github.com/MUK-research/Stargaze/tree/main/portal): a silent, abstract sky-and-gaze sketch introducing a gaze-controlled performance for a self-playing piano. The preview does not use a camera or MIDI; the full application handles those permissions separately.
- [Tutor presentation layer](https://github.com/MUK-research/Tutor/tree/main/portal): move dynamics, onset timing and duration sliders to explore the feedback cube. The project credits include Jura Margulis's original idea.

The previews are explicitly illustrative: they are not a recording, measurement or a second copy of the full MIDI engine. **Load interactive preview** creates an opaque-origin `sandbox="allow-scripts"` iframe only after a click. No hardware permission, same-origin access, automatic audio, top navigation or popups are granted. Full applications open through **Open project**. The parent validates resize/ready messages against the iframe window and random token, and reports previews that do not signal readiness.

**440 Hz is not listed. Its repository is untouched.** Old local illustration assets may remain unused; they are not the source of the connected project cards.

Failed metadata requests leave the available projects usable and show direct project links plus a notice. The loader still supports optional curated fallbacks for future registry entries, but the registered entries do not use them. Cross-origin project hosts must serve public JSON with suitable CORS headers. Registration alone does not publish a project's `portal/` folder: its manifest URL must already be publicly reachable.

[Project contract and onboarding](docs/PROJECTS.md) · [Reusable starter](templates/portal/)

## Events: edit a sheet, not the website

The default `data/events.json` contains only the documented opening on **9 June 2026**, from the supplied flyer/programme. Upcoming and archived events sort automatically; times display in **Europe/Vienna**, independent of the visitor's timezone.

For external management, publish one Google Sheets tab as CSV and put its published URL in `data/config.json`. The publishing workflow mirrors it into the deployed JSON on pushes, manual runs and approximately every six hours. Visitors do not contact Google to load events. Only public event information belongs in the sheet. No external spreadsheet is connected until its URL is configured.

If a feed fails, the local `data/events.json` is used with a visible notice. This is not a cache of the last remote success: maintain important local fallback entries. Scheduled GitHub runs are best-effort and can be disabled after repository inactivity.

[Event setup and date conventions](docs/EVENTS.md) · [CSV starter](data/events-template.csv)

## Publish and test

In **Settings → Pages → Source**, select **GitHub Actions**. The included **Publish portal** workflow validates, builds `_site/`, runs browser checks on push/manual runs, deploys and verifies the public commit. Branch publishing from root bypasses the events build; use Actions to avoid duplicate deployments. Existing source/reference material is preserved, and repository visibility is not changed.

**Registry edits do not require manual compilation.** Commit valid JSON to `main`; the workflow runs the build and deployment. `_site/` is generated and uploaded, not committed. Project counts, numbering and browser-test expectations follow the registry order rather than a fixed four-project list. The build validates IDs, duplicates, manifest URLs and JSON syntax before packaging. Browser checks fail with an endpoint report when a registered public manifest is unavailable.

Node 22+; no npm dependencies:

```bash
npm test
npm run build
python3 -m http.server 8000 --directory _site
```

Use HTTP(S), not `file://`. For browser tests:

```bash
python -m pip install playwright==1.55.0
python -m playwright install chromium
python tests/browser.py
# CHROME_BIN=/usr/bin/chromium python tests/browser.py
```

The data tests cover metadata, registry validation, safe URLs, CSV parsing, events/timezones and microphone lifecycle/energy with simulated inputs. Browser tests cover desktop/mobile, subpath assets, filters, motion persistence, denied permissions, simulated microphone start/stop, pause/offscreen cleanup, text sanitisation and sandboxing. An end-to-end section loads all enabled projects' actual public manifests, images and optional interactive previews (requires network), including Stargaze's keyboard input and parent-controlled motion pause. Screenshots, endpoint diagnostics and the result summary are stored as the `portal-browser-checks` Actions artifact. These checks are not a physical-microphone, eye-tracker or all-browser compatibility certification.

## Sources and credits

The venue, opening and instrument description derive from the original PDFs in `Reference/`. The programme credits the photograph to **Angelika Maier**. The artwork, institutional marks and documents retain their respective rights; this repository does not grant reuse rights over them. Project descriptions derive from their own documentation; the hero and thumbnail graphics are illustrative artwork. MUK should review institutional branding and legal requirements before official promotion.

Technical references: [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [stopping input tracks](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [publishing a Google Sheet](https://support.google.com/docs/answer/183965).

Developed by [Adrián Artacho](https://muk.ac.at/studienangebot/lehrende/details/adrian-artacho.html), researcher at the Music and Arts University of the City of Vienna (MUK).
