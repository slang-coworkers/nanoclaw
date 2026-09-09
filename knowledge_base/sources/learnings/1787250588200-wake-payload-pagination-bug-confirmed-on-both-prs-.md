---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-20T18:29:48.200Z
---

# Wake-payload pagination bug confirmed on BOTH prs and evicted — fix drafted+live-tested

Extends the 08-20 root-cause learning (`1787184948926-wake-payload-prcount-prs-mismatch-root-cause-found.md`). Confirmed today by reading `ncl tasks get task-1776715487702-ftr4s6`'s `script` field directly and live-testing a replacement against the real GitHub API (GH_TOKEN present in-container, works fine — no OneCLI gate this time).

**Both `/pulls?state=open&per_page=50` (for prs/prCount) and `/actions/runs?event=merge_group&per_page=50` (for evicted) are single-page, unpaginated fetches.** Live numbers today: single-page-50 filtered to non-draft = 18; fully paginated = **110 non-draft / 298 total open PRs**. The `evicted` list uses the identical unpaginated pattern — confirmed same defect class, not just hypothesized (prior learning flagged it as untested hypothesis H3; now directly reproduced).

**Fix**: a `fetchAllPages(path, perPage, extract, stopEarly)` helper that loops `page=1,2,...` at `per_page=100` until a short page. Key gotcha: `/pulls` returns a bare array, `/actions/runs` returns `{total_count, workflow_runs}` — the extractor function must be shape-aware per endpoint or you get `Cannot read properties of undefined`. For `evicted`, added an early-stop predicate (oldest item on the page older than the 24h cutoff) so it doesn't walk all ~10k historical merge_group runs every 2-hour fire — without this the "fix" would be correct but expensive.

Also added a `prsTruncated: true/false` field to the output so the truncation (still `.slice(0,20)` for prompt-size reasons) is now visible to the consuming agent instead of silent.

Verified end-to-end: wrote the fix as ESM (`node --input-type=module -e`), ran standalone, then wrapped it in the exact double-quoted bash form the live `--script` field uses (backslash/quote/`$`-escape the JS body) and ran that wrapped form too — identical output both ways. Confirms `ncl tasks update --id <series> --script '<wrapped>'` is a safe drop-in replacement.

**Scope note**: `ncl tasks update --help` shows `--group` as "auto-filled to your own group inside a container" — same pattern as `groups`/`sessions` verbs. `tasks` update on a series owned by your own group is in-scope group action, not a host-only op, even though it wasn't in the CLAUDE.md scoped-resource table (that table is stale/incomplete — `tasks` verbs are group-scoped too).
