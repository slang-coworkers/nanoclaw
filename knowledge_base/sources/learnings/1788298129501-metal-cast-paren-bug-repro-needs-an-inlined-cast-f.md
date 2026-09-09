---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787659712639-gn6qaq
written_at: 2026-09-01T21:28:49.501Z
---

# Metal cast-paren bug: repro needs an INLINED cast; + Falcor-Perf/priority-yield CI is infra not code

From fixing shader-slang/slang#12732 (Metal C-style casts dropped precedence parens before `->`; PR #12741 merged). Complements the existing "Metal emitter C-style-cast cases drop precedence parens" learning with three things that cost time:

1. **The paren bug only manifests when the cast is INLINED as the base of `->`.** A named local hides it: `Data* p = bit_cast<Data*>(q); ... p->value` emits `Data* _S = (Data*)(...); _S->value` — the cast is hoisted to a temp, so there's no cast-as-member-base and no repro. My first test (named local + intervening `outputBuffer[i]=...` stores) did NOT reproduce. Fix: use a **single-use inlined** expression `outputBuffer[3] = bit_cast<Data*>(q)->value;` so the emitter folds the cast in place. General rule for emit-precedence tests: the sub-expression must be single-use so it inlines into the parent operator; intervening side-effecting statements force materialization to a temp.

2. **`maybeEmitParens` (slang-emit-c-like.cpp) is NOT strict-precedence-only.** Besides `prec <= outerPrec`, it force-adds parens when either side is bitwise/logical/relational/equality (`isBitLogicalOrRelationalOrEquality`) to suppress downstream-compiler warnings. Don't write PR/comment claims like "parens added only when precedence strictly requires" — a reviewer (codex) will (correctly) flag it. Say it "follows the emitter's precedence policy."

3. **FileCheck discriminators for paren bugs must assert the CLOSING boundary, not just the opening.** `((Data` alone can pass even if the close paren is misplaced. Use `= ((Data{{.*}} device*)({{.*}}))->value` — the literal `))->value` pins the outer-wrap close directly before the member access. Verify the pattern MATCHES the fixed emit AND REJECTS the buggy emit against real `slangc -target metal` output (both binaries) before trusting it.

4. **CI: `wait-for-human-priority` + `check-ci` + a downstream job failing on "Artifact not found for name: slang-tests-...-release" = priority-yield/infra, NOT a code failure.** On bot PRs the build yields to human-priority CI; downstream test jobs then fail because the build artifact was never produced. `retry-yielded-bot-ci` auto-reruns it (aging force-runs ≤~8h). Do nothing — no `gh run rerun`, no fix. Also: a **Metal-emitter-only** diff can never break `test-falcor / Test (Falcor Perf)` — Falcor is D3D12/Vulkan and never compiles for Metal, so a Falcor failure on a Metal-only change is definitionally not caused by it (causality check before touching anything).

5. **Reviewer-tension judgment call:** codex CODE_REVIEW wanted the per-case "consistency" comments REMOVED (paraphrase of the adjacent `maybeEmitParens` call); the clarity reviewer's nit wanted a one-line rationale ADDED on the sibling cases. Resolve by making it a pure **cross-reference** ("Precedence-wrapped like the kIROp_BitCast case below (#12732)") that points to where the shared rationale lives — that adds navigational value without restating the mechanism, satisfying both. A bare issue-reference `(#12732)` is explicitly endorsed by the repo comment discipline.
