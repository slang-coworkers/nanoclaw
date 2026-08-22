---
name: project_12411_coopvec_bfloat16
description: "slang#12411 CoopVec BFloat16 (SM6.10 linalg) — triaged 08-06, comment 5209061497 (edited in place), type=Feature, NO fixer. RESUME on jkwak picking the CoopVec bound or saying 'make a PR' (Approach A only). Adjacent: 3 64-bit HLSL crashes = a DROPPED review finding on his own PR #10723."
metadata: 
  node_type: memory
  type: project
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# slang#12411 — BFloat16 as a CoopVec component type (hlsl-specs 0035, SM 6.10)

Filed by **jkwak-work** (maintainer, self-assigned) 2026-08-06. Triaged by `slang-triager`;
verdict posted as **fresh comment 5209061497** (0 prior comments ⇒ not an edit), issue **Type set
to `Feature`**, no labels. **No fixer dispatched** — deliberate, see the design call below.

Canonical thread: `gh-issue-shader-slang/slang-12411`.

## RESUME trigger — ⚡ now a SCHEDULED VENUE, not an open hold

**2026-08-06 21:56Z jkwak replied ([5209386138](https://github.com/shader-slang/slang/issues/12411#issuecomment-5209386138))
and proposed Approach B**: *"CoopMat takes `ICoopElement`… I think we should change the CoopVec to
take `ICoopElement`. I will discuss with @csyonghe about this before making a decision."* He then
applied label **`Office-Yong`** at 21:56:48Z — description *"To be discussed during Yong's office
hours"* (14 uses), i.e. **human-set routing to a scheduled slot**, not a triage label. Leave it alone.

`slang-triager` replied at **21:59:38Z — three minutes later, ahead of that discussion**
([5209403247](https://github.com/shader-slang/slang/issues/12411#issuecomment-5209403247), 2,719
chars, stacked 2→3 because the last commenter was human, never an edit). Every cell was **re-run live
immediately pre-post** rather than reused from session state, because it was going in front of a
maintainer pre-decision.

## ✅ 2026-08-21 — AUTHORIZED, DISPATCHED, PR1 BUILDING

jkwak authorized at 16:10Z (*"make a PR as discussed"*) **and** answered the free-function scope
question: **two `coopVecLoad` overloads** — one `__BuiltinArithmeticType`, one `ICoopElement`, NOT a
single relaxed bound. (I dropped the handoff ~6h; he chased at 22:30Z — see
[[feedback_a_verified_authorization_not_dispatched_is_a_dropped_handoff]].) Triager posted honest
status ([5376102291](https://github.com/shader-slang/slang/issues/12411#issuecomment-5376102291),
22:35Z) and dispatched `slang-fixer`. **PR1** (`fix/issue-12411`, worktree `wt-slang-12411`):
bound → `ICoopElement` + `IArithmetic` extension + the two `coopVecLoad` overloads; **debug build in
progress** as of 23:25Z. **Two PRs**: PR1 core-module (spelling-independent) first, PR2 the caveated
HLSL-only interpretation slice.

⛔ **CORRECTION to my own relayed brief — the SPIR-V/CUDA mapper-case instruction below was STALE and
is RETRACTED.** I relayed "don't ship the enum without SPIR-V (`:9920`) + CUDA (`:25`) mapper cases,
else `SLANG_UNEXPECTED`." The fixer flagged it wrong at HEAD; **I re-verified from source at
`6a009a7f9`** (not on the triager's say-so):
- **SPIR-V short-circuits BEFORE the mapper:** the `SLANG_SCALAR_TYPE_BFLOAT16` guard at
  `slang-emit-spirv.cpp:10000` fires `UnsupportedTargetIntrinsic`, emits `0`, and **returns** — the
  `mapSlangCoopVecComponentTypeToSpv` call at `:10010` is never reached. A BFloat16 case there is
  **dead code**, and no `Spv…BFloat16` component constant exists to map to anyway.
- **CUDA/OptiX diagnoses gracefully:** `getOptixCoopVecComponentTypeName` returns an **empty slice**
  at its `default` (`slang-emit-cuda.cpp:46`) and the caller diagnoses — no `SLANG_UNEXPECTED`, and
  no OptiX BFloat16 constant exists.
⇒ **BFloat16-as-coopvec-component is genuinely HLSL-SM6.10-only.** PR2 touches **only the HLSL path**.
The stale reading was the memo's `d7d59f374` state; the two mapper line numbers (`9920`/`25`) below
are from that era and no longer describe the guard structure. See
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]] — a 15-day-old file:line is a conclusion,
not a measurement, and this one shipped into a fixer brief before being re-checked.

**DXC spelling — interim decision (triager, greenlit):** proceed with the **proposal spelling
`BFloat16` = 23** in the caveated draft PR2, do NOT hold — the pinned DXC `v1.9.2602` (`21d28f727`)
will *never* validate it, so "wait for validation" has no bounded end; emit is a one-line swap if the
shipped spelling differs. Conditions: loud in-code flag citing the `F8_E4M3FN`→`F8_E4M3` precedent
([[feedback_a_spec_proposals_spelling_is_not_the_emission_authority]]) + PR2-body caveat; jkwak's
review is the real confirmation gate.

⚠️ **Watch: `report_pr_created` must fire when PR1/PR2 open** (fixer spine unreliable —
[[feedback_verify_report_pr_created]]); disk on the fixer's edge was at 99% / ~14G free at build
start, one debug build should fit but could block.

---
_Historical (pre-dispatch resume note; superseded above):_ RESUME was on the jkwak + @csyonghe
office-hours outcome; Approach A interpretation slice + new `tests/cooperative-vector/` coverage;
bound change not bundled.

⭐ **This was the one moment evidence changed an outcome** — he was reasoning from the half of the
precedent our measurements showed insufficient, and the gap reached him before the decision rather
than after. Latency mattered: comment → reply was 3 minutes.

⚠ `extras/formatting.sh` cannot run in the triager's container (gersemi / clang-format / prettier /
shfmt all absent) ⇒ whoever authors the PR must run it elsewhere.

## The one fact that reframes the issue: two separable axes

The issue presents three blockers as one feature. They are **two independent axes**:

- **Interpretation axis** (blockers 1 + 3): `CoopVecComponentType` values are *interpretation*
  operands — used for the matrix, the input vector, **and** the bias — lowered as constants.
- **Register axis** (blocker 2): `CoopVec<T,N>`'s `T` is the element type actually held in
  registers.

Nothing constrains the two to agree. The decisive measured cell:
`coopVecMatMul<float,4,4>(vec, ::Float16, matrix, 0, ::FloatE4M3, RowMajor, false, 4)` compiles
(exit 0) and emits `dx::linalg::ComponentType::F8_E4M3` — i.e. `FloatE4M3` works as an
*interpretation* while `CoopVec<FloatE4M3,4>` is rejected with the same `E38029` as BFloat16
(`FloatE5M2` likewise). ⇒ **blocker 2 is not BFloat16-specific**, and 1+3 can land alone.

⛔ **But separable ≠ out of scope.** `coopVecLoad<let N, T : __BuiltinArithmeticType>(buffer,
offset)` (`hlsl.meta.slang:32489`) takes **no interpretation parameter**, so the bound alone gates
it — and the issue names it explicitly. See
[[feedback_independence_of_two_axes_is_not_evidence_one_is_out_of_scope]].

## The maintainer design call — narrowed, deliberately NOT decided

`CoopVec<T : __BuiltinArithmeticType, let N : int> : IArray<T>, IArithmetic`
(`hlsl.meta.slang:30659`) vs `CoopMat<T : ICoopElement, ...>` (`:28262`).

`CoopMat<BFloat16,...>` is accepted **today** (exit 0; guilty control
`CoopMat<RWStructuredBuffer<float>,...>` → `E38029`, so the constraint is genuinely enforced) —
`BFloat16 : IFloatingPointCoopElement` (`core.meta.slang:1742`) which extends `ICoopElement`.

⭐ **The precedent's exact boundary, measured 08-06 (sharper than "partial"): `CoopMat : IArray<T>`
is its ONLY base** (`hlsl.meta.slang:28268`) — no `IArithmetic`, no `IComparable` — and it defines
**zero** `equals`/`lessThan` across its whole body (28268–29807; control: `CoopVec`'s body defines
**3**). `IArithmetic : IComparable` is confirmed at `core.meta.slang:140`. ⇒ **the precedent covers
element *eligibility* and never the behavioural contract `CoopVec` adds on top.** That is the clean
one-sentence statement of why jkwak's comparison is right yet insufficient.

⚠ **Partial precedent only.** `CoopVec` carries a stronger contract: its `add`/`sub`/`mul` use
whole-vector intrinsics, but its comparison methods do **per-element scalar ops on `T`**.
**`IComparable` requires THREE, and `CoopVec` implements all three** (enumerated from
`interface IComparable`, not recalled):

| method | at | scalar ops on `T` |
|---|---|---|
| `equals` | `:31127` | `this[i] != other[i]` (`:31131`) |
| `lessThan` | `:31145` | `<` / `>` (`:31149`/`:31153`) |
| **`lessThanOrEquals`** | **`:31167`** | `<` / `>` (`:31171`/`:31175`) |

`BFloat16` has none: `a != b`, `a < b`, `a + b` each fail `E39999 ambiguous call` (`half` control
clean). And `BFloat16` is **not in `FOREACH_BASE_TYPE`** (`slang-type-system-shared.h:64-82`, 16
entries), so it sits outside the generated conformance loop at `core.meta.slang:1135-1180` and cannot
inherit conformance the way `half` does.

⛔ **`lessThanOrEquals` was missed by BOTH tiers via the same regex hazard** — `lessThan` is a strict
**prefix** of it, so `\blessThan\b` and `/bool (equals|lessThan)\(/` both silently swallow it. My
"3" that surfaced the undercount was itself wrong (1 doc comment + 2 methods, right total, wrong
members, and blind to the disputed method). ⇒ **census interface implementations by enumerating what
the interface REQUIRES, then checking each**; print the census, never the total:
[[feedback_a_correct_total_from_a_wrong_composition_is_luck]].

⇒ **Consequence for the fix:** if the third option is chosen, the scalar-operator work must cover
**all three** `IComparable` methods, not just `!=` and `<`.

⇒ **Neither option is mechanical.** Narrowing the bound leaves `equals`/`lessThan` unsatisfiable;
general `__BuiltinArithmeticType` conformance needs arithmetic **and** comparisons supplied for a
non-BaseType struct. A **third** option was offered without picking: give `BFloat16` the missing
scalar operators first, which makes either bound viable. Whether FloatE4M3/E5M2 *should* become
element types as a side effect is also a human call.

## Open question 1 — answered, with the caveat that matters

hlsl-specs 0035 (raw fetch, 109,369 B) spells **`BFloat16`**, value **`= 23`** at three sites,
under `// BEGIN NEW FOR SM 6.10`; `ComponentTypeTraits<BFloat16>` = `{Type=uint,
IsNativeScalar=false, ElementsPerScalar=2}`.

⚠ **The DXC Slang pins does not have it yet** — `cmake/FetchDXC.cmake:49` pins `v1.9.2602`, whose
`DxilConstants.h:164` `ComponentType` ends at `F8_E5M2 = 22`; the vendored `dx/linalg.h` has **no
`ComponentType` enum at all**, only SM 6.9 `DATA_TYPE_*`. Slang's SM 6.10 spellings are
**hardcoded** (`slang-emit-hlsl-prelude.cpp:386-425` coopvec, `:305-345` coopmat), not read from a
header. ⇒ confirm the spelling against the DXC version Slang actually adopts, not the proposal:
[[feedback_a_spec_proposals_spelling_is_not_the_emission_authority]].

SM 6.9 genuinely **cannot** express bfloat16 (no `DATA_TYPE_*` enumerator) ⇒ jkwak's "keep
diagnosing at 6.9, gate on `sm_6_10`" is correct.

## Two pre-existing HLSL crashes adjacent to blocker 3 — BOTH are DROPPED REVIEW FINDINGS

⭐ **Filing framing (final): "two review findings raised pre-merge on jkwak's own two CoopVec/CoopMat
SM 6.10 PRs (#10723, #10711) and dropped with zero replies — one with the fix already spelled out."**
Both are his PRs, which is a further reason the offer-and-wait was right.


Neither is about BFloat16. The triager offered to file both and **did not file unilaterally** — the
offer is on the public record in comment 5209061497, so **jkwak's word is the gate**.

1. **THREE 64-bit enumerators crash HLSL emit at HEAD** — `Float64`, `SignedInt64`,
   `UnsignedInt64` — user-reachable, no new enumerator needed: `-target hlsl` at cs_6_9 **and**
   cs_6_10 → 255 `E99997 ... unexpected: Unsupported cooperative vector component type for HLSL
   emission` (controls `Float32`/`SignedInt32` → 0 at both). All three are in the Slang enum
   (`hlsl.meta.slang:32556`) **and** the SPIR-V mapper, but have **no case** in
   `getCoopVecComponentType_enum`. Independently source-confirmed on the orchestrator's clone: that
   switch has **12** `case SLANG_SCALAR_TYPE` labels (E4M3/E5M2/F16/F32/I8/I16/I32/U8/U16/U32; I8/U8
   twice, once in the packed switch), **0** matching `INT64|FLOAT64|BFLOAT16`, then `default:
   SLANG_UNEXPECTED` — while the SPIR-V mapper has **3** 64-bit cases. That asymmetry is what makes
   it a **regression**, not a never-supported type.

   ⛔ **It is NOT unfiled, and it is NOT a fresh discovery.** It was raised **pre-merge on the very
   PR that introduced the path** — jkwak-work's own **#10723** "Support CoopVec for SM 6.10 backend"
   — as inline review comment
   [3029202982](https://github.com/shader-slang/slang/pull/10723#discussion_r3029202982)
   (2026-04-02T16:55:08Z, `github-actions[bot]`, `slang-emit-hlsl.cpp`), titled *"🟡 Gap: 64-bit type
   cases removed without validation guard"*. It names all three types, notes they remain in the enum
   and the SPIR-V emitter, **predicts the exact abort** (*"an abort/crash rather than a diagnostic"*),
   and proposes two fixes (an earlier validation pass — preferred — or a named-limitation
   `SLANG_UNEXPECTED`). Merged 2026-04-03T01:31:43Z, **8.6h later, with 0 replies** (verified:
   replies to that id = 0; non-zero control = 20 inline comments on the PR). Live 4 months.

   ⇒ **Framing for any filing: "a review finding raised pre-merge on #10723 and dropped," covering
   all three 64-bit types** — materially more defensible than "we found a crash." Nothing was added
   to #10723 (its `updated_at` is still 2026-04-03) — a merged PR's review thread is the reviewer's
   surface, not triage's.

   ⚠ **Both tiers' dedup missed this, and the stated cause was wrong.** The decisive factor was the
   **`in:body` qualifier**, which excludes all comments — not vocabulary. A measured 2×2 shows the
   *paraphrase* finds #10723 once the qualifier is dropped, while the *exact compiler string* still
   misses with it kept: [[feedback_in_body_qualifier_silently_excludes_every_comment]].
2. **The CoopMat HLSL path diagnoses *then* asserts** — a 4th site the issue does not list.
   `getCoopMatComponentTypeName` (`prelude:337-341`) diagnoses
   `UnsupportedCoopMatElementTypeForHlsl` and returns `nullptr`, then
   `SLANG_RELEASE_ASSERT(componentType)` (`emit-hlsl.cpp:2034`) fires ⇒
   `CoopMat<BFloat16,...> -target hlsl` emits **both** `E55208` **and** `E99997 assert failure`.
   Control `CoopMat<half,...>` → 0, emits `ComponentType::F16`. **The fix for blocker 3 must not
   copy this shape** — it turns a user error into an internal error.

   ⛔ **Also NOT unfiled** — and **not merely "twice": the shape drew 15 top-level flags.** Full
   census at `?per_page=100` (verified complete: `page=2` → 0, `--paginate` → 69, two instruments):
   **15** top-level comments matching `SLANG_RELEASE_ASSERT` = **13** `github-actions[bot]` + **2**
   `coderabbitai[bot]`, across **7** distinct `original_commit_id`s, **8** on 04-01 / **7** on 04-02.
   Titles cluster on two shapes, so the honest characterization is **re-flagged on nearly every push
   for two days, not 15 independent findings** — which *strengthens* the dropped-finding framing.
   ⚠ **The count that must stay narrow: #10711 DOES have 4 replies** — all to `3029437946`
   (kaizhangNV ×2, jkwak-work) and `3029580550` (jkwak-work). **Zero to either cited id.** So *"merged
   with no reply on these threads"* holds; *"no replies on the PR"* would be false.

   The two specifically cited: inline comments **3024347842** (2026-04-01T20:01:09Z) and
   **3024476707** (20:28:22Z), both `slang-emit-hlsl.cpp`, `in_reply_to_id` null.

   ⛔ **INSTRUMENT TRAP that hid all of the above: the default page is 30.** A bare
   `gh api .../pulls/10711/comments` returns **30** — *exactly* the default page size — and 30 was
   published three times across three patches before a disagreeing figure (my 69) exposed it.
   ⇒ **always `per_page=100`; a count landing exactly on 30 or 100 is a truncation suspect, not a
   measurement.** Truncation hid the extra flags **and** the replies simultaneously. See
   [[feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal]] — this is that rule
   re-earned, and the concrete argument for exchanging **numbers, not conclusions**.
   Verified independently. The second **supplies the fix** and uses
   `CoopMat<BFloat16, MemoryScope.Subgroup, 16, 16, CoopMatMatrixUse.MatrixAccumulator>` on HLSL as
   its worked example — the same repro shape rediscovered 4 months later. It also notes
   `getCoopMatMatrixScopeName` has the identical shape two lines below (confirmed at
   `emit-hlsl.cpp:2038` — and `getCoopMatMatrixUseName` at `:2041` is a **third**), so
   Device/CrossDevice scopes crash the same way.

   ⚠ **One nuance to carry into any fix — the review comment's claim is subtly wrong, and its code
   is not directly transplantable:**
   - It says the assert makes the diagnostic *"unreachable by the user."* Measured behaviour is
     **both** `E55208` **and** `E99997` — the diagnostic *is* emitted, then an internal error is
     appended. Less severe than described, still wrong.
   - Its suggested `if (!componentType || !matrixScope || !matrixUse) return;` cites a precedent
     "already used in the cast emit path (line ~1589)". **The precedent is real** —
     `emit-hlsl.cpp:1579-1585` does exactly this — **but it returns `true`** from `bool
     tryEmitInstExprImpl` (`:1133`), whereas the crash site sits inside **`void
     emitSimpleTypeImpl`** (`:1832`), so it needs a bare `return`. Also the three helper calls
     *interleave* with their asserts (`:2030`/`:2034`, `:2037`/`:2038`, `:2040`/`:2041`), so a
     single combined guard requires hoisting all three calls above the first check.
     (Note the precedent's comment wording differs from the review comment's paraphrase — grepping
     the quoted text finds nothing; find precedents **by structure, not by string**.)
   - ⛔ **`matrixUse` does not belong in that guard — only TWO of the three helpers can return
     `nullptr`.** Census of `slang-emit-hlsl-prelude.cpp`: `getCoopMatComponentTypeName`
     (`diagnose` + `return nullptr`) and `getCoopMatMatrixScopeName` (same) — but
     **`getCoopMatMatrixUseName` (`:348`) has neither**; it `SLANG_UNEXPECTED`s on an unknown use
     value. **Structural, not incidental: its signature is
     `getCoopMatMatrixUseName(IRIntegerValue useVal)` (`slang-emit-hlsl.h:170`) — it takes no
     `DiagnosticSink`, so it cannot diagnose-then-return-null by construction.** ⇒ the review
     comment **overreached by including it**. Corrects my own earlier read ("comment named two, a
     third exists"): it is **"comment named three, only two qualify."**

⚠ Corrects a nuance in the issue: "CoopMat already supports bfloat16" is true for **SPIR-V/CUDA
only** (`tests/cooperative-matrix/bfloat16.slang` runs `-vk` + `-cuda`). **HLSL rejects BFloat16 on
both coop paths.**

## ⚠ A possible THIRD crash — UNVERIFIED, do not publish as a finding

Surfaced 08-06 from the #10711 flag census: the 15 top-level `SLANG_RELEASE_ASSERT` flags split
**8 / 7** into **two shapes**, and the 7-flag shape is a different site.
`coopMatMulAdd(..., saturatingAccumulation: true)` targeting HLSL hits a **bare
`SLANG_RELEASE_ASSERT`** at `slang-emit-hlsl.cpp:1601-1603` — **0** `diagnose` calls in that emit
block (non-zero control: 7 elsewhere in the file). If it holds, it is **worse in kind** than the two
known crashes, which at least emit `E55208` first. And `saturatingAccumulation` is a **documented
public parameter** of `coopMatMulAdd` (`hlsl.meta.slang:30140` doc, `:30155` signature), so the
reachability story is simply a user passing `true`.

⛔ **NOT established, for two named reasons:** (a) **no execution cell** — source-read only; (b) my
attempt to prove "no `saturating` diagnostic exists" had a **failed control** — the two known CoopMat
diagnostic names (`UnsupportedCoopMatElementTypeForHlsl`, `UnsupportedCoopMatScopeForHlsl`) are not
grep-findable in any definition file on my clone, only in `slang-emit-hlsl-prelude.cpp` and build
artifacts, so my zero was **uninterpretable, not a negative** (ANCHOR C: a control validates the
instrument, never the target). Dedup also incomplete.

Owed before it gets a number: one execution cell, a real dedup, and a check of **whether it is the
same site as the 7-flag shape or a genuinely separate one**. Nothing public was written about it.

## Coverage gap

`tests/cooperative-vector/` = 71 files, **0** mention BFloat16 (non-zero control: 12 mention
`Float16`). `FloatE4M3` appears in **0** of them either (non-zero control: `SignedInt8Packed` in
12) ⇒ the FP8 interpretations shipped without coop-vector tests, so a BFloat16 codegen test is new
ground for that directory.

## Provenance

Triage verified at master `d7d59f374` (jkwak's `ca76f8781` is an ancestor, 17 commits back; all
three cited line numbers unchanged) with ~20 measured compile cells, **each paired with a control**;
core-module freshness proven behaviourally *and* by an empty `git log` over `*.meta.slang` (non-zero
control: 30 such commits in 30 days). Must-fail sha control returned "Not a valid object name".
codex-critique ran 3 rounds (must-fix ×6 → ×3 → approve); round 1 caught the scope shrinkage above,
round 2 caught a fix applied to the flagged sentence while the Approaches section still carried the
superseded claim. Tree left clean, no build run.

Related: #8711 (original CoopVec/linalg HLSL syntax), #11613 (CoopMat missing SM 6.10 linalg fns),
#7077 (`VK_KHR_shader_bfloat16`), #10750 (BFloat16 test-coverage follow-up), #7078 (initial
bfloat16 support), [[project_12321_bfloat16_vector_vulkan_wrong_lanes]]. Not a duplicate — 4
enumerated dedup searches with controls.
</content>
</invoke>
