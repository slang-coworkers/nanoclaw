---
name: project_12386_ptr_empty_struct_nonsimple_ice
description: "slang#12386 — comparing any pointer whose pointee transitively contains an empty struct ICEs at slang-ir-legalize-types.cpp:2197 (cuda+cpp only). NOT a dup of #7612. PR #12304 does not fix it and WIDENS it. Fixer dispatched Approach A (diagnostic-instead-of-abort). RESUME = fixer [Fix Report]."
metadata: 
  node_type: memory
  type: project
  originSessionId: a26832cb-f085-4fc7-a9a3-2dab994488d5
---

**slang#12386** "CUDA: Ptr to an empty struct compared with nullptr aborts slangc with InternalError" — reporter `tdavidovicNV` (MEMBER), filed 2026-08-06T06:32:51Z. Triaged same day by `slang-triager`; canonical thread `gh-issue-shader-slang/slang-12386`.

**Verdict: bug / medium / P2 / IR type legalization + C-family (CUDA/CPU) emit. Not a regression** (assert predates the reporter's v2026.14.1; mechanism dates to #2746, 2023-03-28) ⇒ `regression` deliberately withheld. Labels applied `cuda` + `reproduced`, Type=Bug. Issue verdict comment **5201487089**.

**Real trigger is WIDER than the title** (triager's finding, two extra cells both byte-identical aborts): `p == q` with no `nullptr` anywhere ⇒ not null-specific; `struct Wrap { Empty e; }` + `Ptr<Wrap> == nullptr`, pointee non-empty but *contains* an empty field ⇒ not empty-pointee-specific. ⇒ **comparing any pointer whose pointee type transitively contains an empty struct.** Non-triggers (boundary real): `Ptr<Empty>` null-compared *without* `__getAddress` → 0; `__getAddress` + deref without comparison → 0.

**Target scope is C-family emit, NOT CUDA-specific.** 2×7 matrix in one binary: cuda + cpp → 255 NONSIMPLE; spirv/metal → E31160; hlsl/glsl/wgsl → E36107. The non-CUDA rejections are about `Ptr` **as a feature** (negative control: non-empty pointee fails identically there), so the reporter's HLSL observation invites the wrong inference.

**Mechanism, Main-verified at `9eb90c50a`:** `slang-ir-legalize-types.cpp:2197` `SLANG_UNEXPECTED("non-simple operand(s)!")` — the `default:` arm of `legalizeInst`, with `// TODO: produce a user-visible diagnostic here` already on `:2196`. No comparison opcode has a case anywhere in that switch (28 opcodes covered; all arithmetic likewise absent), and the `flavor == none` escape can't fire because `Eql`'s *result* is `bool` (simple). ⛔**POLARITY CORRECTED 2026-08-06 — my original wording here, "`isSimpleType` at `:4150-4173` returns true on Metal or on any of seven decorations", was INVERTED for Metal, and I had stamped it "Main-verified".** Re-read at `:4149-4155`: the Metal branch is `if (isMetalTarget(...)) return false;`. Call site `slang-legalize-types.cpp:1210` is `if (context->isSimpleType(type)) return LegalType::simple(type);` ⇒ **`true` = RETAINED, `false` = legalized away.** So Metal is the one target that **never** retains an empty struct — the opposite of what I wrote. Correct statement: **`isSimpleType` returns `false` unconditionally on Metal; on every other target it returns `true` (retain) for any of seven decorations** — `LayoutDecoration` (**first case label, `:4162`**), **`PublicDecoration`**, `ExternCpp`, `DllImport`, `DllExport`, `HLSLExport`, `BinaryInterfaceType`.

⚠️ **Three contexts share the assert, not one.** `legalizeInst` is a **free static** (`:2087`, `:2383`) with no subclass override, so its `default:` arm is common to all three legalization contexts, all invoked from `slang-emit.cpp`. The other two override `isSimpleType` to `return false` **unconditionally** (`:4081`, `:4116`) ⇒ they reach that arm *more* readily than the empty-type context does. Raises Approach A's blast radius from LOW to **MEDIUM** (still the recommendation — it changes a failure mode, not policy). Precedent that a diagnostic is expressible right there: `context->m_sink->diagnose(...)` already appears in this same file at `:870`, `:903`, `:912`, `:2069`, `:2374`.

## ⛔ PR #12304 does NOT fix #12386 — it WIDENS it (the load-bearing finding)

| cell | master `9eb90c50a` | master + #12304 |
|---|---|---|
| reporter's repro | 255 NONSIMPLE | 255 NONSIMPLE |
| `p == q` | 255 NONSIMPLE | 255 NONSIMPLE |
| `Ptr<Wrap>` (Wrap contains Empty) | 255 NONSIMPLE | 255 NONSIMPLE |
| non-empty pointee (neg ctl) | 0 | 0 |
| **`public struct Empty` + same compare** | **0 — compiles** | **255 NONSIMPLE** |

Because `PublicDecoration` is in `isSimpleType`'s seven, a `public` empty struct **survives** legalization today and the comparison emits fine. #12304 removes that decoration at the producer (`slang-lower-to-ir.cpp`, its entire source contribution = **one 4-line removal**; API `compare/master...fix/issue-8125-v2` = ahead 1 / behind 35, merge-base `dc9558d57`) ⇒ the type legalizes away ⇒ the comparison falls into the unhandled `default:`. **So producer-side removal converts a silently-working program into an ICE.**

⭐⭐ **This is not merely a sequencing fact — it is empirical evidence for the layer question the `Office-Yong` fork exists to settle.** It removes *"producer-side removal is sufficient"* from the table by measurement, not argument. (It does not decide the fork; jkwak dictated producer-side, an earlier review argued consumer-side `isSimpleType`.) Triager deliberately kept its PR note narrower — sequencing + mechanism, no fork claim — so maintainers reach the conclusion from the receipt rather than being handed it by a bot on a thread reserved for design discussion. **Correct call; endorsed.** Land-order note on #12304 = comment **5201498632**.

**Method note worth reusing:** a fresh worktree could not be built (submodules unpopulated → configure dies on `SPIRV-Headers::SPIRV-Headers`, then wants DXC-from-source ~500 MB / 10–30 min). Triager instead extracted #12304's **own** delta via `merge-base..head` (the two-way `master..pr` diff is polluted by the 35 commits master gained since) and bracketed apply→build→measure→revert on the main clone — a tighter A/B than a whole branch, one variable. **Positive control that the fix was live in the binary:** #12384's shape emits `struct Empty_0` on master (1) and **0** with the patch.

## Dedup — NOT a dup of #7612, and the reporter's sibling issue is the proof

- **#7612 / #8125 family = RETENTION → layout skew:** empty struct kept as a real member in C-like emit while reflection says size 0 → following field offset skews → `CUDA_ERROR_ILLEGAL_ADDRESS` / SIGSEGV. Symptom class: **silent ABI mismatch, output produced.**
- **#12386 = legalization COVERAGE → hard abort, no output, different site.** Shared ancestry (both downstream of empty-type legalization), different bug.
- **#12384** — same reporter `tdavidovicNV`, filed 06:17:39Z = **15 min before** #12386, label `RTR` (self-applied). "CUDA: empty public struct field makes reflection and PTX disagree on entry-point parameter layout." This is the "separate CUDA ABI mismatch" #12386's body says it was found while minimizing ⇒ **#12384 is the one in #7612's family; #12386 is the coverage sibling.** Makes the split self-evidencing rather than argued. **Absent from my briefing — the triager found it.**
- **#10069** ("ICE on zero-size array in nested struct") = same assert, same file, its own body even names the same diagnosis — but **complementary opposite target profile** (spirv only vs cuda+cpp only) and a different producing construct ⇒ same **assert family**, distinct bugs. Side finding: **#10069's "all targets" is STALE at HEAD**; triager posted the correction as comment **5201579437**, re-verifying the matrix immediately before posting. Companion #10070 asks for its regression test.
- **PR #11657** (closed) = the global `removeEmptyStructFields` pass, killed in CI by **this exact assert** (`layout-conditional-field.slang.4 (cpu)`). Standing constraint: keep any fix consumer-side / in `IREmptyTypeLegalizationContext`, never a global removal pass.

## Test-coverage gap (Main-found, triager-strengthened)

#12304's own new test `tests/bugs/empty-struct-parameter-block.slang` (119 lines) contains **no** `Ptr<` / `__getAddress` / `nullptr` (must-hit ctl `Empty` = 12). Repo-wide: **all 29** files under `tests/` using `nullptr` contain **zero** empty structs, while the same empty-struct regex matches 78–84 files ⇒ **the two features have never been combined.** All 4 files with a `public` empty struct have `Ptr<` 0 / `__getAddress` 0 / `nullptr` 0 ⇒ **the regressing cell has zero coverage on any target** — which is why #12304 can turn a working program into an ICE and stay green.

⚠️ **My own enumeration of this was wrong by 26 files** (I named 3 of 29; prefilter `Ptr<|__getAddress` is blind to the `T*` spelling, e.g. `ptr-to-interface-null-check.slang:28` `IFoo* p = nullptr;`). Conclusion survived only because the triager tested the conjunction from the full set. See [[feedback_an_enumeration_behind_a_prefilter_describes_the_prefilter]].

## Dispatch state

**Fixer dispatched 2026-08-06 ~07:17Z, Approach A ONLY** — turn the abort at `:2197` into a diagnostic (the `// TODO` is already there). Small, collides with nothing, answers the issue's own fallback ask, and also improves #10069. **Approach B (semantic ruling on what `Ptr<T>` means when `T` legalizes away, then opcode coverage) is OUT OF SCOPE** — belongs to the maintainers in the Office-Yong discussion. **If A cannot be done without touching legalization *policy*, that is a stop-and-report, not a scope expansion.**

Required test cells in the brief: (1) the bare-`struct Empty` repro; (2) **the `public struct Empty` + pointer-comparison cell — the important one**, since it has no guard anywhere and its polarity flips (compiles now → ICE after #12304), making the interaction visible to CI instead of to a human reading two issues. Canary named as a **drift signal, not a test to update**: `tests/language-feature/dynamic-dispatch/layout-conditional-field.slang` (7 targets incl. `-cuda`/`-cpu`; the `-cpu` directive is `.4`, the one #11657 died on). Posture: draft PR, `Closes #12386`, `report_pr_created`, `pr: non-breaking`, `./extras/formatting.sh` (formatters absent on triager's box — genuinely falls to the fixer); **merge and ready-flip maintainer-gated, green CI explicitly not authorization.**

⚠️ Triager's `send_message` to the fixer was **gated** (fresh peer dispatch has no `in_reply_to`); text went via the `<message>` block channel instead, `send_file` succeeded normally.

## ⛔⛔ 2026-08-08 — THE PRODUCER ROOT CAUSE BELOW IS **RETRACTED**. Read this before any of it.

`slang-fixer` **implemented** the `createLegalPtrType` fix and **instrumented the arm**: it executes, it returns `Ptr<void>`, **and the abort still happens.** Refuted by construction, not by argument.

**CORRECTED MECHANISM (Main-verified at master `716ec597f`, all three legs):** the failing operand is the pointer **VALUE**, not its type. `legalizeLocalVar` (`:2212`) legalizes the **pointee** (`:2216`) → `none`; the `case simple:` fast path (`:2233`) is missed; control falls to `default:` (`:2247`) → `declareVars`, whose `case LegalType::Flavor::none:` (**`:3377`**) returns a bare `LegalVal()`. **The `var` legalizes to nothing, so fixing the pointer TYPE cannot help.**

⛔**ALSO RETRACTED: the entire allow-list-vs-deny-list ruling built on it** — the 2-of-26 arithmetic *as a decision input*, the 5-call-site blast radius, the test-cells note. That is the item the triager and I spent four exchanges refining and put to a maintainer. ⭐⭐**It was a well-verified answer to a question that turned out not to be this bug's question** — every figure in it was exact and the whole edifice was irrelevant.

⛔**AND: any advice to defer/hold #12304 on account of #12386 is retracted.** #12304 is `reviewDecision=APPROVED` (csyonghe, 2026-08-07T05:15:26Z), `mergedAt=null` — approval gate only. My comment had been live advice to hold an approved PR on a basis now measured wrong. Struck, with *"#12304 should not be held on account of this issue."*

**SURVIVES the retraction (each independently measured):** the wider trigger; `Generic` is the ordinary working shape (with its control); no `specializeAddressSpace*` for CUDA/CPP; **deliverable 1** (abort → diagnostic, independently justified by #10069); the attempted fix is harmless (`layout-conditional-field` 5/5, dynamic-dispatch 689/689, bugs 643/0); and explicitly *"the `createLegalPtrType` narrowness is real, it is just not this bug."* **The #12304 flip cell survives too and is still the guard's whole point.**

⭐⭐⭐**WHY THE WRONG MECHANISM SURVIVED FOUR EXCHANGES OF SCRUTINY — the source comment at `:990-991` was evidence about INTENT, not about THIS EXECUTION.** It said what that arm is *for*; it could never say the arm was *on the failing path*. **A plausible mechanism sitting exactly where the code's own comment points is the hardest kind to keep interrogating** — the comment reads as corroboration and is not.

⭐⭐⭐**AND THE CHEAP CHECK BOTH OF US SKIPPED FOR TWO DAYS: the assert prints its operand flavors.** `arg[0].flavor = 0 = none` states *"the value is nothing"* outright. We theorized about provenance without reading what the failing instruction was **holding**. ⇒ **Sharper form of the producer-check rule: before asking WHO produced the malformed shape, read WHICH thing is malformed.** My own contribution to the error was substituting a **type** observation for a **value** one — an IR dump showing `Ptr(%Empty)` sent me reasoning about which branch produces a `none` *type* when the assert held a `none` *value*.

⚠️**#12304 had 4 comments, not the 2 both of us asserted** (csyonghe 08-07T05:17:21Z on the `public`/`export` conflation, wanting `PublicDecoration` removed; a **sibling bot session** replied a minute later, 15 refs/12 files, sound, independently reaching the same `LayoutDecoration` residual). **Fixer and I each asserted that surface's state without reading it, a day apart** — cf. [[feedback_a_negative_existence_claim_decays_fastest_under_concurrency]].

**Guard `t-141e2a` prompt UPDATED 2026-08-08** to carry this retraction, because it would otherwise have handed a future session the dead root cause as live instruction. Verified after update: the only surviving mention of the ruling is the prohibition *"do NOT revive"*.

**Everything below this block is preserved for the derivation trail. It is NOT current.**

## ~~ROOT CAUSE CORRECTED 2026-08-06 ~07:42Z — the defect is at the PRODUCER~~ (SUPERSEDED 08-08, see above)

`slang-fixer` corrected the triage's causal framing; I verified all four cites at `9eb90c50a`:

- **`createLegalPtrType`, `slang-legalize-types.cpp:983-997`** — for a pointee that legalized to `none` it **already encodes the right answer**: return an untyped `Ptr<void>`, because a physical pointer holds an address regardless of whether its pointee has fields. Its own comment (`:990-991`) says so. But the `switch (ptrType->getAddressSpace())` handles **only** `case AddressSpace::UserPointer:` and `case AddressSpace::Global:`; anything else falls through to `return LegalType();` = none.
- **`getAddressSpace()`, `slang-ir.h:1600-1605`** — `return getOperandCount() > 2 ? (AddressSpace)operand2 : AddressSpace::Generic;` — a **silent default**, not an error.
- **`AddressSpace::Generic = 0x7fffffff`**, `slang-type-system-shared.h:121`.
- The compared operand is the compiler-generated `var`, whose `IRPtrType` carries **no** address-space operand ⇒ `Generic` ⇒ neither handled arm ⇒ pointer type collapses to `none` ⇒ the `Eql` reaches `default:` at `slang-ir-legalize-types.cpp:2197` and asserts.

⇒ **The assert at `:2197` is the SYMPTOM SITE, not the defect site.** The semantics of "what does `Ptr<T>` mean when `T` legalizes away" were **already decided** by that existing branch; only their **scope** was wrong.

⛔**So Approach B as I authorized it was wrong in a way that would have cost real work.** Triager's deliverable 2 ("decide what `Ptr<T>` means, then add coverage in `legalizeInst`") invented a maintainer semantics dependency **that did not exist**, and pointed an implementer at enumerating opcodes in a 28-opcode switch — i.e. teaching a **consumer** to tolerate a shape the **producer** should never have emitted. That is precisely the anti-pattern `CLAUDE.md`'s methodology names ("consumer-side patching", "interrogate the input shape"). **B RETRACTED**; triager struck it through on the public verdict (marked superseded, not deleted).

⭐**THE TRAP that sent both of us to the wrong layer:** the **surface** spelling `AddressSpace.Device` is `$((uint64_t)AddressSpace::UserPointer)` (`core.meta.slang:1394`) — a **handled** case — while the **IR** default is `Generic`, an **unhandled** one. Reasoning from the source spelling predicts the code works. ⇒ **Never infer an IR-level address space from the surface enum name; read `getAddressSpace()`'s default.**

That trap also yields the finding the reporter most needs: writing `Ptr<Empty, Access.ReadWrite, AddressSpace.Device>` **explicitly still aborts** ⇒ **no source-level workaround exists**, and that is simultaneously the proof the failing operand is the generated `var`, not the user's declared type.

**Main's addition — the fix's scope needs a decision, and "add `Generic`" is probably too narrow.** ⚠️**CORRECTED — `AddressSpace` has 26 members, not the "~15" I first wrote** (my list stopped at `StorageBuffer`; the tail is `PushConstant`, `RayPayloadKHR`, `IncomingRayPayload`, `CallableDataKHR`, `IncomingCallableData`, `HitObjectAttribute`, `HitAttribute`, `ShaderRecordBuffer`, `UniformConstant`, `Image`, `SpecializationConstant`, `NodePayloadAMDX`, `UserPointer`). Counted properly: `awk '/^enum class AddressSpace/,/^\};/' … | grep -cE '^\s+[A-Z][A-Za-z]*\s*(=|,)'` → **26**. So the allow-list is **2 of 26**, leaving ~23 latent, and the allow-vs-deny argument is STRONGER than I pitched it. `Generic` is at **`:122`** (`:121` is the enum's `{`). The comment's own rationale — *an address is an address regardless of pointee fields* — argues for a **default-allow** shape (untyped `Ptr<void>` for every space unless a specific space genuinely cannot represent one) rather than adding `Generic` as a third case label and leaving ~12 more latent. `createLegalPtrType` has **5 call sites** (`:1036`, `:1049`, `:1050`, `:1069`, `:1448`), so the blast radius is real and this is the ruling to get from a maintainer. **Coverage note (my figure, and the disagreement is unresolved — do not quote either number without re-deriving):** for the **qualified** spellings `AddressSpace.Device` / `AddressSpace::UserPointer`, `grep -rln` gives **1** file (`tests/language-feature/pointer/get-address-validation.slang`). Triager reported **3**, adding `tests/metal/pointer-no-lowering-groupshared.slang` and `tests/metal/pointer-in-buffer-ptr-to-struct.slang` — but I read both: their only hits are the bare word `UserPointer` **inside a `//` comment** (`:10` *"spaces (UserPointer, Input, Output)"*; `:6` *"address space UserPointer"*). Neither file contains executable code exercising the handled arms. ⇒ **3 is right for "files mentioning it", 1 is right for "tests exercising it", and only the second supports the conclusion.** Worse for the conclusion: even the 1 is `//DIAGNOSTIC_TEST … -target spirv` asserting *rejection* messages for `GroupShared`-vs-`Device` mismatches — so it does not exercise `createLegalPtrType`'s `UserPointer`/`Global` arm at all. ⭐**The honest statement is stronger than either count: the two handled arms have essentially NO test exercising them, on any target.** Shared conclusion (thin coverage behind a 2-of-26 allow-list) holds either way.

**Deliverable state after the correction:** ONE narrowed ruling (the scope of `createLegalPtrType`'s address-space arm), not two. Approach A (diagnostic at `:2197`) still stands as defence-in-depth at **MEDIUM** risk — `legalizeInst` is a free static shared by all three legalization contexts, the other two of which return `isSimpleType` false unconditionally (`:4081`, `:4116`) and so reach that arm more readily. `context->m_sink->diagnose(...)` has local precedent at `:870`, `:903`, `:912`, `:2069`, `:2374`.

**Public verdict `5201487089` patched twice in place** (5352 → 5703 → 8332 chars; comment count still **1**, never stacked, drift-checked before each patch, corrections marked and dated). Fixer has written **no code**; it is blocked on the one ruling. Triager directed the fixer NOT to post a second comment restating the same mechanism (avoiding two bot comments under one shared identity) — **Main endorsed; not reversing.**

**STATE: fixer working Approach A. RESUME = fixer [Fix Report] + PR number → triager refreshes cmt 5201487089 in place (it is last commenter) and forwards [Triage Resolution].**

**CO-TRIGGER (triager's, endorsed): if PR #12304 merges before this lands, the `public struct Empty` cell converts from "compiles" to "ICE" in the wild — deliverable A becomes more urgent than it looks today.** #12304 live state: OPEN, non-draft, head `8b9c0fa00e`, `reviewDecision REVIEW_REQUIRED`, `mergeStateStatus BLOCKED`, only review DISMISSED, labels `pr: non-breaking` + `Office-Yong`, untouched since 2026-07-31. See [[project_8125_empty_struct_cuda_infllight]].

**PENDING MAIN ACTION: dispatch #12384 as its own chain** (triager asked for it, agreed). Its triage may turn on *"is this already fixed by an open PR"* rather than *"what's the bug"* — #12304 is arguably its fix (the positive control above was exactly #12384's shape). Different family, different fix surface; must NOT piggyback on #12386's thread since both compete for the same `isSimpleType` territory.
