---
name: project_11545_bytebuffer_alignment_chunker_stack
description: "#11545 ByteAddressBuffer alignment-chunker series — [3/3] PR #11803 rebased onto [2/3] #11595 per jkwak; non-redundancy established; await jkwak review"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

shader-slang/slang **#11545** ByteAddressBuffer alignment/access series — the #11564 monolith split into a **stacked PR series** driven by slang-fixer. Canonical thread `gh-issue-shader-slang/slang-11545`.

- **Stack:** [2/3] = **PR #11595** (branch `fix/issue-11591`), [3/3] = **PR #11803** (slice-4, the widest-aligned-chunk optimization). [3/3] stacks on top of [2/3]. Related monolith issues #11564/#11596 (closes still on **operator hold**).
- **2026-07-16 07:11 — [3/3] non-redundancy established + rebased (fixer msgs 38904/38908/38910).** jkwak questioned whether [3/3] #11803 was redundant with [2/3] #11595. Fixer verified **at HEAD (not memory): NOT redundant.** [2/3] head has **0** chunker symbols — its not-wide-aligned path goes straight to `emitLegalSequenceLoad` (full per-component scalarize); [3/3] adds **12** chunker symbols inserting a widest-aligned-chunk middle before the scalar fall-through. Concrete delta: `LoadAligned<float4>(loc,8)` → four scalar `.Load<float>` on [2/3] alone vs two `.Load<float2>` with [3/3]. (= point 5 of the #11564 monolith.) Fixer replied w/ evidence + deferred scope to jkwak (issuecomment-4989078836).
- jkwak **accepted** the explanation, asked fixer to **rebase [3/3] onto [2/3]** for easier review. Done: slice-4 `8fa9726bb3`→`386c55056d` onto `fix/issue-11591`@`2f488df6d1` (now master-merged). Clean replay, no conflicts; content intact (12 chunker symbols, 2 doc blocks, 2 tests; 4-file diff +281/−10). `--force-with-lease`, PR head confirmed `386c55056d`, CI re-dispatched (run 29479076668, draft). Confirmed on-thread (issuecomment-4989173063).
- **Next:** jkwak reviews the cleaned-up single-commit diff. Webhook-driven, no action pending. Drafts-only + operator/maintainer-gated merge INTACT. Code push (rebase) not gated [[feedback_pushes_not_gated]].
- **Blocker:** none. #11564/#11596 closes on operator hold; disk healthy (44G/82%).

Note (07-16): fixer fat-fingered a stray a2a `noop` to slang-pr-approver (id 155/156); approver no-op'd + courtesy-noticed; fixer correctly sent nothing back (no echo). Non-event.
