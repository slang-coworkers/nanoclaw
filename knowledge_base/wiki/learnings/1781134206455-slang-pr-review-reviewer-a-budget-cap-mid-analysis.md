---
title: "slang-pr-review: Reviewer A budget-cap mid-analysis hypotheses are NOT findings — re-run + independently verify"
type: learning
topic: review-process
source: learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md
---

# slang-pr-review: Reviewer A budget-cap mid-analysis hypotheses are NOT findings — re-run + independently verify

When Reviewer A (slang-pr-review-runner) terminates with `error_max_budget_usd` (check the final `"subtype"` in the stream/log; cost can overrun the `--max-budget-usd` cap because parallel subagent costs tally after they finish), it dies BEFORE writing `final-review.md` — leaving only mid-analysis reasoning in `stream.jsonl`. That partial reasoning often contains an **unconcluded hypothesis the orchestrator was still developing**, which is frequently a FALSE POSITIVE it would have disproved in its own editorial filter had it finished.

**What to do:** re-run A at a higher cap (e.g. `--max-budget-usd 50`) to get a proper consolidated verdict, AND independently verify any high-stakes correctness hypothesis against the actual source — do not propagate A's mid-analysis guess into the verdict as a finding.

**Concrete instance (PR #11544, mesh-shader HLSL output qualifiers).** A's budget-cut hypothesis: neutralizing `out`→`IRBorrowInParamType<MeshOutputType>` would drop `IRMeshOutputDecoration` (if added via `legalizeMeshOutputTypes`' `traverseUsers<IRParam>`, which can't cast the `IRBorrowInParamType` wrapper) → missing `out vertices`. **REFUTED** two independent ways: (1) A's own re-run editorial filter disproved it against existing master tests on the byte-identical generic/BorrowIn IR form (`tests/pipeline/rasterization/mesh/hello.slang` SPIRV `OpExecutionMode OutputVertices` passes; `tests/metal/simple-mesh.slang` Metal legalization passes); (2) reviewer-side check with a freshly-built `slangc`.

**Domain fact worth keeping:** `IRMeshOutputDecoration` (Vertices/Indices/Primitives) is attached to the mesh-output param **at lowering time** (`addVarDecorations`, slang-lower-to-ir.cpp, present in `slangc -dump-ir-before specializeModule`), **independent of the param-passing-mode wrapper** (`IROutParamType` vs `IRBorrowInParamType`). So converging the `out` spelling onto `borrow in` does NOT lose the qualifier. To settle any "is this decoration actually attached?" question empirically, dump IR before the first pass + diff emitted HLSL from a built compiler — beats static reads of the wrapper/getter chain (which mislead: `IRBorrowInParamType : IRPtrTypeBase`, not `IROutParamTypeBase`).

**Also:** Devin (Reviewer B) on a DRAFT PR almost always returns inconclusive (page "Generating...", commit-status "unknown", "AI Analysis" = PR description echoed back); 0 bugs/0 flags there is NOT an all-clear — don't weight it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1781134206455-slang-pr-review-reviewer-a-budget-cap-mid-analysis.md`_
