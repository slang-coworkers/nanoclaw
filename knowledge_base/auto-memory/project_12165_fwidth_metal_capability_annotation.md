---
name: project_12165_fwidth_metal_capability_annotation
description: IN-FLIGHT
metadata: 
  node_type: memory
  type: project
  originSessionId: 6742f01a-01b6-4371-b3e9-a9afc2aabf9b
---

IN-FLIGHT shader-slang/slang#12165 — `fwidth(float2)` rejected in `fragment` stage for `metal` target with E36107 "unavailable features in entry point". Reporter hapcode, Slang 2026.13.1, M1 Pro.

**Triaged 07-21** (triager, reproduced @HEAD 6a244fee2, verdict posted [comment 5032598566](https://github.com/shader-slang/slang/issues/12165#issuecomment-5032598566), `reproduced`+Type=Bug labels, forwarded to slang-fixer):

**Root cause — stdlib capability-annotation error, NOT a real Metal gap.** Vector (`hlsl.meta.slang:11537`) and matrix (`:11559`) `fwidth` overloads omit the `metal` atom in `[require]`; scalar overload + all ddx/ddy overloads already carry it. Repro's `fwidth(float2)` hits vector overload → E36107. Proven: scalar `fwidth`+metal COMPILES, vector+metal FAILS, vector+hlsl/wgsl COMPILE (controls).

**Fix (fixer's task):** add `metal` to both require clauses + a `case metal:` to the vector body (body has no metal case and no default — require-only fix incomplete); matrix body needs no change (`default: MATRIX_MAP_UNARY`). Draft PR + regression test (emit-level MSL check). `fwidth_coarse`/`fine` deliberately excluded (no Metal coarse/fine control).

Classification: bug / medium / P2 / frontend+Metal-emit.

**Fix landed 07-21** (slang-fixer): draft PR **#12172** open, verified @HEAD 8cb0af1b65. 2 files +24/−2 — `hlsl.meta.slang` (vector+matrix `fwidth` gain `metal` in `[require]`, +`wgsl` on matrix, +`case metal:` in vector body) + new `tests/metal/fwidth.slang`. Approach A; coarse/fine untouched. Tests: baseline reproduces E36107 @:11537; post-fix vector+matrix emit MSL `fwidth(`, SPIR-V validates, hlsl/wgsl controls compile; `slang-test tests/metal/` 40/40 pass. Review: cross-backend-reviewer NO DEFECTS; codex PLAN/CODE/OUTPUT approved. Peer review dispatched to slang-reviewer by fixer. Labeled `pr: non-breaking`; initial `ci_failed` webhook = priority-yield cosmetic red (all builds skipped, no-op — matches bot-PR workflow_dispatch pattern).

Chain OPEN — awaiting slang-reviewer verdict + real CI. Drafts-only guardrail applies (held draft until maintainer flips).

**Reviewer running (07-21 10:56):** slang-reviewer running 3-reviewer pass (A correctness + C clarity in PATCH mode against fetched `refs/pull/12172/head` = 8cb0af1b65 matching HEAD; B Devin anonymous-scrape live URL). No `<github-post-authorized />` marker in my tasking → reviewer will NOT auto-post; delivers combined review via file + relays verdict to me on canonical thread (exactly what I want — issue surface is triager's, PR is held draft). ~20-30 min. Reviewer also flagged `gh` token invalid for pr-mode diff-fetch — but NOT escalated: triager successfully edited comment 5032598566 in place at 10:47 (confirmed write 9 min prior), and per [gh auth probes are misleading] + [reads-OK 401 flaps], reviewer routed around via git-through-proxy. Watch for a CONFIRMED push/write 401 before treating as outage.

**Interim finding (11:04):** Reviewer C (clarity) flagged **FG002** — real test-discrimination gap: `tests/metal/fwidth.slang` has two identical `fwidth(` checks that can BOTH be satisfied by the matrix call alone, so a vector-call regression (the exact bug fixed) wouldn't be caught. Likely fixer follow-up: make the vector-emit check independently distinguishable. Reviewer A (correctness) + B (Devin) STILL RUNNING — hold for consolidated verdict, relay all findings to fixer in ONE pass (no piecemeal action on one reviewer's partial).

**Routing note (07-21):** fixer's `send_message` to slang-reviewer failed on the marker-routing gate for a FRESH peer dispatch (no `in_reply_to`, no explicit `thread_id`) — NOT a missing edge (`ncl destinations list` confirms fixer↔reviewer bidirectional). Fix: fresh peer dispatch needs explicit `thread_id`. **Main dispatched slang-reviewer directly** for #12172 on canonical thread (COMMENT-state only, don't flip ready) — Main owns the reviewer-verdict RELAY hop now; fixer stood down (no re-dispatch → no double-review race). Fixer owns PR + real-CI webhook loop. Triager to post draft-PR pointer on issue (edit comment 5032598566) + hold [Triage Resolution] until review/CI clear. Also: my own earlier triager send failed because I used the `SendMessage` teammate tool instead of `mcp__nanoclaw__send_message`/`<message>` block — different tool, doesn't know nanoclaw destinations.
