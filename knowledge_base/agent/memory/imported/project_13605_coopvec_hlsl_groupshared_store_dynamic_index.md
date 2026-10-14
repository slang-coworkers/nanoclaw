---
type: project
name: project_13605_coopvec_hlsl_groupshared_store_dynamic_index
description: "slang#13605 (jkwak-work, self-filed + self-assigned, 10-13 17:25Z): HLSL CoopVec.store to groupshared lowers to a loop indexing the vector with the loop var, so DXC spills it to local memory (~10% step time in a D3D12 training workload). TRIAGED 10-13 18:02Z (cmt 6151925637, enhancement/medium/P2, label reproduced), NO fixer; parked on jkwak-work; re-chase rechase-13605-maintainer-6647 2026-10-21T17:00Z."
metadata:
  node_type: memory
  type: project
---

**2026-10-13 17:2xZ.** Live read before dispatch: OPEN, 0 comments, no labels, filed by jkwak-work
(MEMBER) and self-assigned to jkwak-work. Not bot-filed. The only session on
`gh-issue-shader-slang/slang-13605` was this Main webhook session. Dedup by title search: none.
Adjacent prior art: #13501 (MERGED, groupshared CoopMat Load/Store on HLSL).

Dispatched `slang-triager` on thread `gh-issue-shader-slang/slang-13605` (msg 11): read-only triage
covering the repro at master, the lowering site, dedup, and the verified 5-bullet. **No fixer**,
following the self-assigned-maintainer precedent ([[project_13496_unify_struct_class_parsing]],
[[project_12059_coopmat_fill_splat_discard]]).

RESUME: the triager report, or jkwak-work explicitly asking the bot for a PR (arrives as a webhook;
same trigger as [[project_12279_precise_local_cuda_cpp_invalid_token]]).

17:31Z triager progress (msg 10, its claim, not yet verified by Main): reproduced at master 584103334.
HLSL emits a loop that indexes `v_0[i_0]`, `-DUNROLLED` emits 32 constant-index stores, and SPIR-V emits
one `OpCooperativeVectorStoreNV`. It is still tracing the lowering site and checking for duplicates;
no GitHub comment yet. Awaiting the final 5-bullet.

**18:04Z triage report (verified live by Main 18:0xZ: cmt 6151925637 by nv-slang-bot[bot], 3903 chars,
5 bullets; issue has 1 comment, label `reproduced`, assignee jkwak-work).** Main spot-checked at
origin/master 5841033344: `store(__ref groupshared T[M], int)` has only `case spirv:` plus a `default:`
loop with no `[ForceUnroll]`. The HLSL `__Load` (groupshared) is `[ForceUnroll]`; both `__Store`
overloads are `case hlsl: static_assert(false, "Not supported")` stubs. Verdict enhancement (codegen
perf) / medium / P2 / core module → HLSL; no dup; not a regression (default loop dates from #6223).
#13501 is not a usable template (DXC linalg.h has groupshared Load/Store only on Matrix).
Options in the comment: (a) `case hlsl:` → `__Store` `[ForceInline][ForceUnroll]` loop (HLSL only), or
(b) `[ForceUnroll]` on the default arm (also affects GLSL/CUDA). Siblings with the same spill: store(RWSB),
load(SB/RWSB), exp2/log2; whether to sweep them is jkwak-work's call. Triager memo:
slang-triager `memory/issues/triage-13605.md` (copy at /workspace/inbox/a2a-1791914640725-mz0qvz/).

**Parked** on jkwak-work. Re-chase one-shot `rechase-13605-maintainer-6647` fires 2026-10-21T17:00Z
(dashboard-only, no GitHub post, no fixer without an explicit PR ask). Reopen on a human comment (webhook).

**18:11Z jkwak-work comment 6152084172** (live re-read: unedited, no bot mention): "HLSL doesn't have
load/store for coopvec and groupshared, although there are for matrix. I am not sure [ForceInline] is a
good idea because N can be a very large value. The downstream compiler, DXC will be in a better place to
decide how to optimize a case like this." This leans toward no unroll on Slang's side. It is ambiguous
whether they meant ForceInline or ForceUnroll; their reason is about unrolling. Relayed verbatim to
slang-triager (msg 25, in_reply_to 14): update state, no fixer, no GitHub post by default; any draft
reply goes to Main first. Re-chase task `rechase-13605-maintainer-6647` still armed.

**18:42Z triager update (msg 26): nothing posted, no fixer.** It holds an UNPOSTED draft reply
(slang-triager `/workspace/agent/.gh-comments/draft-13605-reply-unroll-hint.md`, 1774 chars, codex
OUTPUT_REVIEW APPROVE). The draft asks which attribute jkwak-work meant and gives N=1024 DXIL figures on
DXC main 75fba61: no hint → 1 alloca and 1 looped store; plain `[unroll]` → 79-line HLSL, 0 alloca, 1024
stores; `[ForceUnroll]` → 3107-line HLSL, 3.1 s slangc, same DXIL. DXC caps `vector<half,N>` at 1024.
Main confirmed both citations at origin/master 5841033344: store is `[ForceInline]` (:32408), and the
forced-unroll collector selects only `IRForceUnrollDecoration` loops (slang-ir-loop-unroll.cpp ~:795).
**Operator decision ASKED 2026-10-13 (post / edit / hold); default HOLD.** The comment doesn't mention
the bot, and per [[feedback_drafts_only_guardrail]] an unprompted post is the operator's call.
Re-chase `rechase-13605-maintainer-6647` updated to carry the pending decision.
