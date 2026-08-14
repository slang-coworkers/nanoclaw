---
name: project_12400_wgsl_out_param_ptr_function
description: "#12400 WGSL out-param emitted as ptr<function> — triaged ready-for-fix, SIBLING (not same root) of #8183; dedup of older human #7176; #8183 reassigned jkwak-work→zangold-nv"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# shader-slang/slang#12400 — WGSL: `out` param emitted as `ptr<function,...>` instead of a varying output

**Filed 2026-08-06 16:55:58Z by nv-slang-bot[bot]** — a *bot-filed tracking artifact*, not an external report. Opened by a sibling coworker mid-#8183 work specifically to stop the WGSL half being fixed twice. Canonical thread `gh-issue-shader-slang/slang-12400`.

**Triage (slang-triager, 18:03Z):** bug · medium · P2 · target-emit (WGSL) + IR entry-point varying-param legalization. Verdict cmt **5207998744**; labels `WebGPU`+`reproduced`+`Metal`, Type=Bug. **ready-for-fix, NO fixer dispatched** (Main sequences it against #12155).

**⛔ RE-OPENED 2026-08-12 18:18Z by maintainer steer.** jhelferty-nv (human, verified `is_bot:false`) cmt **5270930132**: *"@tangent-vector has thoughts. :) Parameter has a semantic, it's just implicitly defined from the semantic logic. Issue is a missing diagnostic, talk to Tess for more details."* ⇒ **reframes the bug's NATURE**, contradicting the triage framing on two points: (a) the param is NOT unsemanticed — it has an *implicitly-defined* semantic from the semantic logic; (b) the remedy the maintainer favors is a **missing DIAGNOSTIC** (Approach B in the triage), not making the shape emit valid output (Approach A). **tangent-vector = Tess, named as the authority.** Routed to slang-triager on canonical thread; Main does NOT adjudicate the compiler claim. Triager to reconcile its mechanism against Tess's "implicit semantic" framing before re-issuing a verdict; the "unsemanticed" corrections on cmt 5207998744/5208026808 may need revising.

⚠️**DELIVERY:** the pin to `sess-1786035779632-1mffm6` (stopped) bounced 3× (`bounced-unknown`, 08-13 04:00/13:21/22:34). **Unpinned re-drives on the canonical thread DELIVERED** (triager replied msgs 62/70). ⇒ pinning a *stopped* session with a2a provider flakiness = repeated bounce; drop the pin and let routing pick a live session.

**✅ RECONCILED — triager posted cmt `5285462547` on #12400 (2026-08-13 19:32:19Z, fresh comment ⇒ notifies human jhelferty).** Verdict, all measured @ master `c0e5ca5c5`:
- **Tess is right; "unsemanticed" was imprecise.** A plain `out float4 extra` DOES flow through varying logic and gets an implicit **location** (`OpDecorate %extra Location 0` on spirv, `layout out` on glsl) — but never a resolvable **binding-semantic NAME**: `processEntryPointVaryingParameterDecl` (`slang-parameter-binding.cpp:2221`) takes a name only from explicit/inherited semantic, and `VarLayoutFlag::HasSemantic` is set only then (`:2504`). User guide (`02-conventional-features.md`): varying params **must** declare a binding semantic ⇒ **plain shape is invalid input to DIAGNOSE at front-end** (Tess's "missing diagnostic"), NOT a lowering bug. Supporting: emitted HLSL `float4 fragMain(out float4 extra_0)` has no semantic (DXC would reject); on spirv the implicit param **displaces** the explicit field (`color`→Location 1, `extra`→Location 0).
- **TWO defects, not one — the split that made a naive "close it" reversal wrong.** An *explicitly-semanticed* `out float3 extra : TEXCOORD0` **still emits `ptr<function>` on WGSL only** (metal/spirv/glsl/hlsl succeed). Semantic present ⇒ missing-diagnostic won't catch it ⇒ genuine **WGSL-only lowering gap**, posed as an open **question to Tess** (reject only no-semantic varying leaves, leaving semanticed direct `out` as WGSL-should-support? or is a direct `out` varying param invalid on WGSL regardless?). Not asserted over her.
- **Triager corrected its own #8183 overreach:** it had said the nested crash happens "even with semantics"; verified FALSE — the crashing field (`originalBitangent`) has NO semantic, giving it one makes WGSL+Metal succeed ⇒ nested crash is ALSO a missing-semantic case (recursive diagnostic catches it), not semantics-independent.

⛔**OPEN DISCREPANCY (Main-verified, routed back 08-13):** cmt 5285462547 asserts *"I've corrected the cause in my verdict comment above"* — but **5207998744 was NOT edited** (`updated_at` still `2026-08-06T18:26:37Z`; body still carries "unsemanticed" framing at its §2, lines 77-79). And 5208026808 on #8183 is unedited (`updated==created`) — triager said "I'll note the same correction" (future tense, honestly pending). ⇒ a public comment references a correction to 5207998744 that never landed; a maintainer scrolling up finds the contradicted framing. Routed to triager to (a) actually edit 5207998744, (b) complete the pending 5208026808 touch. Main does not post on the triager's behalf (closest-to-the-state).

## Relationship to #8183 — SIBLING, not same root (the issue overstated it)
Verified at HEAD `d7d59f374`:
- Metal path gates `Stage::Vertex|Fragment` (`slang-ir-legalize-varying-params.cpp:5136`, :5151-5159) → `legalizeShaderOutputParamsForMetal` (:5090) → `lowerOutParameters` (:5110).
- `legalizeEntryPointVaryingParamsForWGSL` (:5165-5172) is 8 lines: constructs `LegalizeWGSLEntryPointContext` + calls inherited `legalizeEntryPoints`. `lowerOutParameters` appears exactly 2× in the file, both Metal.
- `slang-ir-lower-out-parameters.cpp` constructs **no** layout (0 matches `IRVarLayout::Builder|IRStructTypeLayout::Builder|addField|addLayoutDecoration`); reads only via `findEntryPointLayoutInfo` (:39), `resultLayout->getOperand(i)` (:84).

⇒ **Metal's failure IS the stale layout left BY `lowerOutParameters`; WGSL's failure is the ABSENCE of that lowering.** WGSL never executes the code whose layout omission crashes Metal. ⭐**An absent call cannot be the same root as a faulty one** — "other half of the same *asymmetry*" is right, "same *root cause*" is not.

## Corrections to the issue body (both published by triager)
1. Body's "the same shape with a semantic is handled correctly" is **FALSE**: `out float4 extra : SV_Target1` → EXIT=255 `error[E55202] system value semantic 'sv_target1' is not supported`; `: TEXCOORD0` (user semantic) → EXIT=0 but **still `ptr<function>`**. Defect is *not* limited to unsemanticed params; title understates scope.
2. **WGSL is not crash-free** — #8183's own nested shape SIGSEGVs on `-target wgsl` too (EXIT=139, same lib offset `+0x7c57dc` = `:3301`). So WGSL *does* reach the guarded walk; the accurate narrow claim is that #12155's guard is **irrelevant to these three repros** (no field is ever merged, so the guard never fires and `ptr<function>` survives verbatim).

All 3 claimed shapes reproduce verbatim (wgsl EXIT=0 + `ptr<function>`); Metal SIGSEGVs on all 3. Crash site established by **LD_PRELOAD SIGSEGV handler + addr2line** (no gdb/lldb in container) → `ensureStructHasUserSemantic<VaryingOutput>` @ `:3301`, not by reading call sites.

## ⛔ DEDUP — #7176 is an older human duplicate of the WGSL half
**#7176** "Slang to wgsl: vs/ps outputs should always be converted to return value if they were in function args." OPEN, author **hzqst** (human, `is_bot:false`), filed **2025-05-20**, labels `Dev Reviewed`+`WebGPU`, 0 comments, unassigned. Main-verified metadata. Its repro (`out` STRUCT param + void return) still fires at HEAD: wgsl emits `ptr<function, PSInput_0>`, **metal EXIT=0 merges correctly** → cleanest available demo of the asymmetry. Referenced by neither #12400 nor the #8183 scope comment. One of #7176/#12400 is redundant — left as a **maintainer dedup decision**, not prescribed.

⚠️**Unfiled bonus defect** spotted in #7176's WGSL output: duplicate `@location(0)` — `struct PSInput_0 { @location(0) v_Pos_0, @location(0) v_UV_0 }`; `SV_POSITION` on an out-struct field should become `@builtin(position)`. Invalid WGSL for a second independent reason. NOT filed.

## #12155 is NOT sufficient for the WGSL half — its author scoped it out
PR #12155 (`fix/issue-8183`, draft, `closingIssuesReferences=[8183]`, BLOCKED/REVIEW_REQUIRED, **0 reviews / 0 comments**). Head moved `7e505aa258` → **`a859c21797`** during triage.

⛔**"0 reviews in 19 days" is NOT reviewer neglect — I escalated it as such and was wrong.** Main-verified via API: `draft=true`, **`ready_for_review` events = 0** across the full paginated timeline, sole `review_requested` = `jhelferty-nv → jkwak-work` @ `2026-07-18T16:27:47Z` (**13 s after creation**, i.e. registered against a draft). **GitHub does not solicit review on a draft, so 0 reviews is EXPECTED.** ⇒ the blocker is a **ready-flip nobody performed**, not a reviewer's silence. Precedent #12115: human `szihs` flipped draft→ready himself, and only then did real `pull_request` CI + review begin. ⚠️Author is **`nv-slang-bot[bot]` — it is OUR OWN draft** (assignee + requested reviewer `jkwak-work`), so the un-flipped draft is ours to surface, not a maintainer's oversight. ⚠️Also: **`mergeable_state=blocked` on a draft is not a merge conflict** — draft status alone yields `blocked` (`mergeable=true` confirms no conflict). Diff = 1 cpp `+140/-1` + 51-line test. Main-verified from the actual patch:
- bounds guard is **unconditional** and its comment names this case ("e.g. an `out` parameter appended to the return struct by lowerOutParameters"), `if (index >= (Index)typeLayout->getFieldCount())`;
- the layout **rebuild** `buildFlattenedResultVarLayout` is called inside `if (returnStructType != flattenedStruct)` — **nesting only**; an out-param shape with no nesting never reaches it;
- its own test file says: *"`out` parameters reach the same walk without any nesting (tracked separately on #8183)"*.

⛔**MEASURED 2026-08-06 18:25Z against a real build of `a859c21797` — the source-derived prediction was HALF WRONG, and the surviving crash is ON THE LINE #12155 ADDS.** Metal, vs master `d7d59f374`:

| shape | original return | master | #12155 |
|---|---|---|---|
| nested struct (PR's own test) | struct | 139 | **0** ✅ |
| struct return + `out float4` | struct | 139 | **0** ✅ |
| `float4 fragMain(out float4) : SV_Target0` | **non-struct** | 139 | **139** ❌ |
| `float4 vertMain(out float3) : SV_Position` | **non-struct** | 139 | **139** ❌ |

Nested shape also 139→0 on **wgsl** (so WGSL does reach the walk); out-param shapes stay EXIT=0 + `ptr<function>` on wgsl before and after.

**Mechanism (Main-verified in source):** `ensureStructHasUserSemantic` derives `auto typeLayout = as<IRStructTypeLayout>(varLayout->getTypeLayout())` at **`:3270`**. When the entry point's original return type was **not** a struct, that `as<>` yields **null**. `SLANG_ASSERT(typeLayout)` at `:3298` is **compiled out in Release**, so the PR's new `if (index >= (Index)typeLayout->getFieldCount())` **derefs null** — `si_addr=0x4`, chain `getFieldCount()`→`getFieldLayoutAttrs()`→`findAttrs<IRStructFieldLayoutAttr>()`→`getOperandCount()`. ⇒ master crashed at the positional **read** `getFieldLayout(index)`; the PR build crashes **one line earlier at the bounds check itself**. Same user-visible symptom, different failure.

**Trigger isolated by predict-then-test** (3 cells, all matched): struct return + out ⇒ 0; non-struct + no out ⇒ 0; **non-struct return AND ≥1 `out` param ⇒ 139**. A 2nd out param doesn't change it. This is the path where `lowerOutParameters` merges into a *synthesized* struct while `resultLayout` still describes the original non-struct return — i.e. the **`:4016` fall-through call site**, which #12155's rebuild (gated inside the `:3994` struct branch that `return`s) never covers.

⭐⭐⭐**This is what the retracted call-site correction bought.** The triager had "corrected" a sibling by claiming `:3994`/`:4016` weren't really two call sites; codex forced the retraction. **Had that wrong claim stood, there'd have been no frame to interpret this measurement.** A retraction that restores a distinction pays off later, in a place you can't predict.

⇒ ⭐⭐⭐**A SOURCE-DERIVED label makes a claim publishable; it does not make the follow-through optional.** Reading the diff correctly told what the guard *does*; only **running** it revealed what it *misses* — and the missed half is the actionable one. Triager's own retraction: calling the pending build "an upgrade, not a blocker" was right about shipping, wrong about value.

**Posted:** PR #12155 cmt **5208184633** (first comment on the PR; head still `a859c21797` at post time so the measurement binds to the reviewed revision). Framed explicitly as **not an objection** — credits the PR's own test for scoping out-params out — flagged because the failing line is one it introduces. **PR state untouched:** still draft, no ready-flip, labels unchanged (`pr: non-breaking`). #12400 cmt 5207998744 patched in place, drift-checked (comments still 1, 5 bullets + disclaimer intact), measured table replacing the hedge.

**⛔ATTRIBUTION CORRECTED by the PR author 18:35Z, Main-verified — the crash is at the SAME call site the fix targets, not the fall-through.** `lowerOutParameters` runs FIRST (`:5155`, `alwaysUseReturnStruct=true` at `:5110`) and `legalizeEntryPoints` runs AFTER (`:5162`), so `returnType` is already the synthesized struct ⇒ the struct branch is taken and the fall-through is never reached. Independently, `:4016` **builds its own layout** (`structTypeLayoutBuilder.build()` → `IRVarLayout::Builder`) so its `typeLayout` is non-null by construction — a null deref there is impossible. Real chain: rebuild **skipped by its own `if`** (`returnStructType == flattenedStruct`, no nesting), layout describes the wrong **type** not the wrong **field count**. ⇒ worse for the patch than my version: the guard sits on the path the fix was supposed to own. Also: `SLANG_ASSERT` → **`SLANG_ASSUME`** in Release (`slang-common.h:371`) — an optimizer promise on a false premise, not merely absent. Detail: [[feedback_a_release_compiled_out_assert_does_not_protect_a_new_deref]].

**✅SCOPE SETTLED 18:40Z — `:3693`/`:3668` are IN-SCOPE for #12155 and CANNOT split out; do NOT file an issue.** Main-verified on `origin/master` `d7d59f374` with live controls: `_collectFlattenedLeafLayouts`=**0**, `buildFlattenedResultVarLayout`=**0**, `composedOffsets`=**0** (controls `ensureStructHasUserSemantic`=4, `wrapReturnValueInStruct`=3, `getFieldLayout`=3 ⇒ instrument alive). Both defects live in functions that exist **only in the patch** ⇒ an issue would describe code not in the product and be **unreproducible on master**. The **producer gap** does survive (pre-existing, six shapes) — which is why #12400 + the #8183 comment are the right artifacts for *that* and the wrong ones for these. Test + why severity ≠ scope: [[feedback_issue_or_review_comment_ask_if_the_defect_survives_the_pr_closing]]. **Fixer will reconcile against the reviewer's actual wording when the verdict posts rather than assume it matches.**

**Reviewer A found 3 more defects in the same helper** (independent of the above): walk divergence at author-HEAD `:3693` (recursion on the field's *layout* vs the producer's *type* — silent wrong-`@location` **miscompile**, the lead finding), an offset-kind **union** at `:3668` that can duplicate attributes, and the rebuilt layout assigned to a local and **never written back** to the `IREntryPointLayout`. Verdict coming: **REQUEST_CHANGES**, `:3693` leading, producer gap as the scoping question.

**Fixer's position (accepted):** NOT widening the draft — its own producer-side prototype collides with the existing allocator (two authorities minting into one varying-index namespace), and the real remedy needs `lowerOutParameters` to record layout for what it appends, which lands on **#10030's contested layer**. That's `zangold-nv` + a maintainer's call. **Nothing pushed; head stays `a859c21797`** so the 3-cell matrix and the reviewer's six-shape cross-check stay valid against one target.

⚠️**Fixer's Debug binary is NOT a clean `a859c21797`** — an abandoned uncommitted producer-side prototype is linked into it, so the same shape gives EXIT=0 emitting `extra_0 [[user(_SLANG_ATTR_1)]]`. **Not a contradiction:** the prototype synthesizes the semantic at the producer, so the field hits the semantic `continue` and never reaches the guard. ⭐The 0-vs-139 delta *localizes* the crash to exactly the named path. Instrument disclosed, not offered — same category as the release-tarball trap.

**Provenance checked before believing it** (the trap that had produced codex's false reading): `slangc -v` → **`2026.14.1-50-ga859c2179`** (matches PR head, unlike the fetched `2026.14.1` tarball), guard comment string present in the built source and **absent on master** as a guilty control. Worktree left in place as the only revision-matched instrument — **if #12155 pushes a new head, re-run the 3-cell matrix against it.**

⚠️**TRAP worth reusing:** `/workspace/agent/wt-12155/build/slang-2026.14.1-linux-x86_64/bin/slangc` **exists but is a PREBUILT RELEASE TARBALL fetched as a build dependency** (`-v` → 2026.14.1, dated 07-30), NOT a build of the PR. codex ran it, saw Metal shapes still SIGSEGV "despite the guard", and read it as contradicting the patch — it *cannot* contain the patch, so that result carries zero information. ⇒ ⭐⭐**a `slangc` under a PR worktree's `build/` is not necessarily a build OF that PR: check `-v` / mtime.**

⚠️**Second instrument trap, same triage (4 probes void before 1 worked):** `slangc … -o /dev/null` → **`E00070` on BOTH the test AND the control** ⇒ the probe was void, not a finding. ⭐⭐**The control is what distinguished "my repro failed" from "my invocation is invalid"** — a same-error-on-control is the signature of a dead probe. Also burned: a guessed flag name, and a `pkill` that killed the probing shell itself. ⇒ when a slangc probe errors identically on test and control, fix the invocation before believing either result.

## Ownership change — mid-triage
**#8183 reassigned jkwak-work → `zangold-nv` at 17:36:13Z** (`assigned zangold-nv` :13Z, `unassigned jkwak-work` :15Z; jkwak cmt 5207873343 "Assigning @zangold-nv for triaging"). Main-verified via issue events. Any #8183/#12400 sequencing question goes to **zangold-nv** now, not jkwak.

## Approaches (not scoped — maintainer's call)
- **A.** Run the out-param merge for WGSL too (target-neutral lowering) — needs the producer to EXTEND the result layout, i.e. the same layout work #8183 still needs ⇒ why the two should be scoped together. Risk medium (every WGSL entry point with out/inout params changes shape).
- **B.** Diagnose instead of silently emitting invalid WGSL — removes the silent-wrong-output class, doesn't make the shape work. Low risk; precedent = E55202 already hard-errors the SV_Target1 out-param case.
- **C.** Fold into #12155 — REJECTED: mid-review, human-assigned, author explicitly scoped out-params out.

**Recommended sequence:** let #12155 land its guard, THEN take the WGSL half as A together with #8183's remaining layout-extension work. B is a defensible interim.

## Cross-links posted
- #12400 cmt **5207998744** (verdict). #8183 cmt **5207672921** (17:04Z, shape enumeration — posted by a *different slang-triager session* `sess-1784379926506-50ukxw`, same agent group) + cmt **5208026808** (17:59Z, delta-only: #7176 + the WGSL-crash correction). Triager correctly posted delta-only instead of duplicating the sibling.

**RESUME trigger:** when #12155 merges — triager re-reads the merged diff, re-runs the 3 shapes on wgsl+metal, and upgrades the source-derived claims on cmt 5207998744 in place. Then Main sequences the WGSL half (Approach A) with zangold-nv. Also open: #7176 dedup disposition (maintainer), and the unfiled duplicate-`@location(0)` defect.
