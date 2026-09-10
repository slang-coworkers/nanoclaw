---
name: project_12364_cts_storage_image_minnonuniform
description: "slang#12364 CTS storage_image_minNonUniform on VK-GL-CTS 0.0.9 — CLOSED won't-fix (jkwak-work). Slang is NOT in this case's path: the failing SPIR-V is a hand-authored C++ string literal in CTS, so the GLSL tag and the present NonUniform decoration need no compiler explanation. Cause UNIDENTIFIED (exclusion proven, not attribution). Open obligation: revert waiver commit 2ab0526b7a in VK-GL-CTS when resolved, or say the waiver should persist."
metadata:
  node_type: memory
  type: project
  originSessionId: main-12364-triage
---

# slang#12364 — `dEQP-VK.descriptor_indexing.storage_image_minNonUniform` on VK-GL-CTS 0.0.9

Filed 2026-08-05 by jkiviluoto-nv. **CLOSED won't-fix** by jkwak-work (08-05, completed; label
`bug`→`regression`, milestone Q3 2026). Triaged; verdict posted (cmt `5191182483`); **no fixer** —
there is no Slang codegen change to make.

## Verdict — Slang is not in this test's path (compile-time fact)

CTS dispatches by C++ overload: this case is a `SpirVAsmSource` → `assembleProgram`
(`vkPrograms.cpp:871`), which never calls the Slang hook (reachable only via
`buildProgram(GlslSource|HlslSource)`). `minNonUniform` returns early into `initAsmPrograms`
(`vktDescriptorSetsIndexingTests.cpp:4410`), and **the SPIR-V is a hardcoded C++ string literal**
(`:2662-2733`, incl. `OpSource GLSL 450` at `:2672` and the `NonUniform` decorate at `:2686`).
⭐ Both "it's Slang codegen" observations — the `OpSource GLSL 450` tag and the *present*
`OpDecorate %41 NonUniform` — **collapse into one fact: the asm is hand-authored**, so neither
needed a compiler explanation. Before calling two observations independent, ask whether one upstream
fact produces both.

## Established (measured)

- Reproducible, deterministic; byte-identical failure `max difference = (1.34744e+08, 0, 0, 0)`.
  Full-suite 0.0.9 run `30985159061`: `Passed 12396/13792`, exactly **1** failure = this test.
- Waiver landed: VK-GL-CTS commit `2ab0526b7a` (`test-lists/slang-waiver-tests.xml`, +3/−0, fenced
  `<!-- 12364 -->`). Nightly is unblocked ⇒ pure fix-tracking item, no CI urgency.
- **Discriminator (sharpest fact):** 5 sibling `*_minNonUniform` cases PASS in the same run;
  `storage_image` is the only arm using `OpImageTexelPointer` + `OpAtomicIAdd` ⇒ specific to the
  **atomic-on-storage-image texel pointer**, not to non-uniform indexing.
- **Sibling, not duplicate** of the [[project_12110_nonuniform_descriptorhandle_spirv]] family
  (#12110/#12161): those concern a *dropped* NonUniform decoration on the `DescriptorHandle` path;
  here the decoration is present. **Do not merge this into #12110's scope** — a wrong-layer merge is
  the likely bad outcome precisely because the name contains "NonUniform".
- jkwak-work independently reproduced locally and confirmed the routing (deleted `slang-compiler.dll`
  → identical failure, no load error; no `test.slang.comp` ever written). His DRIVER-DELTA hypothesis
  is **refuted by CI**: same GPU `0x26b1` + driver `0x950ec000` on both the 0.0.7 PASS
  (`30997089246`) and 0.0.9 FAIL (`30985159061`). This excludes a driver *change* across the delta,
  not driver *behaviour* as a mechanism.

## Two honest limits (carry with any restatement)

1. **Cause is UNIDENTIFIED, not resolved** — what is proven is *exclusion* of direct Slang SPIR-V
   codegen, not *attribution*. Live candidates stay a set: the 0.0.9 binary's bundled SPIRV-Tools/
   glslang build & flags (two prebuilts built ~18 months apart), the driver's handling of the atomic,
   CTS runtime/recipe. "Excluded X" and "identified Y" are different findings; don't merge them when
   the report is shortened.
2. **The `0x08080808` bit pattern is a WEAK clue, not a lead.** The log normalizes
   `p' = p×7.42148e-09 − 1.25` (zero-crossing ≈ 1.684e8), so a black Result is consistent with no
   writes *and* a huge range of non-zero values; ~1,001 integers render as the displayed
   `1.34744e+08`. Consistency, not identification — a round number matching a pretty bit pattern is a
   coincidence candidate until you count the pre-images.

## Open obligation (MUST survive) & PR

When resolved, **revert waiver commit `2ab0526b7a`** in shader-slang/VK-GL-CTS (3 lines, fenced) —
**or**, if the waiver should persist, say so explicitly to jkwak rather than letting it lapse
silently (his cmt `5194000311` asked for the revert-on-resolution). **PR #12365** (jkiviluoto-nv)
flips the nightly to 0.0.9 but `closingIssuesReferences=[]` ⇒ won't auto-close #12364. Decision made
**not** to bot-comment on #12365: its false "upstream test changed" premise is inert (gates no line
of the diff); correct a published premise only when it can change a decision.

## Process history (pruned — retracted probes)

Several probes were retracted during triage and are kept only as pointers: the "upstream CTS test
changed" claim is false (test-file blob identical at both tags); a `GLSLSource` count that could not
fail (not a qpa tag); a shallow-clone graft-root pickaxe artifact
([[feedback_shallow_clone_makes_your_head_the_graft_root]]); a workflow-id rename population error
(query by filename + `previous_filename`; the nightly workflow id was minted by rename commit
`cf5d225f8c`). Lessons filed under [[slang-evidence-lessons-index]] and shared learnings.

## RESUME (v4)

Fires on **any** of: any fresh substantive non-bot comment (catch-all — outranks the specific
clauses, since an enumeration is blind to the category you didn't think of); a scope/definition-of-
done change (jkwak's revert obligation is the founding instance); or terminal — the issue closes, or
master's nightly is bumped to 0.0.9 (making this a live CI blocker, not a tracked fix). A bot comment
is not an inbound.
