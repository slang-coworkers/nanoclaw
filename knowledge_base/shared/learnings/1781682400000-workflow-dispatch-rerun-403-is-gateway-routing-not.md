# workflow_dispatch / run-rerun 403 "Must have admin rights" is a GATEWAY ROUTING bug, NOT a missing actions:write

**Symptom (what you'll see):** `gh workflow run …` (CI dispatch) or `gh run rerun <id> --failed` against `shader-slang/slang` fails with:

```
HTTP 403: Must have admin rights to Repository.
```

Endpoints: `POST /repos/shader-slang/slang/actions/workflows/{id}/dispatches` and `POST /repos/shader-slang/slang/actions/runs/{id}/rerun-failed-jobs`.

**DO NOT diagnose this as "nv-slang-bot is missing actions:write" — that is WRONG.** The GitHub App installation DOES carry `actions:write`, and `gh-app-token.py` already requests it. The mint side is correct.

**Real root cause (operator-verified live 2026-06-17):** OneCLI gateway secret-routing collision. The dispatch/rerun path matched **two** Authorization secrets on `api.github.com`:
- `2b90efbf` `/repos/shader-slang/*` → App token (HAS actions:write) ✅
- `087efab9` `/repos/*` → nv-slang-bot **USER PAT**, which is **read-only on the public shader-slang repo** (`push:false`) ❌

With no specificity sort in the gateway (last-applied/heap-order wins — see the OneCLI gotcha #2), the read-only USER PAT was winning the `Authorization` header → 403. A `gh run rerun` 403 here is the SAME bug, not a separate fork-permission issue.

**Discriminator proving it's routing, not permission:** the same dispatch probe gives **422 "No ref found"** (permission PASSES) when run with a fresh App token directly from the host (bypassing the gateway), but **403** through the container/gateway. Host-422 + container-403 = routing/wrong-token, NOT a GitHub-side revocation. Also: the bot's comment/PR writes (`issues:write`/`pull_requests:write`) keep succeeding (201) the whole time — only Actions-write 403s — which rules out a generic token outage.

**Fix (applied 2026-06-17, gateway secret):** added a dedicated App-token secret `8d85bfeb` with path `/repos/shader-slang/slang/actions/*` (literal prefix — a middle-wildcard like `/repos/shader-slang/*/actions/*` does NOT match; OneCLI globs are segment-prefix). It's in the 30-min refresh cron, written LAST of the shader-slang App secrets so it stays the newest tuple and wins the header. Verified: real dispatch on master → **204**; rerun probe → **404** (not 403) with `injections_applied=3`.

**How to apply / what this unblocks:**
- The Slang CI Babysitter's CI-backlog dispatch (`gh workflow run ci.yml`) now works.
- The slang-fixer's `github.ci_failed` webhook handling — both `gh workflow run` (re-trigger CI on a fix branch) and `gh run rerun --failed` (infra/flaky retry, up to 3×) — now works.
- If you see this 403 again: do NOT escalate "grant actions:write" to the org and do NOT restart the container (the gateway will re-inject the same read-only PAT). Check that `8d85bfeb` still exists, is refreshed by the cron, and is the newest tuple on the shader-slang actions path.

Related: the inverse of the cross-fork-PR case (there GraphQL wrongly got the App token; here REST actions wrongly got the read-only PAT). Same family: OneCLI same-tier path overlap with no specificity sort. See `~/onecli.md` gotcha #2.
