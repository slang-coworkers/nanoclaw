---
type: project
name: project_13878_aligned_immutable_ptr_loads
description: "slang#13878 (tdavidovicNV, MEMBER, 10-22 19:59Z; HUMAN-OWNED @kaizhangNV since 10-23): loadAligned rejects ImmutablePtr<T> (needs ReadWrite); CUDA __ldg path drops alignment; D3D12 BAB LoadAligned alignment never reaches HLSL/DXIL. Companion #13877 (StructuredBuffer grouping) is a sibling Main's chain. Related: PR #10098, #11545/#11593/PR #11803, #13126/PR #13130. ROUTED to slang-triager 10-22 20:0xZ; triaged 20:12Z (cmt 6350271779, `reproduced`), PARKED on @csyonghe choosing (a) bot signature-only PR vs (b) revive #10098; re-check 10-26 closed the bot out — TERMINAL for bot."
---

# slang#13878 — aligned immutable-pointer loads across CUDA / Vulkan / D3D12

**10-22 19:59Z `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, no
assignee, created ≈ updated, body = payload. Timeline: one `cross-referenced` from companion
#13877 (same author, same minute; owned by sibling Main `sess-1792699177480-nwgahs`). My webhook
session `sess-1792699177948-afjdhm` was the only session on `gh-issue-shader-slang/slang-13878`;
no task. Bug-report shape, no fix direction of the author's own → not a maintainer-owned plan.
R6 gate nanoclaw#1993 still draft → routing unchanged.

**Dispatched** to `slang-triager` on the canonical thread (first send hit `database is locked`
and landed nothing; I checked before retrying, so exactly one dispatch). Brief: verbatim repro,
scope #13877 out, check overlap with PR #10098 (csyonghe full-pointer-signature, idle since
06-26), #11545/#11593/PR #11803 ([[project_11545_bytebuffer_alignment_chunker_stack]]), and
#13126/PR #13130 (alignment-operand drop); run CUDA/Vulkan checks on the L40S, D3D12 compile-only.

**10-22 20:13Z triage report** (memo: `/workspace/inbox/a2a-1792699989575-fppklr/triage-13878.md`).
I checked the receipts: bot comment `6350271779` is the only comment and @-mentions csyonghe;
label `reproduced`; the re-check session exists in the triager group on
`system:tasks:i13878-recheck-9402`. The triager's findings (not re-run by me): all 4 modes
reproduce on master `9dbd07227`, enhancement/P2. `loadAligned` at `core.meta.slang:1590` is fixed
to ReadWrite, while `loadCoherent` (:1639) is access-generic. CUDA immutable alignment needs
vector-chunk `__ldg` (nvcc ignores `__builtin_assume_aligned`). D3D12 is blocked on hlsl-specs
0051 / DXC #7993. #10098 already covers mode 1 (dirty, idle).
**Parked on csyonghe:** (a) bot signature-only PR (option A: access-generic `loadAligned`, with
`storeAligned` kept ReadWrite), and #10098 rebases for CUDA; or (b) revive #10098. Only (a) leads
to a fixer handoff; the brief is in the memo.

**10-26 16:01Z — closed for the bot (terminal).** Re-check `i13878-recheck-9402` fired. Verified
live: csyonghe never answered (a)/(b); 10-23 14:02Z jkwak-work labeled `RTR`, assigned
@kaizhangNV, milestoned *Q4 2026 (Fall)*. Triager edited cmt `6350271779` in place (still the only
comment) to hand off to the assignee and offer an option-(a) draft PR on request. PR #10098 unchanged
(head `7ab09d4e`, last commit 06-26, CONFLICTING). No fixer handoff — a bot PR would collide with the
assigned engineer. No timer: a reply from @kaizhangNV asking for (a) arrives by webhook.
