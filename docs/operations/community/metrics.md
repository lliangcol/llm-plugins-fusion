<!-- migrated-from: docs/growth/README.md -->
# Growth Metrics

Status: active
Date: 2026-06-02

This page defines the first-round growth measurement package for
`llm-plugins-fusion`. It is a local repository deliverable only; GitHub Topics,
Discussions, social preview uploads, real issue creation, and external posting
remain maintainer-owned manual actions unless performed through the GitHub UI or
an authenticated workflow. It is not a public portal, paid marketplace,
automated posting workflow, or owner-only analytics publication surface.

## Metric Definitions

| Metric | Definition | Source |
| --- | --- | --- |
| Stars | Current repository stargazer count. | GitHub repository API. |
| Forks | Current fork count. | GitHub repository API. |
| Issues | Open issue count, excluding pull requests when collected separately. | GitHub repository and issues APIs. |
| PRs | Open pull request count. | GitHub search or pulls API. |
| Releases | Latest release, release count, and tag/date alignment. | GitHub releases API and `CHANGELOG.md`. |
| Traffic views | Total and unique repository views over GitHub's retained window. | GitHub traffic API; requires push access token. |
| Traffic clones | Total and unique clones over GitHub's retained window. | GitHub traffic API; requires push access token. |
| Referrers | Top external referrers over GitHub's retained window. | GitHub traffic API; requires push access token. |
| Popular paths | Top repository paths over GitHub's retained window. | GitHub traffic API; requires push access token. |
| Visitor-to-star estimate | New stars divided by unique views for the same observation window. | Derived from snapshots; approximate only. |

GitHub traffic data has limited retention, so collect it at least weekly. Daily
collection is better during release or promotion windows.

## Collection Frequency

| Cadence | Use |
| --- | --- |
| Daily during promotion | Track README, showcase, release, and social-preview changes while traffic is active. |
| Weekly by default | Preserve traffic windows and observe trend direction. |
| After releases | Capture latest release state and referrers while announcement links are fresh. |
| Monthly review | Compare stars, forks, issues, PRs, releases, views, clones, and manual channel notes. |

Run the local collector:

```bash
node scripts/collect-github-metrics.mjs
```

Default output is `.metrics/latest.json`, which is intentionally ignored by
Git. Use `--out <path>` only for private dashboards or temporary analysis.
When you know the star count at the start of the traffic window, pass it with
`--stars-before <count>` so the visitor-to-star estimate uses new stars divided
by unique views instead of total stars.

Before using a snapshot for public promotion, pair the growth metrics with
repository readiness evidence:

```bash
npm run doctor
npm run validate:workflow
```

If `npm run doctor` reports that HEAD is not an exact release tag, describe the
content as a development snapshot rather than a stable release.

## Privacy Boundary

- Do not commit `.metrics/` output.
- Do not publish raw referrers, private campaign URLs, internal dashboards,
  tokens, or owner-only traffic details without maintainer approval.
- Do not infer personal user identity from traffic, referrers, clones, or issue
  activity.
- Public docs may describe aggregate metric definitions and collection cadence,
  not private analytics records.

## Manual Channel Record

Use this lightweight format in a private note, spreadsheet, or metrics repo:

```text
Date:
Channel:
Post or release URL:
Message variant:
Linked landing page:
Manual observations:
Stars before / after:
Views / clones if available:
Follow-up:
```

## Manual GitHub UI Checklist

- Add repository topics that match the README wording, such as Claude Code,
  workflow plugin, AI engineering workflow, Agent Skills, and validation-aware
  handoff.
- Upload `docs/assets/social-preview-1280x640.png` through repository settings.
- Enable Discussions only if the maintainer is ready to respond.
- Seed real good-first issues only after the maintainer has concrete tasks and
  review capacity.
- Pin or feature a release only after the release exists and its notes are
  consistent with `CHANGELOG.md`.
