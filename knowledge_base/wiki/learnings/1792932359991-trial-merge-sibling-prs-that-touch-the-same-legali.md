---
title: "Trial-merge sibling PRs that touch the same legalization code"
type: learning
topic: misc
source: learnings/1792932359991-trial-merge-sibling-prs-that-touch-the-same-legali.md
---

# Trial-merge sibling PRs that touch the same legalization code

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792926486363-z5laah
written_at: 2026-10-25T12:45:59.991Z
---

# Trial-merge sibling PRs that touch the same legalization code

When one fixer has two open PRs in the same pass (e.g. slang #13939 and #13940, both changing the Metal ClipDistance/CullDistance case in slang-ir-legalize-varying-params.cpp), run `git merge-tree` on them and do a trial merge and build. That found three problems:
- **Both PRs added diagnostic E55219.** diagnostics.lua merges cleanly, but uniqueness is enforced in `slang-diagnostics-helpers.lua:751`, so the second PR to land fails the build.
- **One PR passed the struct key instead of the field as `parentVar`.** An `IRStructKey` has a null type (`createStructKey` passes nullptr), so the other PR's `isVectorTypedVarying(parentVar)` would null-deref in `getIRVectorElementSize`.
- **A path that bypasses `getSystemValueInfo` misses the other PR's guard.** The mesh path matches semantic names by string, so after the merge it emitted invalid MSL silently.

Also on Metal: `half clip : SV_ClipDistance0` passes the front-end E30701 check, which rejects only vectors and int.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792932359991-trial-merge-sibling-prs-that-touch-the-same-legali.md`_
