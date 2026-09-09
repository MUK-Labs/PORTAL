# [Performance Research Lab · MUK@OWA](https://muk-research.github.io/PORTAL/)

A responsive, dependency-free portal for projects and encounters around the Bösendorfer Performance Lab. Dark editorial typography, a silent, pointer-responsive RGB light field, and the supplied event artwork. No framework, external fonts, analytics or runtime API keys.

## Publish

The included **Publish portal** workflow tests, builds and deploys this repository to GitHub Pages on pushes to `main`, manual runs and every six hours. The public artifact is `_site/` (not the whole repository).

In **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. No template needs to be added: `.github/workflows/pages.yml` is already included. If a deployment reports that Pages is not configured, make that selection and re-run the failed deployment. The intended address is:

https://muk-research.github.io/PORTAL/

Branch publishing from `main` / root also serves the static homepage, but **does not run the external-events snapshot step**; use GitHub Actions for the complete setup. Changing the publishing source requires repository administration access. No repository visibility settings are changed by this project.

## Content ownership

The portal owns layout and navigation. Each project owns its public presentation:

```text
ProjectRepo/<published-directory>/portal/
├── metadata.json       # title, description, links and image
├── preview.svg         # or .webp, .jpg, .png
└── index.html          # optional small interactive preview
```

`data/projects.json` is the central registry. An entry can consist of just an `id` and an absolute `manifest` URL. Optional curated fallback data keeps cards useful while a project is offline or being connected. Relative paths are resolved against **that manifest**, never against this portal.

**Initial collection:** PianoRules, Tutor and 440 Hz have usable curated cards and real project links. The registry already targets their future `/portal/metadata.json` addresses. No files in those other repositories have been modified. Until their presentation folders are published, their curated cards remain visible; no non-existent interactive previews are advertised. Their illustrations are schematic, not measurements or screenshots.

Copy `templates/portal/` into a project to get started. It includes a working, silent, sandbox-compatible visual preview. See **[the project contract and onboarding guide](docs/PROJECTS.md)**.

## Events: edit a sheet, not the website

The default feed is `data/events.json`. It contains only the confirmed opening on **9 June 2026**, taken from the supplied flyer/programme. No invented future dates are included. Upcoming and archived events are sorted automatically; ongoing events remain upcoming until their end. Times always display in **Europe/Vienna**, independently of the visitor’s timezone.

For external management, publish one Google Sheets tab as CSV and put its published URL in `data/config.json`. The workflow mirrors it into the deployed JSON every six hours, on pushes and on manual runs. Visitors never need to contact Google, log in or bypass a CORS error. Only publish public event information.

**[Event setup and date conventions](docs/EVENTS.md)** · **[CSV starter](data/events-template.csv)**

No external spreadsheet is connected initially because no feed URL has been provided. If a configured feed fails, the local `data/events.json` is used and visitors see a fallback notice. This is not a cache of the last successful remote feed: keep important fallback entries updated locally.

## Run and test locally

Use Node 22 or newer. There are no npm dependencies to install.

```bash
npm test
npm run build
python3 -m http.server 8000 --directory _site
# Open http://localhost:8000
```

Do not open `index.html` as a `file://` URL: the project and event loaders need HTTP(S).

For browser tests:

```bash
python -m pip install playwright==1.55.0
python -m playwright install chromium
python tests/browser.py
# Or use an existing Chromium:
# CHROME_BIN=/usr/bin/chromium python tests/browser.py
```

The browser suite serves the built files under `/PORTAL/`, tests desktop/mobile layouts, project filtering, event timezone conversion, motion preferences, unavailable storage, safe text rendering and a real sandboxed preview. It writes screenshots to `test-results/`. Push/manual CI runs run these checks and upload a `portal-browser-checks` artifact. Scheduled feed refreshes run the faster data tests without reinstalling a browser.

`npm test` covers URL resolution and sanitisation, metadata contracts, CSV quoting/newlines/BOM, external-feed success/failure, invalid dates, Vienna daylight saving, publication flags, event ordering, the initial data and feed size limits.

## Implementation notes

- Runtime: plain HTML, CSS and JavaScript modules, plus Canvas 2D.
- Motion: respects reduced-motion preferences by default, with a persistent pause/enable control. Rendering pauses when hidden or off screen. Pointer input is not recorded.
- Media: the original `Reference/` assets are retained. Thumbnail illustrations are local SVGs; project-owned thumbnails replace them when metadata becomes available.
- Embeds: click-to-load, opaque-origin `sandbox="allow-scripts"`, no hardware permissions or automatic sound. Full applications open separately. Do not add `allow-same-origin` to same-origin previews.
- Events: a public build-time CSV/JSON feed, not an authenticated admin interface. Scheduled GitHub Actions runs may be delayed or disabled after repository inactivity; manual runs are available.
- Hosting: relative asset paths support the GitHub Pages repository subpath and a later custom domain. For a new public address, also update social-image URLs and the README.
- Privacy: [implementation-specific notice and credits](privacy.html). MUK should review institutional legal/branding requirements before official promotion. No comprehensive legal-compliance claim is made.

## Source material

The opening event, venue and lab description are based on `Reference/Eroeffnung_BoesendorferLab_OWA_Flyer.pdf` and `Reference/Eroeffnung_BoesendorferPerformanceLab_Programminfo.pdf`. The latter credits the photograph to **Angelika Maier**. The original artwork and institutional marks retain their respective rights; this repository does not grant reuse rights over those materials.

Initial project descriptions are based on their own READMEs. Interface headlines are new editorial copy; the animated field and card illustrations are visual studies, not measured performance data.

Technical references: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [publishing a Google Sheet](https://support.google.com/docs/answer/183965), [iframe sandboxing](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox).

Developed by [Adrián Artacho](https://muk.ac.at/studienangebot/lehrende/details/adrian-artacho.html), researcher at the Music and Arts University of the City of Vienna (MUK).
