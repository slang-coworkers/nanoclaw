---
name: project_12291_metal_uniform_array_of_resource_unbound_arg
description: "slang#12291 Metal codegen — uniform array-of-resource-struct emits unbound array<T device*,N> kernel arg (no [[buffer(N)]])"
metadata: 
  node_type: memory
  type: project
  originSessionId: cce1d27d-5a11-413b-afb7-914b30e74ab3
---

# shader-slang/slang#12291 — Metal: uniform array-of-resource emits unbound `array<T device*,N>` kernel arg

**Bug/P2, target-emit (Metal).** `uniform` fixed-size array of resource-containing structs
(`uniform MyTensor tensors[4]`, `MyTensor` holds `StructuredBuffer<float>`) mis-lowered on Metal:
per-element buffers hoisted into bare `array<T device*, N>` kernel arg with **NO `[[buffer(N)]]`
attribute**. Correct on VK (proper descriptor array + binding) and CUDA. GPU-free repro (emit-compare
MSL vs SPIR-V) at master `7c58a326b`.

**Root cause (triager source-verified @HEAD):** emit-level only. `emitFuncParamLayoutImpl`
(`source/slang/slang-emit-metal.cpp:166-170`) gates `[[buffer(N)]]` on param TYPE SHAPE; `IRArrayType`
wrapper matches no whitelisted resource type → attr dropped. Layout is fine (valid MetalBuffer offset).
**NOT** `slang-ir-explicit-global-context.cpp` (that was the reporter's wrong pointer). Broader than
reported: array-of-TEXTURES also drops `[[texture]]`; ANY resource kind; struct wrapper irrelevant
(bare `StructuredBuffer<float>[4]` repros).

**Fix:** Approach A (admit `IRArrayType` in emit guard) — **CONDITIONAL**: must verify on Metal
toolchain that `array<device T*,N> [[buffer(k)]]` is valid MSL (Metal has no native array-of-buffers
≤3.1); NOT checkable in Linux sandbox. Fallback B = arg-buffer routing
(`MetalParameterBlockElementTypeLoweringPolicy`/`wrapCBufferElementsForMetal`).

**State (2026-07-30):** triaged; verdict posted (issue cmt 5131662106). FIXER DISPATCHED,
**DRAFTS-ONLY** (Metal HW gate), branch `fix/issue-12291`. Canonical thread `gh-issue-shader-slang/slang-12291`.
- Triager auto-forwarded to fixer (its workflow) at the same time as my orchestrator dispatch → risked
  2 fixer sessions on `fix/issue-12291`. Ground-truth via `ncl sessions list`: only ONE fixer session
  minted = **sess-1785419373962-x86ttc** (mg `mg-a2a-1780672222602-epsn3s`), born from triager's handoff
  (carried the technical memo but NOT my guardrails).
- Fix: **pinned** my hard-constraints message to that incumbent session via
  `send_message(target_session_id="sess-1785419373962-x86ttc")` → landed seq 4 (guardrails: drafts-only,
  branch, regr test, post 5-bullet on issue, Approach A conditional→B fallback→STOP+report). Told fixer
  THIS session is sole owner; stand down any duplicate. No 2nd session appeared.
- LESSON: triager's fix-workflow auto-forwards to fixer on its own — my "don't route" reply can lose the
  race. When both dispatch, verify fixer session count and PIN to the incumbent rather than assume my
  edge won. (Also: pinned sends on a thread with >1 unresponded inbound REQUIRE explicit in_reply_to.)

**DECISION FORK resolved (2026-07-30 ~14:13):** Fixer verified diagnosis @HEAD, hit constraint-#5 tree
(A-buffer unverifiable on Linux [`metallib`→E00100, no Metal toolchain]; B larger than draft warrants),
STOPPED + reported. Surfaced key nuance: **Approach A cleanly fixes texture/sampler-array sub-cases
(Linux-emit-verifiable, independently broken) — only the BUFFER sub-case (the actual reported symptom)
is where A pins invalid MSL** (`array<device T*,N> [[buffer(k)]]` — 3 sources agree not a valid direct
kernel arg ≤Metal 3.1; only arg-buffer/ParameterBlock supported).
MY CALL = **Option 1 refined** (sent id 31): ship DRAFT = Approach A for texture/sampler ONLY +
GPU-free `-target metal` filecheck (`[[texture]]`/`[[sampler]]`) + **`-target metallib` test for
tex/sampler** (let macOS CI arbitrate the tex/sampler validity we're unsure about; expect PASS). NO
metallib test for buffer (deferred contract). **Buffer sub-case DEFERRED** to maintainer design decision
(B arg-buffer routing vs diagnostic-D interim vs park) — surfaced on issue so maintainer = next inbound.
Still DRAFTS-ONLY; branch `fix/issue-12291`; report_pr_created on open; 5-bullet on #12291.

**MAINTAINER TOOK IT (2026-07-30 ~14:22, cmt 5132728631):** jkwak-work assigned #12291 to **jhelferty-nv**,
explicitly citing relation to **#10842** (Metal arrays-of-resources umbrella jhelferty-nv owns) — i.e. the
maintainer answered the deferred buffer-case design decision by routing to #10842's owner. This is the
handoff we teed up.
**MY CALL (sent id 35, superseding "open the draft"):** fixer HOLD — do NOT open PR. Instead: (1) let build
finish, confirm repro flips (tex/sampler now get `[[texture]]`/`[[sampler]]`); (2) push branch `fix/issue-12291`
BRANCH-ONLY (no PR, no report_pr_created) to preserve tested work; (3) post ONE deferential handoff/offer
comment on #12291 — ack jhelferty-nv/#10842, FYI tex/sampler partial fix available on branch if useful,
defer buffer sub-case (B arg-buffer routing / diagnostic) to their design call. Don't compete w/ assignee.
Then **chain HOLDS awaiting jhelferty-nv**. If jhelferty or a human later asks for the partial as a PR →
ping me, I authorize opening draft then.

**RACE + RESOLUTION (2026-07-30 ~15:22):** My HOLD ("don't open PR") landed AFTER fixer had already
executed the earlier valid "proceed/open draft" auth → **DRAFT PR #12294 was already OPEN** (draft,
`pr: non-breaking`, report_pr_created done, CI dispatched, branch pushed cb9976f, repro-flip VERIFIED:
`texs[4] [[texture(0)]]`/`samps[4] [[sampler(0)]]`/`Handle[4] [[texture(4)]]`, buffer stays unbound,
tests/metal 199/199). A public 5-bullet already posted on #12291 linking #12294 (token 403s on
issue-comment EDIT — can only ADD, not revise). Clean timing race, NOT a breach — fixer held before any
irreversible step. **MY CALL = Option A** (sent id 39): convert #12294 into a held DRAFT OFFER IN PLACE,
do NOT close (close is the MORE disruptive move — pings assignee + orphans the existing comment; and a
draft is inherently non-competing). Directed: edit PR body → offer framing + `Related to #12291/#10842`
(NO Closes/Fixes — partial fix must not auto-close); ADD one brief deferential issue comment acking
jkwak-work's assignment to jhelferty-nv + offering #12294; stays draft; HOLD. LESSON: a draft PR is a
non-competing artifact — closing to satisfy a hold literally is often noisier/less-reversible than
re-framing it as an offer; prefer in-place re-frame.

