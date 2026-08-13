---
name: project_12313_minify_local_obfuscation_source_target
description: "slang#12313 — -minify/-obfuscate-locals feature request; HELD maintainer design decision"
metadata: 
  node_type: memory
  type: project
  originSessionId: fbf7712f-eef0-4bbd-b66c-f0f6a48b6d8d
---

# slang#12313 — Add `-minify` / `-obfuscate-locals` (lightweight text obfuscation for JIT pipelines)

feature-request/enhancement · P2–P3 · front-end (lexer/preprocessor/emit) + CLI · author j8asic (external CONTRIBUTOR) · verified @ master HEAD `4d8fa2e9d`.

**The ask:** text-output obfuscation mode that (1) strips comments/whitespace but PRESERVES `#if`/`#define`/`import`, (2) renames ONLY local/internal/non-public identifiers → `_v1`, (3) leaves public globals/cbuffers/ParameterBlocks/tex-sampler bindings intact so host reflection (`findParameterByName`) keeps working. Existing `-obfuscate` too aggressive.

⛔**HEADER WARNING: the first finding below was RETRACTED 08-07 as FALSE after a runtime measurement. "VERIFIED by source read" is exactly the phrasing that carried the error — a source read is not a runtime verification.**

**Triage findings (by source read — NOT runtime-verified):**
- ⛔⛔⛔**RETRACTED 08-07 — FALSE, AND WE PUBLISHED IT 3×. Read the RETRACTION block at the END of this file before citing anything about `-obfuscate` + reflection.** Original wrong text, kept for provenance only: ~~"`-obfuscate` complaint legit … Breaks reflection as OP claims."~~ The `addLinkageDecoration` hashing (slang-lower-to-ir.cpp:1522-1540) is REAL, but it hashes **IR linkage names**, which is a DIFFERENT LAYER from the reflection surface.
- Slang has NO Slang-source text target: `slang-emit-slang.cpp:6` is an empty stub; no `SLANG_SLANG_SOURCE` in target enum (include/slang.h). Text = HLSL/GLSL/Metal/WGSL/C/C++/CUDA only.
- Text emit is POST-IR: by emit time comments/whitespace/un-expanded `#if`/`#define`/`import` are GONE, one permutation baked in.
- Public/local boundary EXISTS: `DeclVisibility{Private,Internal,Public}`, `getDeclVisibility` (slang-check-decl.cpp:21256).

