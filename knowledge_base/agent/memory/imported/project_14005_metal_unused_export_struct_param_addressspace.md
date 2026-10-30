---
type: project
name: project_14005_metal_unused_export_struct_param_addressspace
description: "slang#14005 (EiffelOberon, 10-29 09:28Z): on Metal, an unreachable `export` function with a struct/array param aborts 'Unknown addressspace encountered'. Same root cause as open #11981; fix = revive stale draft PR #12014 (fix/issue-11981). Triaged 09:34Z; slang-fixer session waxpq5 on gh-issue-shader-slang/slang-14005."
---

# slang#14005: Metal aborts on an unused `export` function with a struct parameter

**Routing (10-29).** `issue_opened` 09:28Z landed in Main `sess-1793266096843-8j7q17`; forwarded to
slang-triager on `gh-issue-shader-slang/slang-14005` (triager session `r2506n`).

**Triage (slang-triager, 09:34Z; reproduced at master `01dcd3568`).** bug / medium / P2,
target-emit (Metal) + IR. `transformParamsToConstRef` turns a struct/array `in` param into
`BorrowInParam(Generic)`; the address-space worklist seeds only from entry points
(`slang-ir-specialize-address-space.cpp:676`), so an uncalled export keeps `Generic`, and only the
Metal emitter lacks a `Generic` case (`slang-emit-metal.cpp:1469`). Same root cause as open #11981
(out/inout). Recommended fix A: seed exported functions into the worklist and default their Generic
params to `thread` — the design of bot draft PR #12014.

**Main live check (09:36Z).** Label `reproduced`, issue type Bug, triage comment 6493142743
(nv-slang-bot 09:35:04Z; no links, no @-mentions). #12014: OPEN draft, `fix/issue-11981`,
CONFLICTING, last updated 08-11, **no pr-mappings row** — so the 14005 fixer session can take it
over. slang-fixer session `sess-1793266472548-waxpq5` on the 14005 thread since 09:34Z.

**Overlap with #14004 (triager, 09:36Z; Main-verified live).** #14004 (j8asic, `-obfuscate` gives two
specialized copies the same name on WGSL/Metal; OPEN, `reproduced`, no PR yet) is fixed in slang-fixer
session `sess-1793263707074-ar32jd`. Its fix changes how the export marker is copied onto specialized
clones, which #12014 depends on, so the two must be coordinated or landed in order. Asked the triager
(its parent) to make sure both fixer sessions know and to name the order; Main does not skip a tier.

**Order decided (triager, 09:37Z):** #14005 / PR #12014 lands first; #14004 rebases on top. Why:
#14005 is a live crash with maintainer direction on #11981; #14004's exact repro is already fixed by
#13648 (only an `-obfuscate` naming residue is left, with a close-as-fixed option open). Both edit the
end-of-pass cleanup in `slang-ir-specialize-address-space.cpp`. On rebase, #14004's strip-export-name-
from-clone rule must fire whenever the original is kept (not only when it has uses), plus a Metal
`-obfuscate` test. Both fixer sessions told (ar32jd msg 17, waxpq5 msg 19); if #12014 stalls the
#14004 session escalates to the triager rather than reorder.

**Design change (triager, 10:12Z, from slang-fixer msg 12):** #12014 no longer keeps exports alive
through the end-of-pass cleanup. Measured against master, that broke programs master compiles: a dead extra
`thread` clone when every call goes to a specialized copy, a buffer-param export emitted twice, and an
earlier-pass `[export]` clone kept as dead code. New design: seed every export into the address-space
worklist (uncalled exports get `thread` pointers), cleanup unchanged from master. #14004's extra rebase
requirement was withdrawn; it now needs only a `-obfuscate` test where one export is called with both a
`thread` and a `threadgroup` pointer and the clones get distinct names. The overlap is textual only. The
#14005 fixer was asked to add the measured regressions as tests (msg 25). Order unchanged.

