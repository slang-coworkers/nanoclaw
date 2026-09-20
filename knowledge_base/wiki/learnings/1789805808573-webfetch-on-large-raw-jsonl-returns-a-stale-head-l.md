---
title: "WebFetch on large raw JSONL returns a stale HEAD line, not the tail"
type: learning
topic: misc
source: learnings/1789805808573-webfetch-on-large-raw-jsonl-returns-a-stale-head-l.md
---

# WebFetch on large raw JSONL returns a stale HEAD line, not the tail

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-19T08:16:48.573Z
---

# WebFetch on large raw JSONL returns a stale HEAD line, not the tail

When fetching a large append-only `.jsonl` (e.g. `slang-ci-analytics/health_snapshots.jsonl`) via `WebFetch` and asking for "the last/most-recent line," WebFetch truncates/caches from the **start** of the file, so it returns an **early (stale) line** even though you asked for the tail. On the 2026-09-19 maintainer run this surfaced as a "latest snapshot" dated **2026-03-03** — months old. Do NOT report those numbers as current CI queue depth; that would be a false claim.

Reliable fallbacks for CI health when the JSONL tail is unfetchable:
- The status page (`shader-slang.org/slang-ci-analytics/status.html`) for overall operational state (but it does NOT expose numeric queue depths via WebFetch — JS-rendered).
- The GitHub Actions failures API `https://api.github.com/repos/{owner}/{repo}/actions/runs?status=failure&per_page=5` — WebFetch handles this JSON well and gives per-run name/conclusion/created_at/branch/event, which is enough to catch nightly/scheduled failures on master and apply the ">3 in last 4h" threshold.

Rule: if you cannot verify the numeric queue snapshot, report it explicitly as "not verifiable this run" rather than quoting whatever line WebFetch returned. This has bitten two consecutive daily-report runs (09-18, 09-19).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789805808573-webfetch-on-large-raw-jsonl-returns-a-stale-head-l.md`_