**TERMINAL HOLD (2026-07-30 ~15:25):** Option A executed & confirmed. PR **#12294** = held DRAFT OFFER
(body reframed in place, leads "Held as a DRAFT OFFER — @jhelferty-nv owns direction under #10842;
adopt/take-pieces/close at your discretion"; tex/sampler-only scope; buffer deferred to Approach B;
`Related to #12291/#10842`, ZERO Closes/Fixes verified; stays draft; report_pr_created in place). Offer
comment posted on #12291 = **issuecomment-5132814989** (acks jhelferty-nv ownership + jkwak-work; offers
#12294 to adopt/close; buffer=their Approach-B call). No ready/merge/close/self-adopt.
**CHAIN HOLDS awaiting jhelferty-nv.** RESUME triggers: maintainer reply (adopt / wants-changes / asks-to-
close) → comes to me on thread gh-issue-shader-slang/slang-12291, I re-dispatch fixer; fixer will NOT act
unilaterally. Also re-opens on any substantive human comment per standing rule.

**Relations:** plain-array (non-bindless) subset of [[project_slangpy_1079_array_of_tensors_metal_d3d12]]
Defect 1 (Metal path). Distinct from [[project_10842_metal_descriptorhandle_runtime]] (bindless
DescHandle — emit done, gap in slang-rhi). #7606 (closed) = same shape, old Metal crash, historical only.