**PR #12014 R1 review (slang-reviewer session zvr4hu, 11:51Z, @a78ba1033, requested by the fixer):**
REQUEST_CHANGES, 0 bugs / 4 gaps / 1 question. M1 (jkwak-work's "producer-side fix" on #11981) met; 13
Metal inputs that crash on master compile; other targets byte-identical; head suite 0 regressions.
G1: the single-pass sweep makes export survival order-dependent (one call order leaves a dead `thread`
copy) -> fixpoint sweep + ORDER test (tested `remedy-12014.patch`). G2: the self-registration is pinned by
no test (the fixpoint sweep makes it load-bearing). G3: the `int*` concrete-space guard is untested. G4:
the reporter's `extern` link-time variant is untested. Q1: the intended shape of an earlier-pass
`[export]` clone. Known limit: an uncalled export doing atomics through `inout` -> invalid MSL
(`atomic_int thread*`); suggest a follow-up issue. Not posted to GitHub (no marker); the PR is still a
draft, MERGEABLE now. The combined report also reached Main as a "parent" copy; the fixer has it.
Live files: `/workspace/inbox/a2a-1793274657994-uvxqkp/12014-r1-combined-review.md`.

**Follow-up filing decision (12:31Z):** the triager asked whether to file "Metal: atomic op through an `inout`
param bound to thread-local memory emits invalid MSL instead of E41403" (pass order:
`validateAtomicOperations` runs before `specializeAddressSpaceForMetal`; pre-existing, not a #12014
regression). Main reproduced it (local Release slangc, 08-04 build): Metal rc=0 with `atomic_int thread*`,
SPIR-V E41403; no duplicate open issue. Per policy the operator decides follow-up filings, so I escalated
to the dashboard with the draft (msg-1793277157113-bfnyaz). Default = not filed, with a Risk line in the #12014
description. #12014 R2 at `ce5e519e7`; the fixer reports tests/metal 234/234 and full suite 11274/11277.

**PR #12014 R2 review (13:33Z, @ce5e519e7):** REQUEST_CHANGES. All R1 findings fixed and pinned. New: **B1
🔴** an uncalled `export uint64_t addressOf(int* p){return bit_cast<uint64_t>(p);}` SEGVs on head (master
rc 0): `processFunction`'s BitCast case maps an address space onto a non-pointer result, then the Return case
null-derefs. Remedy: map only when the bitcast result is a pointer. **G5** clones made inside a seeded export
are never sweep candidates -> dead copies (fix: `functionsToConsiderRemoving.add(specializedFunc)`). G6: no
metallib run in the new tests. **G7**: the atomics gap also reaches *called* exports (the dead uncalled
original keeps `atomic_int thread*`), so the follow-up draft should name that case. Tested
`remedy-12014-r2.patch` (+33/-6), suite 11056/11059 (fp8-cuda x3). That was round 2 of 2 for the fixer: ship
the better diff and list what is left. Triager (13:35Z): G7 is folded into the draft (with `g7-called-export.slang`); the fixer was told (msg 35) that B1 must be fixed, with a `b1-addressof` test, before the PR goes ready; the suite gate is no worse than 11274/11277.

**[Triage Resolution] (14:40Z), checked live by Main:** #12014 is a DRAFT at head `1b7300925`, MERGEABLE, B1 fix
present (bitcast maps an address space only when the result is a `IRPtrTypeBase`). `Fixes #11981` + `Fixes #14005`.
Reviewers requested: jkwak-work and juliusikkala; assignee jkwak-work. The pr-mappings row is the fixer's session
waxpq5. The triager edited status comment 6494735991 in place (no links or mentions). Still open: G6 (metallib
runs only on macOS CI), G7 (in the follow-up draft), C001/C005 (documented, not restructured). The fixer
reports a full suite of 11275/11278 (fp8-cuda x3). CI run 40892314609 was `waiting`.

**Parked on humans.** Maintainer review and merge. Operator asks on the dashboard: (a) file the atomics follow-up
(default: don't file); (b) mark #12014 ready (default: leave as a draft). Timer: one-shot `rechase-14005-draft-pr-1-203f` at 2026-11-02 15:00Z.
After the merge: tell the triager so #14004 rebases.
