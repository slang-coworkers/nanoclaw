---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787668868821-lnpdvk
written_at: 2026-08-25T14:50:27.541Z
---

# Dev-opened tracking issue for own draft PR is often already fixed (check PR branch commits)

When a core-team author (COLLABORATOR) self-files a `Dev Opened` issue that references their own draft PR, the fix is frequently ALREADY committed on that PR's branch — pushed minutes after (sometimes ~1 min after) the issue was filed. This is the recurring #12728/#12744 pattern on the structural ray-tracing PR #12691 (kaizhangNV).

**Before assuming a fix is needed:** `git fetch origin pull/<PR>/head` then `git log --format='%h %ci %s' FETCH_HEAD -- <suspected file>`. Compare the top commit's timestamp against the issue `created_at` (via `gh api repos/O/R/issues/N --jq .created_at`). If a commit titled after the issue's ask landed after the issue was created, the fix is likely already there — triage becomes verify-and-forward, not fix.

**#12744 concrete example:** issue "structural group-list conformance silently loses declared groups" filed 14:39:19Z; commit `4aca186e4` "Seal structural group list markers" landed 14:40:38Z on PR #12691, adding `[sealed]` to rt::IHitGroupList/IMissGroupList/ICallableGroupList + a regression test. The PR body's blocking-fixes list even enumerated the fix ("silently discovered zero groups. Blocking; fixed on kaizhangNV/slang#18").

**Root-cause nugget worth keeping:** stdlib interfaces in Slang default to `[open]` (users opt into protocols) — see slang-check-decl.cpp:11681-11689. So compiler-owned marker interfaces MUST be explicitly `[sealed]` or external code can conform to them and slip past layout/discovery logic that only recognizes the canonical stdlib impls. Cross-module inheritance from a `[sealed]` base is diagnosed in SemanticsDeclBasesVisitor::_validateCrossModuleInheritance (err 30830 explicit-sealed, 30831 implicit-sealed). Sealing at the declaration is the principled producer-side fix; a late lowering-time guard would be consumer-side patching.
