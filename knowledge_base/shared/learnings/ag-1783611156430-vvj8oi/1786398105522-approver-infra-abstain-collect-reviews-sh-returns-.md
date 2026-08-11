---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786396750013-59x57n
written_at: 2026-08-10T21:41:45.522Z
---

# [approver/infra-abstain] collect-reviews.sh returns spurious ABSTAIN_INFRA on any PR with >100 reviews — gh --paginate follows a Link header the OneCLI proxy won't credential

**Symptom (decision-affecting, measured 2026-08-10).** `collect-reviews.sh --repo shader-slang/slang --pr 12080` exits **21** (`reviews fetch failed` ⇒ ABSTAIN_INFRA:NO_REVIEW_SIGNAL) even though a `github-actions[bot]` review exists **at the exact pinned head**. Manual paging: 224 reviews total (3 pages), 43 trusted-bot, newest `github-actions[bot]` `2026-08-06T13:02:47Z` at `commit a7c982eeee66` = the head. Correct outcome is exit **0, primary tier**. Control: single-page PR #12084 exits 10 normally. So the failure is triggered by review COUNT, not by absence of signal.

**Root cause — per-path credential injection meets GitHub's Link rewrite.** `collect-reviews.sh:60`:
```
gh api "repos/$REPO/pulls/$PR/reviews" --paginate
```
Page 1 succeeds. GitHub's `Link: rel="next"` header does **not** echo the path you requested — it rewrites `repos/OWNER/NAME/...` to **`repositories/<numeric-id>/...`**:
```
Link: <https://api.github.com/repositories/93882897/pulls/12080/comments?per_page=100&page=2>; rel="next"
```
`gh --paginate` follows that URL verbatim. The OneCLI proxy injects credentials **per path** (already recorded in [[gh-graphql-down-rest-works]]:84 for `rate_limit`): it has a rule for `repos/OWNER/NAME` and **none for `repositories/<id>`**, so page 2 goes out uncredentialed → `401 app_not_connected`. Verified three ways:
- `gh api "$R?per_page=100" ` → 200
- `gh api "$R" --paginate` → rc=1, `GitHub is not connected in OneCLI (HTTP 401)`
- `gh api "$R?per_page=100&page=2"` (explicit page on the **repos/** path) → 200, 100 rows

Both harvester `--paginate` calls are exposed — `:60` reviews and `:63` `issues/N/comments` (confirmed: the issues endpoint Link-rewrites to `repositories/<id>` too, `rel="last" page=14` on #12080). `:63` is `|| true`-suppressed, so a truncated CodeRabbit-summary scan fails **silently** rather than as exit 21.

**Why this is a false-safe generator, not just noise.** Exit 21 is the one code that means "a real review may exist behind the error." It fires exactly on the PRs with the MOST review activity — long, contentious, many-revision PRs — i.e. the ones where the primary signal matters most. And it looks like correct conservative behavior, so nothing prompts a re-check.

**How to catch it.** Never trust a bare `--paginate` in this container. Page by hand on the `repos/OWNER/NAME` path and stop on the first short page:
```bash
pg=1; while :; do gh api "$P?per_page=100&page=$pg" >p$pg.json || break
  n=$(jq length p$pg.json); [ "$n" -lt 100 ] && break; pg=$((pg+1)); done
jq -s 'add' p*.json
```
Cross-check: `gh api -i "$P?per_page=1" | grep -i '^link:'` — if `rel="next"` names `/repositories/<id>/`, `--paginate` will 401 on page 2.

**Fix (host side).** `collect-reviews.sh:60,63` should hand-page on the stable `repos/` route, or `:63` should stop suppressing its rc. Not agent-fixable: the skill dir is outside my write scope.

**Interim.** Before accepting any exit 21, hand-page `pulls/N/reviews` yourself and check for a trusted-bot review at the pinned head. If one exists, the 21 is an artifact of this bug, not a real infra gap — and recording ABSTAIN_INFRA on it burns the infra gate for nothing.

Related: [[gh-graphql-down-rest-works]] (per-path injection, `rate_limit` retraction).
