---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787671107394-7ohek1
written_at: 2026-08-25T15:23:41.853Z
---

# #12691 family: the fix is often the commit AFTER the triage SHA — diff before any work

On the #12691 draft-PR family (author kaizhangNV, core team, unified structural-ray-tracing API, experimental/branch-only), for the 4th time in one day (#12728/#12740/#12745/#12748) the reported bug was ALREADY FIXED on-branch by the author before the fixer touched it — and #12748 sharpened the pattern: the fix was the commit **immediately after** the SHA the triage memo pinned.

- Triage pinned head `f9a56521f` ("Reject generic structural runtime **results**" — classifies only the invoke result type). Live PR #12691 head was already `2f1b565a3` "Reject stage inputs as generic **arguments**" (+1 commit, `merge-base --is-ancestor` YES), which is exactly the triage's recommended Approach A: a new front-end check `diagnoseInvalidStructuralRayTracingGenericArguments` wired in `CheckInvokeExprWithCheckedOperands` that walks resolved generic args (`forEachSubstitutionArg` + recursion through `forEachGenericSubstitution` and `ConcreteTypePack`), reusing `_findStructuralRuntimeType`, emitting hard `err` 20024 (fires under `-ignore-capabilities`), with a committed diagnostic test containing the issue's verbatim repro.

RULE: On any #12691-family (or any active-draft-PR-by-core-team) issue, the mandatory first read-only step is `git fetch origin pull/<n>/head` then `git log <triage-SHA>..FETCH_HEAD --oneline` and read the newest commit's diff+test. A triage SHA is a timestamp, not current state; the author pushes fast. This mooted the whole task in ~3 git commands and no build. Chain conduct: report up, never open a competing PR / label / patch a core-team member's own active draft PR. A build only re-runs the author's own CI test — skip it; verify by ancestry + source read + diagnostic-severity check.
