---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787669964607-bub6r7
written_at: 2026-08-25T15:10:23.857Z
---

# Structural-RT Dev-Opened issues on PR #12691 are author self-fixes — verify-and-bounce, don't re-fix

## Pattern: a `Dev Opened` tracking issue whose feature exists only on a core-team member's own draft PR is almost always already fixed on that same PR

Observed across the whole structural-ray-tracing family — #12718, #12728, #12740, #12742, #12743, #12744, and now **#12747** — all authored by **kaizhangNV (core team)** against their own WIP draft **PR #12691** ("Implement structural ray-tracing API").

**Tell-tale signature:**
- Issue author is a MEMBER/COLLABORATOR (core team), label is `Dev Opened` (a self-tracking marker), body ends with "Found while implementing #NNNNN".
- The feature it describes (`import slang.raytracing`, `rt::ClosestHitInput`, etc.) does **NOT exist on master** — it lives only on the referenced draft PR's branch. So it is NOT a top-of-tree repro and NOT a regression (do not apply `reproduced`/`regression`).
- Checking the PR branch head, there is usually a commit — often pushed **within minutes of the issue being filed** — whose title matches the issue verbatim (e.g. issue "Generic result bypasses structural ray-tracing runtime-type restrictions" → commit `f9a56521f` "Reject generic structural runtime results").

**How to triage it fast (saves ~20 min vs. a from-scratch solution search):**
1. `gh api .../issues/N` → note author association + labels + `created_at`.
2. `gh api .../pulls/12691 --jq '{draft, headRefName, headSha, updated_at}'`, then `git fetch origin pull/12691/head:pr-review` and inspect the head commit (`git show <head> --stat`). Compare its timestamp to the issue's `created_at`.
3. If the fix commit is present, read the diff and confirm it (a) sits at the right layer and (b) reuses existing helpers/diagnostics rather than adding a parallel representation.

**Routing consequence (the load-bearing bit):** resolution is an **author/operator call**, not ours. Hand slang-fixer a **verify-and-bounce** (confirm the commit addresses it, stays on #12691, no competing PR) — never open a standalone master PR. Post the triage 5-bullet on the issue and set Type; report up; chain resolves when #12691 merges.

**One correctness check that recurs here:** these "runtime-use restriction" fixes must survive `-ignore-capabilities`. Verify the emitted diagnostics are hard `err(...)` in `slang-diagnostics.lua` (e.g. 20023/20024/20026 for stage/stage-input/metadata), NOT capability warnings — a capability warning would be silently suppressed by `-ignore-capabilities` and fail the issue's requirement.
