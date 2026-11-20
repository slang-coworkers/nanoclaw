---
type: issue-chain
title: slang#14557 — NVRTC does not enable OptiX for a compute shader that uses optix_coopvec
description: Chain record for issue #14557 / draft PR #14563 (triager → fixer, maintainer-direction fix)
---

# slang#14557 / draft PR #14563 — NVRTC OptiX headers for compute shaders with optix_coopvec

Human-filed 11-17 20:51Z by **jkwak-work** (also assignee; deep triage + fix design in the issue
body and in comment [6960739220](https://github.com/shader-slang/slang/issues/14557#issuecomment-6960739220),
addressed to the bot). Dispatched to slang-triager at once (R6 — no hold; 👀 posted 20:54Z).

## Chain

- **Triager** sess-1794948860135-e0jakd (20:54Z): TRIAGED + REPRODUCED on master `a1f4a539e`
  (bug / medium / target-emit CUDA-NVRTC downstream / P2; not a dup of #8556 [disabled test
  re-enable] or #14015). `reproduced` label + Issue Type `Bug` applied; triage 5-bullet posted
  (comment 6960878011). Triage memo: raw/triage-14557.md (also at
  /workspace/inbox/a2a-1794949206062-cxro9r/triage-14557.md).
- **Fixer** sess-1794949221382-lyhnni (21:00Z, canonical thread, handoff verified landed):
  **draft PR #14563** opened 11-17 22:14Z — `nvrtc: enable OptiX headers for compute shaders that
  use optix_coopvec`, branch `fix/issue-14557` → master, head `b9cbedfe5` → round-2 head
  `1feab0e35` (review nits applied, 23:28Z), author nv-slang-bot, pr-mapping wired (routes
  webhooks to the fixer session). Explanation HTMLs delivered to Main 22:21Z and 23:28Z
  (round-2) in /workspace/inbox/.

## Fix design (maintainer-endorsed, triager-confirmed approach A)

Decouple the two decisions NVRTC makes from the single `PipelineType::RayTracing` value:
new `DownstreamCompileOptions` field (Flag bit 0x80 or `bool requiresOptix`) set in
`CodeGenContext` from RT stages OR `getTargetCaps().implies(CapabilityAtom::optix_coopvec)`
(the emitter's own test, slang-emit-c-like.cpp:116); `_maybeAddOptixSupport` keyed on the field;
`--relocatable-device-code=true` stays tied to `RayTracing` only. Gate at
slang-nvrtc-compiler.cpp:1434; stage→pipelineType at slang-code-gen.cpp:926-956.

**Scope decisions:**
- `external/optix-dev` v9.0.0 → v9.1.0 submodule bump lands INSIDE this fix (distinct commit,
  easy to drop if maintainers prefer a standalone bump PR) — without it the fix is inert under
  NVRTC (9.0.0 `optix_device.h:2160-2165` sets `OPTIX_INCLUDE_COOPERATIVE_VECTOR 0` under
  `__CUDACC_RTC__`).
- `no-downstream-validation` (named in the issue) does not exist in-tree; the fix updates the
  test to use `-validate-with-downstream-compiler` instead.
- Watch CI on existing `tests/cuda/optix-*.slang` tests that consume the vendored headers.

## State (11-17 23:28Z — REVIEW COMPLETE, ready-flip pending)

Final [Fix Report] 23:28Z: peer review **APPROVE_WITH_NITS** (A: 0 bugs; Devin clean; C: 7 clarity
items) — all applied at head `1feab0e35`, no further round; codex PLAN/CODE/OUTPUT_REVIEW
re-approved at the new head. 4 commits, 8 files, +59/−13: shared predicate
`isOptixCoopVecEnabled` in `slang-capability.h` now used by emitter + flag setter +
`lowerCooperativeVectors` gate (per review, one source of truth). Declined-with-evidence items
recorded in the plan (re-enable optix-coopvec.slang needs CI runtime SDK → adjacent #8556;
slang-test OptiX skip signal beyond scope; CUDA-gating the stage flag avoided as behavior
change). Fresh-rebuild verification at 1feab0e35 (NVRTC 12.6, L40S): coopvec 221/221,
downstream-validation 9/9, cuda 149/149 incl. all optix; repro exit 0 (255 on master); compute
gets OptiX define+include without RDC, RT keeps RDC. CI run **44194269609** running at the final
head; explanation comment
refreshed (6962589322); issue thread updated (6962695052). Infra note: codex 429-stormed
mid-turn, stages re-recorded after backoff — resolved.

## TERMINAL (11-18 06:16Z)

**Fixed via the maintainer's own PR — chain closed.** jkwak-work merged his **PR #14560**
(same suggested approach: RequireOptix-style downstream flag + optix-dev v9.1.0) at 04:51:23Z;
issue **#14557 auto-closed** 04:51:25Z; our duplicate draft **#14563 closed** 06:14:12Z (the
expected duplicate landing per the leave-open-then-he-picks disposition). Main-verified from
live state: #14560 MERGED/by jkwak-work, #14563 CLOSED, #14557 CLOSED. Fixer cleaned up
worktree wt-slang-14557 and its sentinel; fixlog rows moved to terminal. Fleet learning shared
by the fixer: check for a maintainer's own PR before opening ours (his 21:31 PR predated our
22:14 by 43 min — a PR-open-time check would have caught it). Ready-flip entry moot.

Outcome: issue fixed on master via #14560; our #14563 served as the independently-reviewed
cross-referenced alternative; no maintainer complaints on record; zero open items.

## Historical disposition (11-17 23:31Z, Main-decided) maintainer jkwak-work opened his own
PR **#14560** (`use-optix-for-cuda-coopvec`, non-draft, same files/approach) at 21:31:16Z — 43 min
BEFORE our draft #14563. Fixer posted a transparent cross-reference comment (6964115180, no
pings). **Main verdict: leave #14563 open — do not close.** Rationale: jkwak-work directed our
implementation himself (his 20:55 suggested-approach comment to the bot is the design both PRs
implement); precedent #14307 (competing human PR #14308 vs our #13381 — both stayed open,
maintainer picked ours); he is the auto-assigned shepherd of OUR PR and now has the
cross-reference; leaving open is quiet/reversible, closing is a public preempt of his choice. No
further posts; no pings; he picks. If he closes ours or merges #14560 → terminal for this chain.
Also dispositioned this turn: replayed review verdict (already applied — nothing redone) and the
23:24 gate-block notification (sibling session's PR #14565, different issue — cross-session noise,
not ours).

**RESTING on maintainer review of draft PR #14563 (shepherd jkwak-work, auto-assigned) — OR his
own #14560, whichever he picks. Ready-flip pending on the weekly undraft list; resume on human
comment/CI webhook only.**
Related: #8556 (re-enabling tests/cuda/optix-coopvec.slang needs the OptiX SDK at run time —
separate problem, not this chain).
