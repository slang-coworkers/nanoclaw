---
name: project_12307_reflection_json_scope_representation
description: "#12307 JSON reflection scope repr — enh/P2; PR #12310 NON-DRAFT, HEAD=6be68909b1 (5th SHA: slangbot TOC regen atop @tangent-vector's own master-merge — provenance pinned, none fixer's); ✅maintainer APPROVED round-2 but now auto-DISMISSED by post-approve commits ⇒ REVIEW_REQUIRED at current head; behind_by:0; FIRST REAL CI BUILD running (run 31825230417, 9 jobs in_progress, no yield); RESUME = CI verdict + @tangent-vector re-approve → OPERATOR-gated merge"
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

## 2026-08-07 — chain advanced far past the state above

⚠️ Lines 9-18 are the 08-04 snapshot. **The full current record lives in the root-B copy at `/workspace/agent/memory/project_12307_reflection_json_scope_representation.md`** (~15KB) — this root-A file is what `reindex.sh` and the index shards read, so it must carry the load-bearing facts:

- **@tangent-vector reviewed → CHANGES_REQUESTED** (2 inline: [r3737843847](https://github.com/shader-slang/slang/pull/12310#discussion_r3737843847), [r3737850035](https://github.com/shader-slang/slang/pull/12310#discussion_r3737850035)) — both wanted an **assert**, not the defensive early-out.
- **Round 2 shipped `e2befa07ef`.** The disputed premise settled *against* the fixer's own earlier claim: a non-`Struct` scope layout is **UNREACHABLE** (`ScopeLayoutBuilder::endLayout` always yields a `StructTypeLayout`; `createConstantBufferTypeLayoutIfNeeded` wraps it with that same struct as element). A scope is exactly {`Struct`} or {`ConstantBuffer` wrapping it}. Asserts correct, not a crash. Net **−21 lines**: deleted the `"parameterBlock"` scope kind + nested-`"scope"` recursion; **zero `.expected` baselines changed** = reproducible proof they were dead.
- **HEAD is `79297fa854`** (master merge, `behind: 0`), *not* `e2befa07ef`. A resume pointer naming the code SHA points at a non-head.
- ⛔**CI HAS NEVER COMPILED THIS HEAD.** All 11 runs at `79297fa854`: zero non-skipped `build-*` jobs (`pull_request` skipped-as-draft; `workflow_dispatch` yielded — red = only `wait-for-human-priority` + `check-ci`; all 9 build + 20 test jobs skipped; `run_attempt: 1`). ⇒ **"CI green" is UNESTABLISHED, not pending.** The fixer's local debug suite (scope 8/8, `tests/reflection/` 52/52, 9 baselines 10/10, asserts live, none fired) is the **only** real signal and cannot cover macos/windows/aarch64/wasm/sanitizer.
- ⛔**`retry-yielded-bot-ci` is CONTENTION-gated, not a timer** — needs a rerun (`run_attempt` is the instrument, not a newer run id), and its first gate refuses while any `ci.yml` run is active. **A yielded run can expire un-rerun.** Never say yielded bot-CI "clears itself" — I relayed that false clause twice before the fixer corrected it. Only the **operator-gated ready-flip** fires a gate-bypassing `pull_request` run. This is line 18's lesson recurring: the ready-flip is a distinct human step, and it is also the *only* path to a genuine build.
- **RESUME:** maintainer re-reviews `79297fa854` (he resolves the 2 inline threads) → operator-gated ready-flip → merge. Max-2-round path CLOSED; CI-break triage on an owned PR is ownership maintenance, not a round.

Sibling spun out of the same review pass: [[project_12316_type_layout_policy_duplication_techdebt]] (AST↔IR type-layout policy duplication, bot-filed off the #12306 review, parked).

⚠️ Anything in this file predating 2026-08-03 should be re-verified against live GitHub before it is relayed publicly — see [[feedback_verify_approver_facts_before_routing_public]].
