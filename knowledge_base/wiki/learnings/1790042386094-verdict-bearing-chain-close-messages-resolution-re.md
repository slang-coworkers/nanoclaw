---
title: "Verdict-bearing chain-close messages ([Resolution]/[Review Verdict]) trip the codex critique-gate — run OUTPUT_REVIEW first"
type: learning
topic: agent-ops
source: learnings/1790042386094-verdict-bearing-chain-close-messages-resolution-re.md
---

# Verdict-bearing chain-close messages ([Resolution]/[Review Verdict]) trip the codex critique-gate — run OUTPUT_REVIEW first

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790037347740-zq7g9p
written_at: 2026-09-22T01:59:46.094Z
---

# Verdict-bearing chain-close messages ([Resolution]/[Review Verdict]) trip the codex critique-gate — run OUTPUT_REVIEW first

With the critique-gate overlay active, emitting a `[Resolution]` (and likely any verdict-bearing close) fires a `[GATE AUDIT]` if codex-critique was not invoked first: "message contains \[Resolution\] but codex-critique (CRITIQUE OVERLAY GATE) was never invoked — gate skipped." The gate requires a recorded critique round with **every required stage count ≥ 1 AND OUTPUT_REVIEW verdict = approve**, re-checked at send time.

Key mechanics learned the hard way on shader-slang/slang#13206 review close:
- A **freeform** `mcp__codex__codex` call does NOT count. `track-critique.sh` only records a round when you pass the codex-critique skill's **verbatim `developer-instructions` block** (it checks the sentinel lines "You are an independent reviewer" and "Return ONLY the structured output below") and a `STAGE:` prompt. Use `sandbox: "danger-full-access"` (read-only is rejected by a PreToolUse hook inside Docker, per the skill — though one read-only call slipped through for me, don't rely on it).
- Round 2+ use `mcp__codex__codex-reply` on the saved threadId; those rounds are recorded too and their verdict counts.
- The critique is not a rubber stamp: on this run codex caught three real overstatements in my draft resolution — (1) claiming COMPARE_COMPUTE is the "positive signal" for a SPIR-V structural fix (it proves runtime behavior only; `-cpu` never executes the SPIR-V and a permissive Vulkan driver can run invalid composites — the `CHECK-NOT` span is the real structural guard); (2) asserting a force-pushed commit's delta was "confined to 2 files" when the old SHA was unreachable and I couldn't verify it; (3) "CI covers the delta" when the PR's CI checks were largely skipped. It took 4 rounds to reach approve. Budget for a few iterations before any verdict-bearing close.
- Bonus source fact (verified `slang-common.h:371`): in release builds `SLANG_ASSERT` degrades to `SLANG_ASSUME` (`[[assume]]`/`__builtin_assume`), an optimizer assumption where a false condition is **undefined behavior** — NOT a no-op. So `SLANG_ASSERT`-ing a shape that valid input can actually reach is worse than leaving it unhandled.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790042386094-verdict-bearing-chain-close-messages-resolution-re.md`_
