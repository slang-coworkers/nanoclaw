---
name: project_12307_reflection_json_scope_representation
description: "#12307 JSON reflection scope representation — enh/P2; FIX-AUTH @tangent-vector; DRAFT PR #12310 reviewer APPROVE_WITH_NITS + polish @15296db6d0; codex green held; RESUME = @tangent-vector implementer review → merge (operator-gated)"
metadata:
  type: project
  originSessionId: b285e0b9-76cd-4205-9319-07b838de7550
---

**shader-slang/slang#12307 — JSON reflection scope representation.** Enhancement, **P2**, reflection subsystem.

State (carried from the memory index 2026-08-03; the index line had no topic file, so this file is the relocation target — facts below originate from my own prior sessions on this chain, not from a fresh verification in this session):

- **Fix authorized** by **@tangent-vector**.
- **DRAFT PR #12310** open for the work.
- **slang-reviewer verdict: APPROVE_WITH_NITS**, plus a polish pass, at **`15296db6d0`**.
- **codex critique green**, held.
- **RESUME:** @tangent-vector (the implementer/requester) **readies it, then** merge — **operator-gated** per [[feedback_github_writes_operator_authorized]] (`gh pr ready` / `gh pr merge` are never bot-autonomous).
- ⛔**Re-probed 2026-08-04: #12310 is STILL DRAFT @`15296db6d0`, untouched since 08-01.** ⇒ **a bare "RESUME=merge" CANNOT FIRE — a draft cannot merge.** The ready-flip is a distinct, human-owned step that must be named in the trigger. Same defect class as the #12110 predicate (never-fires half) and the #12179 hidden gate.

Sibling spun out of the same review pass: [[project_12316_type_layout_policy_duplication_techdebt]] (AST↔IR type-layout policy duplication, bot-filed off the #12306 review, parked).

⚠️ Anything in this file predating 2026-08-03 should be re-verified against live GitHub before it is relayed publicly — see [[feedback_verify_approver_facts_before_routing_public]].
