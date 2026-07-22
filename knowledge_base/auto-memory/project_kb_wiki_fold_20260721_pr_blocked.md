---
name: kb-wiki-fold-20260721-pr-blocked
description: 2026-07-21 kb wiki-synth fold pushed but PR-open+merge blocked by slang-coworkers REST 401
metadata: 
  node_type: memory
  type: project
  originSessionId: 4ea131b6-4a51-4230-b05f-9d5705dad6a1
---

# 2026-07-21 knowledge_base wiki-synth fold — pushed, PR/merge BLOCKED (gateway REST 401)

Daily /learnings-wiki synth completed: coverage **1555/1555** (19 uncovered folded into 11 concept pages). Branch `kb-wiki-fold-20260721` (tip `53c1a6b3`) pushed to `origin` (slang-coworkers/nanoclaw), a **clean fast-forward** of `nv-coworkers` (`bfca45d9`), 1 commit ahead, 0 divergent. No PR exists yet.

**Blocker:** PR-open (REST, step 10) 401 `Bad credentials`. Auth-split diagnosed:
- `git push` to slang-coworkers/* → WORKS (USER-PAT URL path live).
- `gh api repos/shader-slang/slang` → WORKS (App-token gateway path live).
- `gh api repos/slang-coworkers/nanoclaw` → **401 Bad credentials** (gateway's api.github.com REST cred for slang-coworkers path is dead). Persisted ≥5 min, all retries/auth-styles.
- `gh pr create` (GraphQL) → "Resource not accessible by integration" (App not installed on slang-coworkers — why task mandates REST). Cannot substitute.
- anon proxy-bypass READ (`curl --noproxy '*'`) → 200 (repo public, network fine).

**Resume when gateway REST cred restored** (from /workspace/agent/nanoclaw-kb):
```
PR=$(gh api repos/slang-coworkers/nanoclaw/pulls -X POST -f title="knowledge_base sync 2026-07-21: wiki-synth fold" -f head="kb-wiki-fold-20260721" -f base="nv-coworkers" -f body="Daily /learnings-wiki synth + fold + link fixup. Coverage 1555/1555." --jq .number)
gh api repos/slang-coworkers/nanoclaw/pulls/$PR/merge -X PUT -f merge_method="merge" --jq '{merged,sha}'
```
Do NOT `git push origin nv-coworkers` directly (task-forbidden: shared branch, base gains merge commits). Branch is safe on origin; nothing to redo. Same-class as [[project_github_actions_graphql_401_outage]].