**LOAD-BEARING TENSION (why no small fix):** renaming only locals (req#2) needs parsed+checked scope info → only exists AFTER preprocessing collapses to one variant; preserving un-expanded `#if` (req#1) requires NOT preprocessing. Can't have both from Slang's pipeline. Same wall 3rd-party minifiers hit.

**Approaches:** A = token-level pre-preprocess minifier (only shape preserving permutations, but unsound/over-conservative, HIGH risk); B = complete slang-emit-slang stub + visibility-keyed preservation (clean split but emits ONE resolved permutation, defeats JIT-permutation goal, large); C = precompiled `.slang-module` (exists today, cf. closed #10065 same IP-protection goal, but OP can't precompile due to permutation explosion).

**State:** TRIAGED → HELD for maintainer design decision (not a bug, no small correct fix). Verdict comment POSTED on issue (nv-slang-bot, comment 5151087614) with 3 open design questions for maintainers:
1. Should Slang emit Slang source as first-class text target (complete stub + ABI target)?
2. Is robust local-only source minifier feasible in-architecture, or is intended path precompiled modules (#10065)?
3. Is reflection-preserving `-obfuscate` (exclude public/reflected decls) a smaller separately-useful feature?

No PR. Related: closed #10065.

## UPDATE 08-05 — maintainer replied; chain NARROWED to Q3, not closed

**jkwak-work (MEMBER)** comment 5195594303, 08-05T18:18Z, addressed to @j8asic. Two parts: (1) *"difficult for us to provide presets of features when there can be multiple options different users may want"* = soft NO on a curated `-minify` preset; (2) points at new `-Xspirv-opt` passthrough. **jkwak-work is now ASSIGNED** to the issue; Issue Type now `Feature` (earlier "couldn't set it" caveat was transient, corrected 08-04 via in-place edit of 5151087614).

**`-Xspirv-opt` mechanism REAL but STRUCTURALLY UNREACHABLE for the OP** — verified @ `b0e43d657`. Exactly ONE `getDownstreamArgs("spirv-opt")` call site: `slang-emit.cpp:3385`, inside `createArtifactFromIR` (:3291), sole caller `emitSPIRVForEntryPointsDirectly` (:3522), reached only from `case CodeGenTarget::SPIRV` (`slang-code-gen.cpp:1184-1189`). Text targets are DISJOINT switch cases (:1282-1292) → `emitEntryPointsSourceFromIR`, never consult spirv-opt args.

⭐**GUILTY-CONTROL instrument (the decisive cell — copy this shape):** a bogus pass name. `-target spirv -Xspirv-opt definitely-not-a-pass` → `spirv-opt: error: … not a valid flag`, exit 255 (parsed+forwarded); `-target hlsl` same arg → **zero diagnostic, exit 0** (silently discarded); text output byte-identical ± the flag. A null alone was weak; **the positive control made it dispositive.** ⚠️Two instrument traps hit and caught: `echo "exit=$?"` after a pipe read `head`'s status not slangc's (needed `${PIPESTATUS[0]}` — a defective capture nearly made a 255 look like 0); and `-Xspirv-opt strip-debug` (single dash, as jkwak's prose spelled it) itself errors — spirv-opt wants `--strip-debug`.

⭐**NEW FINDING in neither jkwak's comment nor the original verdict:** on `-target spirv`, `--strip-debug` delivers the OP's actual requirement — `OpName` 5→0, `gTint` gone from blob (1000→828 B) — **and reflection SURVIVES** (`OpDecorate Binding`/`DescriptorSet` untouched; `-reflection-json` still names `gTint`/`outBuf`/`computeMain`, because Slang serves reflection from its OWN layout data, not the stripped `OpName`s). So "strip names + keep `findParameterByName`" IS available — just on the binary path, which the OP says they can't use. ⛔⭐⭐⭐**THIS PARAGRAPH IS THE REFUTATION WE MISSED FOR 2 DAYS.** *"Slang serves reflection from its own layout data"* **IS** tangent-vector's AST-vs-IR mechanism, and it contradicts our own `-obfuscate`-breaks-reflection claim above. We cited it 3× to support a DIFFERENT point and never re-tested the claim it undercut. See the RETRACTION block at the end. Published with the working spelling + `--strip-reflect`/`--strip-nonsemantic`.

**Disposition:** Q1 (Slang-source text target) + Q2 (local-only source minifier) effectively NO — anti-preset direction + unchanged architecture. **Q3 STAYS OPEN and is NOT covered by the anti-preset rationale**: reflection-preserving `-obfuscate` is a correctness carve-out on an EXISTING flag (`addLinkageDecoration` slang-lower-to-ir.cpp:1522-1540), not a preset of user-selectable options. Asked explicitly, with an offer to open a draft PR. Fresh reply comment 5195672958 posted (NOT an edit — last commenter was human, so a new comment was required to notify).

**Ownership (verified, not absorbed):** timeline shows ONE `assigned` event — `jhelferty-nv` assigned `jkwak-work` @17:49:09Z, **29 min BEFORE** his 18:18Z comment ⇒ routed by a maintainer then answered, so this is an **OWNED park** ⇒ no nudge warranted. Unfiltered census: `assigned 1 · commented 3 · issue_type_added 1 · mentioned 4 · subscribed 4` — **zero `labeled`/`unlabeled` EVER** (positive control: same query shape on #12326 returns 2 label events, so the filter fires). `issue_type_added`=1 ⇒ Type=Feature was a single un-revised event, artifact-side corroboration of the sibling-correction episode.

⛔⭐⭐⭐**LESSON — I DIAGNOSED AN INSTRUMENT I COULD NOT SEE, using MY OWN query's shape.** Triager asserted my timeline filter was "structurally incapable" of returning a `labeled` event; **mine had 4 disjuncts including `labeled`/`unlabeled` plus a `label.name` projection — theirs had 2.** They inferred my aperture from theirs and never opened my command. ⇒ **A claim about what someone else's instrument could see is a claim about an artifact only THEY hold: ASK FOR THE COMMAND, don't diagnose it.** ⭐⭐⭐**What makes this class survive is that the misaimed remedy REPRODUCED THE SAME ANSWER** — a true principle, attached to a step that doesn't exhibit it, with a confirming re-measurement ⇒ no test fails, no reviewer objects, the misattribution is permanent. Sibling of *caveat-aimed-at-the-wrong-claim* and of *wrong-mechanism-behind-a-right-conclusion*. ⚠️**MY OWN half: I wrote "that query returned only the assign event" WITHOUT publishing the query** ⇒ evidence wider than the claim, indistinguishable from a scoped filter, which is what made a correction LOOK warranted. ⇒ ⭐⭐**PUBLISH THE APERTURE, NOT JUST THE RESULT.** Both were RETRIEVAL failures, not knowledge gaps — each rule had been filed by its own violator earlier in the same conversation. Containment measured: 7 phrase probes on comment 5195672958 all 0 (non-zero control 1) ⇒ never reached GitHub, nothing to repair publicly.

## UPDATE — jkwak WITHDREW the `-Xspirv-opt` suggestion; ESCALATED to office hours
*(trigger comment 01:09:08Z; state below READ 08-06T01:14Z+ — ⚠️stamp a state block with the READ time, never the triggering event's time: I first labeled this "verified 01:09Z" while it cited a 01:13:08Z artifact, i.e. an aperture claimed narrower than the rows under it. Harmless here, but a future session reading the stamp as the aperture would under-trust rows the read actually covered.)*

**jkwak comment 5199239169** (01:09:08Z): *"I thought it was for SPIRV target but when I re-read the description, it is definitely about the textural output such as HLSL. I will discuss this tomorrow with @csyonghe"* ⇒ the pipeline-stage analysis LANDED. It neither answers Q3 nor rejects the request.

⛔⭐⭐⭐**"NO LABELS EVER SET" IS NOW DEAD — and it was VERIFIED WITH A POSITIVE CONTROL when recorded 6h earlier.** `labeled` ×2 @08-06T01:08:18Z, actor `jkwak-work`, `Office-Yong` + `Office-Tess`, **50 s BEFORE his comment**. Census now `assigned 1 · commented 5 · issue_type_added 1 · labeled 2 · mentioned 5 · subscribed 5`. ⇒ ⭐⭐⭐**A MEASUREMENT CAN HAVE AN EXPIRY: correct method + correct control + true-when-measured + FALSE 6 HOURS LATER. A control proves the INSTRUMENT fired; it says NOTHING about the claim's SHELF LIFE — "verified" and "durable" are different properties, and rigor on the first quietly manufactures confidence in the second.** ⭐⭐**The tell we both had: a NAMED, ACTIVELY-ENGAGED assignee is exactly the condition under which absence-of-human-action should be expected to flip.** Any absence-of-human-action claim on a live issue is a snapshot.

✅**`Office-*` convention (verified from label descriptions, NOT guessed — and it WIDENED the escalation past my read):** `Office-Yong` = "To be discussed during Yong's office hours" (14 uses); `Office-Tess` = "To be discussed during Tess' office hours" (8 uses). **Office-hours AGENDA MARKERS, not triage taxonomy.** ⇒ **A THIRD maintainer (Tess) is in scope — jkwak's comment names only csyonghe, but he labeled for BOTH. That fact lives ONLY in the labels.** Labels untouched by us (human routing).

**Triager posted 5199262742** (01:13:08Z, 2116 chars, verified live): Q3 as the one actionable item + `slang-lower-to-ir.cpp:1522-1540` cite + draft-PR offer; `--strip-debug`-keeps-reflection surfaced for @csyonghe framed as **NARROWING** the problem ("already exists on the binary path — the OP just can't reach it") rather than a new capability ask. Q3-absence measured before acting: Q3 fragments present in our 2 comments, **ZERO across both of jkwak's** (non-zero control) ⇒ "easy to lose" was a measured claim, which is what justified posting on an already-engaged thread.

**Disposition:** design gate WIDENED (1 maintainer → 3: jkwak + csyonghe + Tess). Still NO fixer.

## UPDATE 08-07T05:39Z — csyonghe (LEAD) delivered the office-hours outcome; disposition FLIPPED maintainer-gated → **OP-GATED**

**csyonghe comment 5212877997** (08-07T05:39:29Z, MEMBER, 434 ch): *"As @nv-slang-bot pointed out, this feature require new infrastructure to be able to output slang as a target, which we don't currently have in place yet. I wonder if the problem can be approached by moving the preprocessor based specialization to link-time-constant based specialization, so you can embed precompiled slang modules instead of textual source."*

✅**Q1 ANSWERED `no` ON THE RECORD** — the lead maintainer adopts our emit-slang-stub / no-Slang-source-target analysis **by name** as the reason. Not merely implied by the anti-preset rationale.

✅**Q3: PASSED OVER BY BOTH MAINTAINERS — measured, not impressionistic.** Probe across all 6 comments: present in all 3 of ours, **ZERO in all 3 maintainer comments** (jkwak ×2, csyonghe ×1); csyonghe's non-zero controls fire (`link-time`/`infrastructure`/`precompiled`/`nv-slang-bot` = 1, zero-control 0) ⇒ real absences. ⇒ ⭐⭐**Two independent silences = information. NO third ask** — re-raising a question two maintainers declined to engage reads as pestering once the discussion has produced a real alternative. Demoted to a single parenthetical clause.

⭐⭐⭐**THE CRUX — verified verbatim @HEAD `88fa1206d`, `docs/user-guide/10-link-time-specialization.md:25-30`: PRECOMPILATION IS INDEPENDENT OF SPECIALIZATION.** Modules precompile to binary IR *"in a complete offline process that is **independent of any specialization arguments**"*; specialization args are supplied at LINK time, *"reusing all the work done during module precompilation."* ⇒ **It is NOT "precompile every permutation"** — which is precisely what the OP's stated blocker (*"countless permutations ⇒ cannot precompile"*) assumed away. **This is why Approach C is genuinely back** via the mitigation the original triage flagged and the OP pre-emptively rejected.

**Link-time boundary, verified (positive controls both directions):** WORKS = values/loop bounds · **struct field presence** via `Conditional<T,bool>` (`slang-ir-lower-conditional-type.h:12-13`) · **resource-binding presence** (compiled: gated resource absent from emitted SPIR-V, ungated control present 6×) · link-time type substitution. **DOES NOT** = gating a whole declaration (`E20001 unexpected token`, while the same gating via `#if` exits 0) · gating `import`s · entry-point signature changes beyond `Conditional<>` · link-time-const array sizes (WIP, `E31010`).

**Triager posted 5212970698** (05:49:18Z, 3724 ch, verified live 11/11 fragments, zero HTML escaping — load-bearing since the body is full of `Conditional<T, cond>`/`<uint>` generics) aimed at **@j8asic, NOT maintainers**: can/cannot table · the deciding question *"are your permutations values-and-presence, or do they change program shape?"* · the precompile-independence quote · ⚠️*"resolves your IP concern **strictly better** than minification"* (line 24) — **THE ONE UNHEDGED CLAUSE in an otherwise conditional artifact; do NOT restate it bare.** It is a COMPARATIVE claim and silently presupposes the compared-to path is AVAILABLE: if their permutations aren't expressible as link-time constants, binary IR isn't "better" than minification for them, it's UNREACHABLE and the comparison has no subject. ⭐⭐⭐**The triager's 4 overclaim probes returned 0 because they were scoped to the *"this solves your problem"* family — the correct refusal — while the overstatement sat one clause over in a COMPARATIVE. A probe set aimed at the claim you were careful about cannot detect the claim you weren't.** ✅**Decided AGAINST a public correction:** line 19 carries `If your`+`likely` and line 26 opens *"If it turns out your permutation set genuinely isn't expressible this way"* ⇒ frame is globally conditional, and line 26 already does a correction's work better (tells them the non-expressible case is a VALUABLE finding to report). · **`--strip-debug`/reflection finding REUSED** as pre-emptive evidence against the reflection objection they'd most likely raise against binary modules.

⭐⭐**Correctly declined to assert either way on the OP's corpus** — whether their permutations are expressible this way is empirical about shaders only they can see. **The asymmetry that made publishing criteria-not-verdict right: guessing "yes" ⇒ they spend a refactor discovering otherwise; guessing "no" ⇒ they abandon a path that likely works. Neither error is recoverable from a comment.**

⚠️**Instrument trap, 2nd hit this chain: `$?` after a pipe reads the LAST pipe element** — a cell reported 141 (SIGPIPE from `head`) for a compile that really failed `E20001`. **The diagnostic TEXT was the datum, not the exit code.** Use `${PIPESTATUS[0]}` or drop the pipe.

⛔**STANDING CEILING for this chain — do not exceed in any summary:** the inference *"countless permutations ⇒ cannot precompile"* is **REFUTED** (precompilation is independent of specialization args, verbatim). Whether their corpus is **expressible** as link-time constants is **UNMEASURED and only they can measure it**. ⇒ Honest form: *"the path they rejected is **likely** the one that solves it."* Anything stronger than "likely", in either direction, is unsupported. ⭐⭐**A one-notch overstatement in a CLOSING SUMMARY is the shape most likely to harden into fact — the summary is what the next reader inherits, and nobody re-derives a closing line.**

**Two outcomes:** OP says link-time specialization works ⇒ closes as ANSWERED with zero code. OP says it doesn't ⇒ we get a **NAMED technical gap**, a far stronger position than the original request.

**RESUME:** **@j8asic answers** whether their permutations are values-and-presence (⇒ link-time specialization) or shape-changing (⇒ named gap). Still NO fixer. No maintainer action pending — do NOT nudge jkwak/csyonghe/Tess.

⚠️**SILENCE FALLBACK (the branch a webhook CANNOT deliver).** This chain is gated on an **EXTERNAL party**, so per the standing rule *a gate on someone else's reply has no resume trigger you control — set the fallback when you set the gate.* Coverage audited 08-07: the **webhook path is PROVEN, not assumed** — all 4 prior maintainer/OP comments woke this chain correctly — and the 12 h `/supervise-issues` cron (`task-1780670816061-rgq8eo`) sees it. ⇒ **A dedicated guard cron was DECIDED AGAINST as duplicate noise** (13 series already armed). But neither instrument fires on *nothing happening*. ⇒ **If @j8asic is still silent ~2 weeks after 08-07 (i.e. from ~08-21): close as ANSWERED, do NOT nudge.** An external requester who stops replying after a maintainer offered a concrete alternative is not owed a chase; the right terminal act is a short 5-bullet close whose `next-action:` says the link-time-specialization path was published and stands unrefuted, leaving Q3 on the record as independent and unasked. **Re-opens freely on any later reply** — a substantive human comment re-opens a closed chain. — yes ⇒ release slang-fixer for a DRAFT PR scoped to the linkage-name carve-out; no ⇒ close wontfix. Or OP clarifies whether shipping SPIR-V is viable for some permutations after all.

---

## ⛔⛔⛔ RETRACTION 08-07 — "`-obfuscate` breaks name-based reflection" WAS FALSE. Published 3×. tangent-vector was right.

**Challenge:** `tangent-vector` (MEMBER, senior architect) comment 5220795783 @08-07T18:42:43Z asked `@nv-slang-bot` directly to confirm it, and gave the mechanism: obfuscation works at **Slang IR** level while **reflection vends from AST-level representations**, so hashing IR linkage names cannot touch a name-based reflection query.

**MEASURED INDEPENDENTLY ON MY OWN EDGE @HEAD `7dc8091a6`** (not relayed — triager measured via C++ `libslang` probe, I re-ran via CLI and got the same answer):

| query | plain | `-obfuscate` |
|---|---|---|
| `-reflection-json` whole file | — | **BYTE-IDENTICAL to plain** |
| `Uniforms`/`gStandalone`/`outBuf`/`gTex`/`gSamp`/`gTint`/`gScale` in reflection | 2 each | **2 each — ALL PRESENT** |
| `zzDefinitelyNotAParameter` (**guilty control**) | 0 | **0** ✅ |
| emitted HLSL `gTint` / `Uniforms` / `gStandalone` | 2 / 3 / 2 | **0 / 0 / 0** |

⇒ **Reflection is UNAFFECTED while obfuscation is demonstrably ACTIVE IN THE SAME RUN.** The HLSL column is the positive control proving the flag did something; the guilty control proves the lookup can fail. Both required.

✅**His mechanism confirmed by our OWN docs** — `docs/user-guide/a1-03-obfuscation.md`: *"With the `-obfuscate` option we strip the AST, in an abundance of caution…"* (verified verbatim). Module level: obfuscated `.slang-module` carries 5 hashed `_Sh<hex>` linkage names vs 0 plain — the mechanism originally read, now confirmed at runtime — with the reflection surface untouched. AST-stripping reported as **PARTIAL**, not overstated: residual mangled `_S3lib5Thing…` strings remain, module only 6764→6252 B.

⛔**`findParameterByName` IS NOT A SLANG API AT ALL** — **zero** hits in `include/` and `source/` (I verified); it is a test helper at `tools/slang-unit-test/unit-test-std140-matrix-element-stride.cpp:17`. **We repeated the reporter's prose for a week without checking the symbol existed.**

### The defect, and why it is worse than a wrong answer
⭐⭐⭐**WE INFERRED AN API-LEVEL FAILURE FROM AN IR-LEVEL SOURCE READ AND NEVER RAN THE QUERY.** Two architectural layers crossed in one sentence, published as *"confirmed … That part is legitimate."*
1. ⭐⭐⭐**THE HEDGE NAMED THE GAP AND DID NOT STOP THE CLAIM.** The same comment said *"a source read … **not a runtime experiment**"* and the VERY NEXT SENTENCE asserted the break as confirmed. **An accurate disclaimer sitting beside an overclaim is inert — it documents the risk instead of blocking it.** ⇒ **If a hedge says "not measured", the claim it guards may not use the word "confirmed."**
2. ⭐⭐⭐**WE HELD THE REFUTING EVIDENCE AND SPENT IT ON SOMETHING ELSE.** The 08-05 `--strip-debug` finding — *`OpName`s stripped, yet reflection still resolves parameters because Slang serves reflection from its own layout data* — **IS tangent-vector's architecture**, and it contradicted our own `-obfuscate` claim. We cited it 3× to support a different point and never re-tested the claim it undercut. ⇒ ⭐⭐⭐**WHEN A NEW FACT ESTABLISHES A MECHANISM, RE-TEST EVERY EARLIER CLAIM THAT RESTED ON THE OPPOSITE MECHANISM.**

**Triager posted retraction 5220876524**, explicitly superseding **5151087614, 5195672958, 5212970698**.

### ⚠️ THIS REFRAMES THE WHOLE CHAIN
*"`-obfuscate` breaks reflection"* was the accepted **PREMISE** of the entire request — ours AND the OP's. With it gone:
- **The OP hit something ELSE** — a serialized-AST issue (the doc's AST-stripping ⇒ `-r` can't access functionality), or the separate `import`-resolution failure they mentioned in passing. Unknown which; theirs to say.
- ⛔**Q3 (reflection-preserving `-obfuscate` carve-out) MAY BE MOOT — a fix for a defect that may not exist.** HELD **with its premise in doubt**; **must NOT be revived without re-deriving the premise from a runtime measurement.**
- tangent-vector's 2nd reading surfaced to @j8asic (un-obfuscated names in the **emitted output** for `spv-reflect`-style post-compilation reflection), answer left to them.

**My own correction owed upward:** I relayed the reflection-break to the operator as VERIFIED across several turns. Corrected.

## UPDATE 08-12T17:15Z — 4th maintainer (jhelferty-nv) asks the OP to clarify scope; `Needs reporter feedback` label added

**jhelferty-nv comment 5270043944** (MEMBER, 08-12T17:15:36Z, **NOT a bot mention** — addressed to @j8asic): *"It sounds like we need more clarity on what is being proposed. @j8asic Can you provide details on what you're trying to accomplish? Is your goal to minify slang source code, or is it to change the nature of symbolic name obfuscation to include the names of shader parameters but not locals?"*

**State:** open · assignee `jkwak-work` · labels now **`Needs reporter feedback` + `Office-Yong` + `Office-Tess`** (the reporter-feedback label is NEW — a maintainer has formalized the awaiting-reporter state) · comments 10.

**Significance — this CORROBORATES our disposition, does not reopen work:**
- A maintainer applying `Needs reporter feedback` = independent confirmation the chain is correctly **gated on @j8asic**. Our silence-fallback ~08-21 now backed by a maintainer-applied label.
- **NOT a bot mention** ⇒ nothing owed for us to post; jhelferty is asking the reporter, not us.
- **THREE readings of the request are now on the table, from three different maintainers/architects** ⇒ strongly validates our repeated refusal to assert what the OP wants: (1) jhelferty A = minify slang source; (2) jhelferty B = change obfuscation to cover parameter names but not locals; (3) tangent-vector = un-obfuscated names in the emitted OUTPUT for `spv-reflect`-style post-compilation reflection. jhelferty's two framings do NOT include tangent-vector's.
- jhelferty's framing does **not** restate our retracted reflection-break claim — it's a scoping question, not a mechanism claim. Clean.

**Disposition unchanged:** gated on @j8asic, now with a maintainer-applied `Needs reporter feedback` label. Silence-fallback ~08-21 stands (today is 08-12; a maintainer nudged the reporter, which if anything refreshes the wait). Still NO fixer.
