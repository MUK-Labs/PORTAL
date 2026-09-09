# Maintain events from a Google Sheet

A spreadsheet editor does not need GitHub access after the one-time setup. The portal’s publishing job downloads the public sheet and creates a same-origin JSON snapshot. There is no Google iframe, visitor login, API key or CORS proxy.

## One-time setup

1. Create a dedicated Google Sheet for **public lab events**. Import `data/events-template.csv`, or copy its header row. Use a separate sheet/tab from internal planning, personal contact lists or private notes.
2. In Google Sheets choose **File → Share → Publish to web**. Choose the events tab and **Comma-separated values (.csv)**. Leave automatic republishing enabled. Publish and copy the generated URL. This is not the normal spreadsheet editing/share link. Workspace policy may prohibit public publishing; use another public CSV/JSON host in that case.
3. In this repository edit `data/config.json` once:

```json
{
  "eventsFeed": {
    "url": "https://docs.google.com/spreadsheets/d/e/YOUR_PUBLISHED_ID/pub?gid=0&single=true&output=csv",
    "format": "csv"
  }
}
```

Use the exact URL Google gives you, including the correct tab `gid`. Do not paste a password, access token or unpublished document link.

4. Commit that configuration. The publishing workflow will run. From then on, edit rows in the spreadsheet: the scheduled workflow refreshes the site approximately every six hours. **Actions → Publish portal → Run workflow** triggers a refresh sooner. Google publication caching and GitHub scheduling mean this is not an instantaneous synchronization service.

The repo’s Pages publishing source must be **GitHub Actions**, not branch publishing, for the feed-refresh build step to run. Public GitHub repositories can have scheduled workflows disabled after inactivity; re-enable the workflow in Actions if needed. A scheduled run does not execute JavaScript in a visitor’s browser and requires no permanently running server.

No Sheet has been created or connected automatically. With the default empty URL, `data/events.json` is the source.

## Columns

| Column | Required | Meaning |
|---|---|---|
| `id` | Recommended | A unique, stable identifier, such as `workshop-2027-03-12`. |
| `title` | Yes | Public event title; plain text. |
| `start` | Yes | Date or ISO timestamp, with conventions below. |
| `end` | Recommended | End timestamp, or exclusive all-day end date. |
| `kind` | No | A short category: Open House, Workshop, Concert. |
| `location` | No | Venue/address or online location. |
| `description` | No | Short public description, up to 1,200 characters. |
| `url` | No | Public event detail, registration or programme link. |
| `linkLabel` | No | For example Programme (PDF) or Registration. Defaults to Details. |
| `published` | No | `false`, `no` or `0` hides a row. Blank/true publishes it. |
| `status` | No | Optional visible note such as Cancelled or Postponed. |

`published=false` hides an entry from the portal; **it does not make its spreadsheet row private**. The entire published tab remains public. To protect private information, do not put it in that tab.

Keep date columns formatted as **Plain text** in Google Sheets so it does not replace an ISO timestamp with a locale-dependent date. Commas, quoted text and multiline descriptions are supported by the CSV parser. A CSV with headers and no events is valid and intentionally clears the listings. Duplicate IDs, malformed CSV or invalid dates cause the complete refresh to fall back rather than silently deleting selected entries.

## Times and automatic archiving

Timed events use explicit ISO 8601 offsets:

```text
2027-03-12T14:00:00+01:00    Vienna standard time
2027-06-12T14:00:00+02:00    Vienna summer time
```

Seconds may be omitted. Do not use ambiguous values such as `12/03/27 14:00` or a timestamp without an offset. A time with `Z` denotes UTC. The portal always converts the actual instant to `Europe/Vienna` for display, even when a visitor is abroad.

An event stays in Upcoming while in progress and moves to Archive at its end time. Set an end for workshops/concerts. A timed event **without an end** moves to Archive immediately after its start; the portal does not invent a duration. Start and end cannot mix date-only and timed formats.

All-day events use `YYYY-MM-DD`. Their end date is exclusive: start `2027-06-12`, end `2027-06-14` means 12 and 13 June. Without an end, a date-only entry lasts for that Vienna calendar day, including daylight-saving days of 23 or 25 hours. Multi-day events are supported. Recurring rules, calendar invitations, automatic Google Calendar import and registration forms are not implemented; add one row per occurrence and link to an external registration page.

Cancellation is an explicit visible `status`, not inferred from missing data. Change a postponed event’s dates as well as its status when new dates are known.

## JSON instead of a spreadsheet

Set `format` to `json` and use any public HTTPS endpoint containing an array of event objects or `{ "events": [...] }`. It uses the same field names. Relative external event URLs resolve against the external feed’s address before being saved to the portal; absolute URLs are preferable for spreadsheets.

## Failure behaviour

Each build validates the local fallback, then requests the external source with a 15-second timeout and 1 MiB size limit. If the request or validation fails, it publishes the repository’s `data/events.json` and sets a visible fallback notice. The deployment can still succeed because the site remains usable. The workflow log explains the failure.

This local fallback is **not** a last-successful-remote cache. Maintain important backup events in `data/events.json`. Fix the feed and re-run the workflow to restore external listings. A failed local fallback validation fails the build and leaves the previous successful website deployment in place.

The portal reclassifies events every minute while open and when the tab becomes visible. A newly published sheet row only arrives after the workflow has refreshed the snapshot and the page is reloaded. Caching/delays can occur at the hosting providers; time-sensitive changes should be verified on the live site.

## Included source event

The opening on 9 June 2026, 10:00–16:30, is sourced from the supplied opening flyer and programme in `Reference/`. The event links to the programme PDF. No future event dates have been invented.

References: [Google — publish Docs/Sheets](https://support.google.com/docs/answer/183965), [GitHub — scheduled workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule), [GitHub — Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
