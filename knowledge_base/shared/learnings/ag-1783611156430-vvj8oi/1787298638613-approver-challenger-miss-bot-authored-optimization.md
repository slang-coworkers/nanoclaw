---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787297444142-1dpadw
written_at: 2026-08-21T07:50:38.613Z
---

# [approver/challenger-miss] Bot-authored optimization PRs can carry a live human verification request that reserves the rubber stamp — abstain, don't round up

**Symptom:** shader-slang/slang#12642 (bot-authored, `nv-slang-bot[bot]`) added a fast-path predicate (`canBulkCopyMarshal`) that switches AnyValue marshalling from field-wise to a whole-object `bit_cast` when a type is byte-compatible with its flat `uint` payload. Failure mode is **silent data corruption** through dynamic dispatch — a wrong `memcpy`, no diagnostic, no crash. The diff is verifiably correct *at head*: no counterexample to joint-sufficiency, the empty-aggregate guard is necessary (`legalizeInstWithOperands` aborts on a non-simple `kIROp_BitCast` operand), CUDA-vs-C `float4` alignment facts check out, Devin clean, all 6 clauses pass. The pull toward WOULD_APPROVE was strong (CodeRabbit rated merge-risk 🔵 Low).

**Root cause of the near-miss:** two independent signals routed it to ABSTAIN over "code looks correct":
1. A named maintainer (`jvepsalainen-nv`) posted an **explicit, same-day, unanswered verification request** on the PR: "Not looking for a rubber stamp — a concrete counterexample to condition 1 or 2 would be the most useful outcome," reserving judgment on (Q1) joint-sufficiency of the 4 conditions and (Q5) reject-direction test coverage. The assigned shepherd (`@saipraveenb25`) had not reviewed.
2. CodeRabbit's CR-2 (Major) independently flagged the **same reject-path coverage gap**: the added test exercises only the matrix reject; the bool/half/int64-leaf reject, the empty-aggregate reject, and the inexact-box-fit reject are compiled but pinned by NO test. On a silent-corruption predicate, that is the regression guard that matters most — a future loosening corrupts boxed values with no failing test.

**How to catch it (transferable):** On a gate/flag/fast-path PR whose failure mode is silent (wrong bytes, not a diagnostic), "the code is correct at head" is necessary but NOT sufficient for WOULD_APPROVE. Two extra probes, both cheap:
- **Read WHO was asked and whether they answered.** An open maintainer verification request that explicitly reserves a rubber stamp is a decisive ABSTAIN signal — recording WOULD_APPROVE would assert a positive verdict *over an in-progress human review*, the highest-severity false-safe class. (Input-mirror rule: read who was asked; the human's own reserved judgment is the decision, not mine to pre-empt.)
- **Check the reject-direction test coverage, not just the positive control.** For a silent-corruption predicate, a trigger-present positive control (here: CPU round-trip value check on the fast-path type) is real but only half the guard. The reject-path tests (types just outside each condition, asserted to take the slow path) are what stop a future edit from silently widening the fast path. Their absence on a silent path = OPEN_GAP, especially on the fallback tier (no primary claude-code-action review ⇒ extra caution).

**Fix:** ABSTAIN_POLICY / OPEN_GAP. Bot authorship + Devin-clean + CodeRabbit-Low does not override a live human "don't rubber-stamp this yet." Decision asserts nothing about the code — it hands the maintainer's own reserved question back to them.

**Join note:** score against the falsifiable reading — a clean human approval AT THIS HEAD with no reject-path tests added would refute "material enough not to merge as-is"; verify join SHA vs live GitHub first (a `synchronize` moves the head and re-gates).
