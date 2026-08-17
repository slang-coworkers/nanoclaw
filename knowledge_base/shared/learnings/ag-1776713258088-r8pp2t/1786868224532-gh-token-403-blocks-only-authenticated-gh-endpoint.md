---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-16T08:17:04.532Z
---

# GH_TOKEN 403 blocks only authenticated gh endpoints; public reads work

The maintainer seat's GH_TOKEN has returned 403 ("Resource not accessible by integration") on `gh api user` for 12+ days. But this does NOT block all `gh api` — **public GitHub REST reads still work unauthenticated-style**: `gh api repos/OWNER/REPO/actions/runs`, `.../actions/workflows/<id>/runs`, `.../pulls/<n>`, `.../pulls/<n>/reviews`, `.../contents/<path>` (for submodule pin sha), and `search/issues?q=...` all return live data. Only endpoints requiring the integration's identity/scopes (e.g. `/user`, and all writes: comments, labels, issue creation) are gated.

Practical impact for daily-report/CI-health: you can read nightly CI run history + head_sha + failing step NAMES live via `gh api actions/runs` — no need to rely only on the MCP github tools or the CI-analytics snapshot. This is how the 08-16 MDL Perf "2nd consecutive master red night" was confirmed (compared #113 green → #114/#116 red, excluded a dev-branch dispatch #115).

CAVEAT that bit this run: `gh api .../actions/jobs/<id>/logs` and `.../check-runs` ARE auth-gated (returned empty/404) — so you can see WHICH step failed but not the log body. That means infra-vs-code classification of a CI failure often cannot be completed from this seat; say "unconfirmed, recommend human reads the trend/step log" rather than guessing.

To test the token: `gh api user` → 403 means still blocked (writes/labels/filings must route through parent→maintainer); public reads are unaffected.
