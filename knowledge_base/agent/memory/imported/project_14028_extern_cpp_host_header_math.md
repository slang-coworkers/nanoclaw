---
type: project
name: project_14028_extern_cpp_host_header_math
description: "slang#14028 (albertrodriguezclo, 10-29): host C++ use of -target hpp. Asks 1+2 are fixed in draft PR #14043 (head 1d14af7db, reviewer R2 APPROVE_WITH_NITS, nits applied, Fix Report 21:48Z; assigned to and review requested from jkwak-work; waiting for a human to mark it ready). Asks 3-5 wait on a maintainer; triager re-check t-e153fb on 11-03."
---

# slang#14028: Slang math callable from host C++ (`-target hpp`)

**Routing (10-29).** `issue_opened` 16:18Z landed in Main `sess-1793290703029-v3ixsg`. Live check
16:19Z: open, 0 comments, no labels/assignees/type, author_association CONTRIBUTOR, no prior session
or task for 14028. Forwarded to slang-triager on `gh-issue-shader-slang/slang-14028`.

Five asks in one issue: (1) `__extern_cpp` struct field names mangled (`dist2_0`); (2) header param
names `_0,_1`; (3) no inline/header-only emit (relates to #8827 multiple-definition); (4) slangc emits
an absolute prelude `#include` (no `-prelude-include` flag); (5) documented `Vector`/`Matrix` layout.

**Triage (slang-triager, 16:30Z; memo saved at /workspace/inbox/a2a-1793291414160-nq3gpc/triage-14028.md).**
Ask 1: bug, P2, reproduced. Struct-level `__extern_cpp` is never propagated to field keys
(`lowerMemberVarDecl`). `-no-mangle` skips members (`isGlobalDecl`). Workaround: `__extern_cpp` on
each field. Ask 2: cosmetic, P3; hpp emit drops params and `emitFuncDecl` makes up `_<i>`.
Asks 3–5: P3 feature/docs, **parked for maintainer direction**. Ask 3 is related to #8827 but not a
duplicate. Ask 4 found a dead `-embed-prelude` (E00017). Triager suggested splitting 3–5 but opened
nothing.
**Main live check 16:31Z:** nv-slang-bot comment 6502440111 (no @-mentions, no outside links), label
`reproduced`, Type=Bug. slang-fixer session `sess-1793291431051-8575nm` holds asks 1+2 (one PR) on the
14028 thread. Triager session `sess-1793290843705-8oizti`.
**Timer:** the triager owns one-shot re-check `t-e153fb`, set for 2026-11-03 16:00Z (triager report 16:32Z). I cancelled my own duplicate `recheck-14028-parked-ask-b53c` (11-05) so the two would not race.
**Correction (triager, 16:50Z, after codex review R1 REQUEST_CHANGES → R3 APPROVE).** Fix A1 is unsafe:
`__extern_cpp` on a field gives it a bare linkage name, so same-named fields in different structs merge
into one IR key (verified: HLSL `Right.x : COLOR0` instead of `TEXCOORD0`). The recommendation is now
**A2**: at lowering, add an ExternCpp decoration on the key and keep the key's qualified linkage.
Plus B1, plus a test that same-named fields stay distinct. The public workaround (per-field
`__extern_cpp`) is safe only when field names are unique across `__extern_cpp` structs. Also: the
prelude gap is in the slangc CLI only (the API works); row-major layout is already documented.
Main verified that comment 6502440111 was edited 16:49:53Z and now carries the caveat. The fixer was
re-briefed (triager msg 27).
**Fixer status (17:25Z, branch `fix/issue-14028`, worktree wt-slang-14028).** A2 + B1 built, and the
issue's caller.cpp compiles, links and runs with g++. The fixer's own review found that A2 renames fields
on **every** backend: Metal/WGSL get duplicate members when stage inputs are flattened, and GLSL
keyword field names, `$bit_field_backing` and `-obfuscate` all break. The fixer is redesigning so only
C++/CUDA emit changes. Full slang-test run so far: 8,696 passed, 0 failed. No PR yet.
**Draft PR #14043 (18:26Z; Main-verified).** OPEN draft, `fix/issue-14028`, head 8cd80dda6,
+338/−5 in 12 files, label `pr: non-breaking`, authored by nv-slang-bot. The pr-mappings row points to
slang-fixer session `8575nm`. Only C++/CUDA output changes (field names and header parameter names);
HLSL, GLSL, SPIR-V, Metal and WGSL output is unchanged. Tests: same-named fields in two structs stay
separate, plus cpu/vk/cuda. The body does not say `Fixes #14028`, on purpose, because asks 3–5 stay
open. Issue comment edited 18:25Z. Next: review of the PR, then the fixer's [Fix Report].
**Fixer report (19:08Z).** A new IR pass, gated to cpp/hpp/host-cpp/cuda/cuh, keeps the source names
of `__extern_cpp` fields. hpp/cuh prototypes use parameter names like `p_0` (the source name plus a
suffix, not a bare `p`). The issue's caller runs (`dist2=1`). New and touched tests: 17/17 pass. Full
suite: 11073/11077 pass; the 4 failures are gfx-smoke (fixer build has GFX off) and 3 fp8-cuda tests
failing with `CUDA_ERROR_INVALID_PTX`, **not checked against master**. Peer review requested from
slang-reviewer. Explanation comment 6504963371. Main check 19:10Z: PR checks show 4 passed and 53
skipped (draft), so the CUDA question is still open.
**Review R1 (slang-reviewer, 20:26Z, head 8cd80dd): REQUEST_CHANGES (small).** Asks 1+2 are met and
were verified on the L40S. Full suite: 11074/11077. The 3 fp8-cuda failures **also fail on master
63f45a662**, so they are not from this PR. A corpus of 21,436 file/target pairs showed no change in
exit codes.
🔴 B1: the struct-inheritance key gets the hint `base` with no `$`, so a user field `base` gives a
duplicate C++ member. That is a regression on cpu/cuda. 🟡 G1: PyTorchCppBinding is missing from the
target gate, so torch and CUDA field names differ. G2: no test for host-cpp. G3: C++ keyword field
names give invalid C++ (ask: add a Risk line). The tested `r1-remedy.patch` adds a duplicate-hint
guard; the reviewer's sub-reviewer A prefers a producer-side "declared in source" mark. The fixer has
received it (fixer rows 20/22/24). No GitHub post (not authorized). Next: R2 from the fixer.
**R1 addressed (fixer, 21:04Z): head 19e95e12d, 4 new commits, no force-push.** The pass now chooses
every member name of an `__extern_cpp` struct in one place, so names are distinct by construction;
this replaces the reviewer's guard. `-target torch` field names now match `-target cuda`; host-cpp
has a test; the PR description has the keyword Risk line. Tests: 24/24 new/touched; broader set
3835/3836 (gfx-smoke). R2 review requested from slang-reviewer.
**Review R2 (slang-reviewer, 21:37Z, head 19e95e12d): APPROVE_WITH_NITS, 0 bugs.** All R1 items are
met. Full suite: 11081/11084, and the only failures are the 3 fp8-cuda tests that also fail on master.
Devin's 🔴 (declared-only functions keep `_0`) was rejected: same as master, because such a function
has no IRParams. Nits, applied without another round: N2 test for the parameter-name fallback and
`-obfuscate` (file attached); N3–N5 comment accuracy. N1 (number C++ keyword field names) is optional,
needs a keyword table, and a follow-up is fine. Next: the fixer applies the nits and sends a
[Fix Report], then the draft is ready for a human maintainer. The reviewer names jkwak-work as
shepherd (reviewer's claim, not checked).
**Fix Report (fixer, 21:48Z): asks 1+2 fixed.** Head 1d14af7db, 16 files, +529/−6. The R2 nits are
in c7c9b1ccd and 1d14af7db; N1 (keyword table) is a follow-up. 26/26 headers + extern-cpp tests pass.
Main check 21:50Z: still draft, `mergeStateStatus` BEHIND master, assignee and requested reviewer
jkwak-work (confirmed live). Checks: 4 passed, 53 skipped, so **full CI has not run because the PR is
a draft**. Next is human: review and mark ready. When it is marked ready, a `pr_ready_for_review`
webhook will come; check `paused` on the approvers first (see pr-approvers-paused.md).
