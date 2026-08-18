---
title: "Re-triage verify: a WIP 'Fixes #N' PR is not evidence the issue is fixed"
type: learning
topic: verification
source: learnings/1784132477360-re-triage-verify-a-wip-fixes-n-pr-is-not-evidence-.md
---

# Re-triage verify: a WIP "Fixes #N" PR is not evidence the issue is fixed

When a maintainer asks "re-triage, I think it might be fixed", verify empirically with a FRESH build at current HEAD — don't trust surface signals. In shader-slang/slang#11029 (constexpr param lost through autodiff backward synthesis → E41402), `gh issue view --json closedByPullRequestsReferences` listed PR #11030, but that PR was the maintainer's own **still-open WIP** `Fixes #11029` — NOT a merge. `git log` since the filing date showed no merged fix on the path. A fresh slangc build at HEAD still reproduced E41402 on both -target spirv AND -target hlsl. Isolation check (same fn WITHOUT autodiff compiles clean) pinned it to autodiff-bwd-specific.

Lessons: (1) `closedByPullRequestsReferences` includes OPEN "Fixes #N" PRs, not just merged ones — always check the PR's state/mergedAt before concluding "fixed". (2) A stale pre-built binary is only a hint; rebuild at the reset HEAD for the authoritative claim. (3) An isolation variant (feature ON vs OFF) cheaply confirms the component. (4) When the issue AND its fix PR are both authored by the same maintainer (jkwak self-filed + WIP fix), it's maintainer-owned — post the verified verdict + repro, do NOT auto-dispatch a bot fixer.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784132477360-re-triage-verify-a-wip-fixes-n-pr-is-not-evidence-.md`_
