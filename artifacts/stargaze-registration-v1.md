# Stargaze registration — 16 September 2026

## Changes committed

Repaired the missing comma after Klavier and the trailing comma after Tutor in `data/projects.json`, retaining the author's edited display order:

PianoRules → Tesserakt 2.0 → Expressive Performance Lab → Stargaze → Tutor.

The registry remains project-owned metadata URLs only. No project content is copied into PORTAL. Contract tests and browser checks now derive collection size and order from the registry, instead of requiring the former four-project collection. The build validates registry syntax, IDs, duplicates, URL safety and optional enabled flags before writing `_site/`. Stargaze has additional sandbox, silent-preview, keyboard, motion-pause and narrow-screen assertions in the integration suite.

README and onboarding instructions explain that pushes to `main` run the existing **Publish portal** workflow automatically. Generated `_site/` output is uploaded to Pages rather than committed. No manual compilation is needed for registry changes.

## Observed verification results

Code commit checked: `0760a4809bc10efdd21a0ef1e4eb9a6dc61ac0db`.
Workflow: https://github.com/MUK-research/PORTAL/actions/runs/35085843941

- Contract/feed tests (`npm test`): passed.
- Static build (`npm run build`): passed.
- Public-manifest preflight: PianoRules, Tesserakt, Klavier and Tutor returned HTTP 200 with cross-origin access allowed; Stargaze returned HTTP 404.
- Browser interaction suite: blocked at that preflight. The newly added Stargaze browser assertions have not run successfully against a public deployment.
- Custom Pages deployment: skipped because the build job's public-endpoint check failed. This report does not claim Stargaze is visible in the public portal.

The actual endpoint report is retained as [stargaze-endpoints-v1.json](stargaze-endpoints-v1.json), from workflow artifact `10442356862`. The follow-up commit changes documentation/evidence only.

## Required publication step

The intended manifest is:

https://muk-research.github.io/Stargaze/portal/metadata.json

The folder exists in the Stargaze repository, but the URL was not publicly served when checked. Enable/fix Pages publishing in **MUK-research/Stargaze → Settings → Pages**. For the current root layout, branch publishing from **main / (root)** includes `portal/` and the root redirect to the application in `site/`. Alternatively, a custom Pages workflow must explicitly include `portal/` in its uploaded artifact. Do not choose `/docs` unless that publishing directory actually contains the presentation files. The GitHub tools available for this change do not expose a Pages-settings write action; no repository visibility or Pages setting was changed here.

Once the manifest is publicly reachable, rerun **PORTAL → Actions → Publish portal → Run workflow** (or re-run the failed workflow). Its existing deployment step verifies the deployed commit. A successful source build alone is not proof of public publication.

GitHub's Pages workflow instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
