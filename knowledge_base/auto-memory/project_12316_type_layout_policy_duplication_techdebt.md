---
name: project-12316-type-layout-policy-duplication-techdebt
description: "slang#12316 tech-debt tracking — AST/IR type-layout policy duplication; TRIAGED 08-03 w/ 3 options; 08-07 maintainer asks for a scheduling decision"
metadata:
  node_type: memory
  type: project
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# slang#12316 — type-layout policy duplication (tech-debt tracking)

⚠️ **This leaf was overwritten 2026-08-07 by me** with a thinner "just routed, expect PARK" framing, on the false belief the issue was new. A `slang-parked-index.md` row dated 08-05 proves the leaf predated that write, so **any richer 08-03 content is lost** — the authoritative record is the GitHub triage comment, linked below. Do not treat this file's history as complete.

Bot-filed (`nv-slang-bot[bot]`) **tracking issue**, opened **2026-08-01T22:18Z**, from the review of **#12306** (`IRTypeAlignmentAttr`).

**The debt:** target-specific layout policy (std140/std430/scalar/C/CUDA alignment/stride/offset) is codified in **two independent paths** kept consistent by hand, no shared source of truth:
1. AST `TypeLayout` — `source/slang/slang-type-layout.cpp`, reflected via `slang-reflection-api.cpp`.
2. IR "natural" layout — `getSizeAndAlignment(...)` in `source/slang/slang-ir-layout.cpp`, on-demand, cached on `IRSizeAndAlignmentDecoration`. Justified: `.Load<T>()` on `RWByteAddressBuffer` — concrete `T` unknown where AST layout runs.

## State — TRIAGED 2026-08-03, verified at master `53b76e6d3`

Triager confirmed the duplication by source read; the two hierarchies share **no** policy code (neither file includes the other's header). Concrete overlaps: D3D 16-byte CB straddling (`slang-type-layout.cpp:587-595` vs `slang-ir-layout.cpp:769-776`) · std140 composite alignment (`:518-524` vs `:843-848`) · vec3 special-casing. SPIR-V `Offset`/`MatrixStride`/`ArrayStride` read the **IR** path (`slang-emit-spirv.cpp:7014`, `:7036-7043`, `:2007`) — not reflection. Classified enhancement/tech-debt · low · **P3** · Issue Type `Refactoring`. Not a dup (#3210 closed, narrower).

**Three options, cheapest-first (from triage):** (1) document the split — cross-reference comments, no risk; (2) detect drift rather than remove it — differential test/assert on the uniform-bytes unit, needs an agreed legitimate-divergence set (matrix modes, struct tail padding which the IR path intentionally omits per `slang-ir-layout.cpp:40-44`, resource kinds); (3) shared policy layer — high risk, **value capped** because the hierarchies are not 1:1 (9 families/28+ rule structs front-end, carrying register/descriptor/existential/matrix concerns, vs 7 bytes-only IR rules), so only the uniform subset is common.

Out of scope by author + triager agreement: converting on-demand IR sites to consume AST layout.

## 2026-08-07 — maintainer input (RESUME point)

`@tangent-vector` (MEMBER): *"needs a decision about when we will schedule it, or how long it can remain on the backlog before we revisit… not an urgent issue and thus difficult to justify over other work."*

Asking for a **scheduling decision**, which is maintainer-owned — not something a coworker decides. Routed to `slang-triager` (closest-to-the-state: it holds the option analysis) on `gh-issue-shader-slang/slang-12316` to reply publicly with a recommendation grounded in its own three options. Substance of the recommendation: option 1 is cheap enough to need no scheduling slot at all; option 2 is the thing to actually schedule, and its natural trigger is **event-based not date-based** (a filed layout-drift bug, or the next change to either rules hierarchy) — which answers "how long on the backlog" better than a date for a static debt that is harmless until touched.

**Recommendation POSTED 2026-08-07T19:19Z** by the triager — [issuecomment-5221126781](https://github.com/shader-slang/slang/issues/12316#issuecomment-5221126781) (5148 chars; verified live: carries the policy-edit trigger, the option-1 split, #12384, and corrected `:586` citations).

Two checks it ran that changed the published text, both re-verified by me:
- **Trigger wording.** `slang-type-layout.cpp` was modified after triage (`5b3f7a243`) — but that commit is `+0/-1`, sole change `-#include <assert.h>` (#12332). A file-touch trigger had therefore *already fired on a no-op*; published as **"next policy edit"** instead. Same deletion drifted published line citations by −1 (`:587-595`→`:586-594`); original verdict left unre-stamped since it pins `53b76e6d3`. ⇒ [[feedback_a_file_touch_trigger_fires_on_noise]]
- **#12384 is NOT trigger (2) firing.** Title reads like layout drift; it is reflection-vs-downstream-C++-ABI (nvcc gives empty structs ≥1 byte; reflection skips zero-size fields at `slang-type-layout.cpp:336-340`). **Both Slang paths compute 0** — they agree. ⇒ [[feedback_a_candidate_trigger_instance_needs_the_test_not_the_title]]

**Attribution (settled 08-07 after both sides audited it):** the two *ideas* — event-based-not-date-based, and don't-let-option-1-compete-for-a-slot — were mine; neither was in the 08-03 triage, which said only "maintainer's call". The *scoping* that made them usable was the triager's: policy-edit-not-file-touch, and the #12384 discrimination. Both halves real; recording it as purely either side's is the error in one direction or the other. **No infra attribution reached GitHub** — triager measured cmt 5221126781: `parent`/`orchestrator`/`as suggested`/`per your`/`your two` = 0 each, nonzero control `trigger`=1.

⚠️ **Two facts in MY correction message were wrong; the triager caught both:**
- **"already fired the day after your triage" was fabricated.** Single timestamp `%at==%ct==1785786138` ⇒ commit `19:42:18Z` vs verdict `12:46:20Z` = **+6.93 h, SAME UTC day**. I had both timestamps and never subtracted; `git show`'s `-07:00` display became "next day" in my prose. The error ran *toward my own thesis* (and the true figure is stronger). ⇒ [[feedback_a_date_delta_i_never_computed_drifted_toward_my_own_thesis]]
- **My `:336-340` cite and its `:574` are BOTH correct** — different `AddStructField` overrides. Verified at `7dc8091a6`: `:336`=`DefaultLayoutRulesImpl` (holds the `// Skip zero-size fields` guard; CUDA rules at `:755`/`:905` override nothing so they resolve here), `:574`=`HLSLConstantBufferLayoutRulesImpl` (right for the D3D straddling claim). ⇒ [[feedback_two_overrides_of_one_method_answer_different_questions]]

**RESUME:** `@tangent-vector` picks an option / accepts the revisit trigger → then triager releases `slang-fixer` for a draft doc-comment-only PR (option 1). If he schedules option 2, the legitimate-divergence set (matrix modes · struct tail padding, intentionally omitted per `slang-ir-layout.cpp:40-44` · resource kinds) needs agreeing first. Triager state in its own `triage-12316.md` (its filesystem, not mine).

Related: #12306 origin · [[project_12307_reflection_json_scope_representation]] (sibling from same review pass) · [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]] (the stale-webhook error that produced the overwrite above).
