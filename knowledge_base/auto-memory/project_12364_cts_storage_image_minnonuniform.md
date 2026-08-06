---
name: project_12364_cts_storage_image_minnonuniform
description: "slang#12364 CTS storage_image_minNonUniform — CLOSED by jkwak-work 08-05 22:31Z as completed (label bug->regression, milestone Q3 2026, assignee jkwak). Won't-fix on the Slang side: Slang is NOT in this case's path, confirmed independently by his 4 local probes. His DRIVER-DELTA hypothesis refuted (CI: same GPU 0x26b1 + driver 0x950ec000 on the 0.0.7 PASS and 0.0.9 FAIL). MY PNG inferences BOTH RETRACTED: all-black is NOT raw-zero (normalization offset puts the zero crossing at ~1.684e8) and 0x08080808 is NOT dead but STRONGER (it reproduces both displayed reference values). WAIVER DISPOSITION ASKED, UNANSWERED."
metadata:
  node_type: memory
  type: project
  originSessionId: main-12364-triage
---

# slang#12364 — `dEQP-VK.descriptor_indexing.storage_image_minNonUniform` on VK-GL-CTS 0.0.9

Filed 2026-08-05T10:31:57Z by **jkiviluoto-nv**, label `bug`, 0 comments. Real, reproducible
single-test failure. Routed to `slang-triager`. ✅**CLOSED 11:32Z — triaged, verdict posted
(cmt `5191182483`), NO fixer: there is no Slang codegen change to make.** **THREE of the body's
claims are false** — two I caught before routing, a third (`the test was updated upstream`) the
triager caught, **which also refuted a work instruction I had given them.** ⚠️And **two of my own
supporting probes were defective** (a count that could not fail; a graft-clone pickaxe result) —
both retracted in place below. Read §RESOLVED before restating anything here.

## What IS established (measured, with controls)

- **Reproducible, deterministic, and NOT the SLANGWIN5 outage.** 3 independent 0.0.9 dispatch runs
  (`30985159061` 07:28, `30986576228` 07:50, `30995471440` 09:58 — all branch `ci/cts-009-*`,
  actor jkiviluoto-nv) fail this test with a **byte-identical** failure:
  `Image comparison failed: max difference = (1.34744e+08, 0, 0, 0), threshold = (0.02, …)`.
  The extracted SPIR-V is md5-identical across two of them (`dcd30021…`, 69 lines).
- **Cleanest evidence is the FULL-SUITE 0.0.9 run `30985159061`: `Passed 12396/13792`,
  `Failed 1/13792`, `Waived 1395` — and the ONE failure is this test** (`grep -c "  Fail ("` = 1,
  at log line 44477). A whole-suite run with exactly one red is a far stronger artifact than the
  single-case dispatches, and it is not in the issue body.
- **`dll-load` control is clean:** `grep -c "failed to load slang"` = **0** in every 0.0.9 run.
- **Waiver already landed** in shader-slang/VK-GL-CTS: commit `2ab0526b7a` 10:39:08Z, waiver.xml
  line 1414-1415, comment cites this issue number. So the nightly is unblocked; the issue is a
  pure fix-tracking item with no CI urgency.

## ⛔ REFUTED CLAIM 1 — the nightly attribution ("Fails: 0.0.9 + HEAD, all recent runs")

**master's nightly does not test 0.0.9 at all.** `.github/workflows/nightly-slang-vkglcts-test.yml`
on master pins `VK-GL-CTS_WithSlang-0.0.7-win64` in all 6 places (downloader `fileName`,
`Expand-Archive`, 4 dll copies, `working-directory`, `--deqp-archive-dir`). 0.0.9 exists **only on
the reporter's scratch branches** (`compare master...ci/cts-009-update` = the yml, +12/−12, a pure
0.0.7→0.0.9 string swap).

⇒ The "all recent runs" failing are the **scheduled nightlies**, which fail for the *unrelated*
`SLANGWIN5` dll-load outage: run `30986802858` (08-05 07:53) and `30889597224` (08-04) both show
`Failed 11545/13792`, `grep -c "failed to load slang"` = **11545**, and — decisively —
**`storage_image_minNonUniform` itself logs `Pass (Pass)` in BOTH**. The test the issue is about
passes in the runs the issue cites as failing.

⭐⭐⭐ **The A/B pair in the body is confounded on TWO axes at once.** It reads as
CTS-version-only, but `compare 14e5a0dc0e...871e77fb0f` (fail-head vs pass-head) = **ahead 1 /
behind 1**, different branches, different Slang builds. The version is *probably* the operative
variable (the yml patch is a pure version swap), but "0.0.7 passes / 0.0.9 fails at the same
Slang" is **not what was run**. See [[project_slangwin5_spirv_val_runner_defect]] — the same
runner, the same week, the same "failed on a run that used the box ≠ failed because of the box"
trap.

## ⛔ REFUTED CLAIM 2 — "Slang SPIR-V codegen for non-uniform storage image access"

The dumped SPIR-V in the failing log **is not Slang output**:

- It carries **`OpSource GLSL 450`** + `OpSourceExtension "GL_EXT_nonuniform_qualifier"`. Slang's
  emitter hardcodes `SpvSourceLanguageSlang` (`source/slang/slang-emit-spirv.cpp:12237`), degrading
  only to `SpvSourceLanguageUnknown` under `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` — **never to
  GLSL.** All 7 SPIR-V blocks extracted across the failing logs are `OpSource GLSL 450`.
- The program element is **`<SpirVAssemblySource>`** with only a `SpirVAssemblyTime` metric.
  ⛔**MY SUPPORTING COUNT IS RETRACTED — it was an instrument that could not fail** (triager-caught,
  Main-verified): I wrote "7 of 7 blocks, 0 `GLSLSource`/`HLSLSource`", but **`GLSLSource` IS NOT A
  qpa TAG AT ALL** (`grep -oiE "<[A-Za-z]*(Glsl|GLSL)[A-Za-z]*"` over the whole log = **nothing**),
  so that zero was guaranteed before I ran it. The denominator came from a
  `Get-Content TestResults.qpa -Tail 1000` step = the last **6** cases of a 13,792-test run, not the
  suite. And **2 of those cases are `ray_query.advanced.using_wrapper_function.*`, which are
  `glslSources.add`-built (36 vs 1 asm) yet STILL surface as `<SpirVAssemblySource>` ⇒ the tag does
  NOT imply "bypassed Slang"** — my premise was false in the very sample I drew it from. Anatomy:
  [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] §"Mechanism 3 —
  a second, sharper instance".
- **And the decoration the issue says is dropped is PRESENT:** `OpDecorate %41 NonUniform`, on the
  `OpImageTexelPointer` feeding `OpAtomicIAdd`, with `OpCapability ShaderNonUniform` +
  `StorageImageArrayNonUniformIndexing`.

⇒ ⭐⭐⭐ **The failure signature is on a shader whose NonUniform decoration is
already emitted — that is not the #12110 family's signature, which is a MISSING decoration.** The
titular symptom and the hypothesised cause point at different layers.
⛔⛔**MY 16:3xZ "SUPERSEDED" NOTE HERE WAS ITSELF WRONG IN BOTH DIRECTIONS — RETRACTED 22:5xZ
(triager-caught, Main-re-derived).** I decoded jkwak's PNGs correctly (**Result = 1 distinct value
`(0,0,0,255)`×4096**; Reference = 2 values) and then drew two unsupported conclusions from them:
- ❌ *"the atomic wrote NOTHING / total absence of output"* — **UNSUPPORTED.** The log's normalization
  has a **negative offset**: `p' = p × 7.42148e-09 − 1.25`, so the zero crossing is at
  `1.25 / 7.42148e-09 ≈ 168,430,017` ⇒ **every raw value from 0 to ~1.684e8 displays as black.** A
  uniformly black Result is equally consistent with no writes and with a huge range of non-zero values.
- ❌ *"`1.34744e+08` is simply `R_ref − 0` ⇒ the `0x08080808` lead is DEAD"* — **REFUTED, and it inverts:**
  inverting the normalization for displayed 223 gives raw ≈ **2.86e+08**, not 1.34744e+08. Meanwhile
  `0x11111111 − 0x09090909 = 0x12121212 − 0x0A0A0A0A = 134,744,072 = 0x08080808`, and those four raws
  display as **223 / 0 / 255 / 0** — i.e. the pattern **reproduces BOTH displayed reference values**, so
  it is *more* informative than the printed difference alone, not dead.
⇒ ⭐⭐⭐ **A NORMALIZED IMAGE SUPPORTS NO "the output was X" CLAIM UNTIL YOU COMPUTE WHAT MAPS TO
DISPLAYED ZERO.** I read `(0,0,0)` as "raw zero" without inspecting the transform printed two lines above
it in the same log. See §jkwak REPRODUCED for the full table and the ~1,001-pre-image caveat that still
applies (consistency, **not** an exact match).

⛔**MY OWN "next step" HERE WAS ALSO WRONG AND IS RETRACTED:** I told the triager to *"diff the
upstream CTS test between the 0.0.7 and 0.0.9 build commits — a changed reference is a live
candidate."* **There is no such change** — see §RESOLVED below. ⭐⭐**I inherited the issue's causal
premise while refuting two others in the same breath, and turned it into a work instruction.**
Refuting a claim does not audit the claims *adjacent* to it: I treated "the test was updated
upstream" as background because it was the one part of the body I had no reason to doubt — which is
exactly the condition under which nothing gets checked.

⚠️ **What I did NOT establish:** whether Slang is in this specific test's compile path at all.
`DISABLE_CTS_SLANG: 0` is set, and the Slang dlls are copied into the CTS dir, so Slang is
*available* — but a `SpirVAssemblySource`-only case with a GLSL-tagged module is consistent with
this particular case bypassing it. `search/code` over the fork returned 0 for both
`DISABLE_CTS_SLANG` and the framework file (indexing gap, not absence) so I could not read the
consumption site. **The fixer must answer "is Slang invoked for this case?" FIRST** — if it isn't,
the whole codegen framing is void and this is a CTS-fork/upstream item.

## Relation to the existing NonUniform family — SIBLING, NOT DUPLICATE

`[[project_12110_nonuniform_descriptorhandle_spirv]]` (#12110, PR #12116 open, non-draft) and
#12161 both concern **`NonUniformResourceIndex` / `NonUniform` being DROPPED on the
`DescriptorHandle<T>` / descriptor-heap path**. Here the decoration is **present** and the symptom
is a **zero/absent atomic result** (⛔not a "pixel mismatch" — see the correction above and §jkwak
REPRODUCED) on a plain `OpTypeRuntimeArray` of storage images — the path #6010/PR #6028
fixed in Jan 2025 and which #12110's memo records as working end-to-end. Dup search: 0 hits for
`storage_image_minNonUniform` and `descriptor_indexing`; the only open title match is #12161.
**Do not let a fixer merge this into #12110's scope** — a wrong-layer merge is the most likely bad
outcome here, precisely because the test name contains "NonUniform".

## ✅ RESOLVED 08-05 11:32Z — triage complete, verdict posted, NO fixer (Main-verified independently)

`slang-triager` answered the gating question and refuted a **third** claim. Verdict posted as a
**fresh** comment `5191182483` (nv-slang-bot[bot], 6221 B live, `comments_count=1` ⇒ not stacked).
Memo: `inbox/a2a-1785929664588-c9chfl/triage-12364.md` (218 lines).

**GATING QUESTION — ANSWERED: NO, Slang is not in this case's path, and it is a COMPILE-TIME fact.**
CTS dispatches by **C++ overload**: `SpirVAsmSource` → `assembleProgram` (`vkPrograms.cpp:871`),
which never calls the Slang hook (`vkShaderToSpirV.cpp:291`, reachable only via
`buildProgram(GlslSource|HlslSource)` at `:689`/`:779`). Confirmed on **both** execution paths —
runtime `vkResourceInterface.cpp:1027`, offline `vktBuildPrograms.cpp:331`. `minNonUniform` returns
early into `initAsmPrograms` (`vktDescriptorSetsIndexingTests.cpp:4410-4415`), and **the SPIR-V is a
hardcoded C++ string literal** (`:2662-2733`, incl. `OpSource GLSL 450` at `:2672` and the
`NonUniform` decorate at `:2686`). ⭐⭐⭐**Both of my refutation-2 observations collapse into ONE
fact — the asm is hand-authored — so the GLSL tag and the present decoration needed no compiler
explanation at all.** My two "independent" pillars were one fact seen twice; ⇒ **before calling
observations independent, ask whether a single upstream fact produces both.**

**My empirical argument was VALID BUT LOAD-BEARING ON AN UNCHECKED PREMISE:** the 11,545-dll-failure
nightlies where this test still passes only prove anything because **there is no silent glslang
fallback** — `TCU_THROW` at `vkPrograms.cpp:754`. Had a fallback existed the argument was void, and
I did not check. ⭐⭐**An "X was unavailable yet it worked" argument silently assumes NO FALLBACK —
name and verify the fallback path, or the inference is decoration.**

**⛔ REFUTED CLAIM 3 (the triager's, new) — "the test was updated in upstream Vulkan CTS between
0.0.7 and 0.0.9" is FALSE.** `compare 4899f2387afc...69aec690b1aa` = 8 commits, 4 files, **zero CTS
test code**. ✅**Main re-derived the decisive control independently:** test-file blob
`f2ee535a415ba7255dc7bf7b9ba6b50b7a28de3a` at **both** tags, with a **must-differ control** —
`vkShaderToSpirV_slang.cpp` = `176b5261…` → `5948cd7e…`. `fetch_sources.py` identical too (same
SPIRV-Tools/glslang pins). ⚠️Scoped correctly by them: **source** identity, not **binary** identity —
the two prebuilts were built 18 months apart, so a toolchain/artifact difference stays live.

**What 0.0.9 actually changes:** the `LoadLibraryA("slang.dll")` → `"slang-compiler.dll"` rename
(VK-GL-CTS PR #17). Slang renamed the lib in `dcb47b716`; the workflow copies only
`slang-compiler.dll`, never the forwarding shim (`source/slang/CMakeLists.txt:423`). ⇒ **0.0.9 is a
large net WIN — it fixes the 11,545-test-per-nightly outage — gated on this one waived test.** This
reframes the whole chain: the "regression" is the price of a fix.

### ⚠️ MY REFINEMENT to their DLL-rename story — necessary, but NOT sufficient, and the onset is UNEXPLAINED

They wrote *"0.0.7 + current workflow = 11,545 dll-load failures (the real nightly outage); 0.0.9
fixes it."* **The second half holds** (0.0.9 loads `slang-compiler.dll`, which the workflow *does*
copy; measured 0 failures in run `30985159061`). **The first half is stated as if deterministic, and
the 08-03 nightly refutes that reading.** Measured both nights:

| | 08-03 `30796282680` **PASS** | 08-04 `30889597224` **FAIL** |
|---|---|---|
| CTS artifact | `…0.0.7-win64.zip` | `…0.0.7-win64.zip` (same) |
| DLLs **built** | `slang-compiler.dll` … **and `slang.dll`** | byte-for-byte the same 8, incl. `slang.dll` |
| DLLs **copied** into CTS dir | compiler, glsl-module, glslang, test-server | **identical set** |
| `failed to load slang` | **0** | **11,545** |
| anchored `Z SLANG: ` lines | **3** — all `spawinAndWaitTestServerThread … succeded to launch server` | **23,090** (= 11,545 × 2), **zero test-server lines** |
| what the 2× IS | — | **ONE load attempt logged at TWO levels** (see below), **NOT two attempts** |

⇒ **Same artifact, same build outputs, same copy list, opposite outcome.** The rename (`dcb47b716`,
**2025-10-31** — nine months before onset) and the un-copied shim are a **latent** defect; something
else decided whether it *manifested*. The visible discriminator is the **test-server**: on 08-03
Slang compilation went **out-of-process** via a successfully-spawned `test-server.exe` (3 logger
lines, no in-process load attempt); on 08-04 it attempted the **in-process `LoadLibraryA("slang.dll")`**
11,545 times. **I did not establish why the path changed** — no build-config change exists in the
window (`compare 53b76e6d30...0864e60e63` = 7 commits, 97 files, the only cmake/workflow files are
`cmake-options-build*.yml`), so a self-hosted-runner state difference (persistent workspace, a
leftover pre-rename `slang.dll`, or test-server spawn failing) is the live candidate.

### ⛔ THE 2× MULTIPLE IS *NOT* "2 `LoadLibraryA` attempts per test" — corrected 08-05, source-verified

The triager asked me to carry into #12341 that *"23,090 = exactly 2× 11,545 … confirms the
in-process-fallback reading (2 `LoadLibraryA` attempts per test) rather than merely suggesting it."*
**The multiple is real; that reading of it is wrong**, and I checked before propagating it.

**Decomposed the 23,090 by message** (they are two *different* strings, not one string twice):

| message | count |
|---|---|
| `failed to load slang.dll` | **11,545** |
| `Failed to load SLANG DLL  InternalError (… vkPrograms.cpp:754)` | **11,545** |
| `spawinAndWaitTestServer*` | **0** |

`uniq -c` over the logger stream gives **23,090 runs of length 1** — i.e. the two messages strictly
alternate, one pair per test, and `failed to load slang.dll` **never** repeats back-to-back.

**Source confirms it is one attempt, logged at two levels** (0.0.7-era
`vkShaderToSpirV_slang.cpp` @`4899f2387afc`): `SetupSlangDLL()` (`:511`) opens with
**`if (!handle)`** and contains a *single* `LoadLibraryA("slang.dll")` (`:529`) logging
`failed to load slang.dll` (`:532`); its **caller** (`:1033`) logs
`Failed to load SLANG DLL` (`:1036`) on the returned `SLANG_FAIL`. So: **1 `LoadLibraryA` call →
2 log lines** (callee + caller). The second `LoadLibraryA` in the file (`:1211`) is a *different*
function and does not fire here.

⇒ ⭐⭐⭐ **An exact integer multiple feels like a mechanism because it is too clean to be chance — but
`2×` is equally consistent with "twice as many attempts" and "one event logged at two levels", and
those imply different defects.** The arithmetic cannot discriminate; only decomposing the counts *by
message* and reading the call path can. **Their phrasing upgraded it from "suggests" to "confirms",
which is exactly the wrong direction** — the multiple is the *weakest* part of the evidence, not the
part that firms it up.
⇒ ✅ **What the 2× DOES establish, and it is still useful: the in-process path was taken and failed
for every one of the 11,545 GLSL-compiling tests, with no partial success and no retry.** That is a
clean signature. It just says nothing about attempt *count*.
⇒ ⭐⭐ **This is the frequency-lesson they just filed, recurring one message later in the opposite
direction:** they attached an unearned *rate* to a verified mechanism; here an unearned *mechanism*
to a verified count. **A verified number lends credibility to whatever story is attached to it** —
same failure, axes swapped.

### ⚠️ THEIR 35/37 IS *DIRECTIONALLY RIGHT* BUT THE POPULATION IS TRUNCATED — same rename trap as #12351

They corrected their false "per nightly" rate using `workflows/304423283/runs?event=schedule` ⇒
`total_count` **37**, returned 37, **35 success / 2 failure**. ✅**I reproduced that exactly**, and the
conclusion (**latent, not standing**) is correct and now correctly published.

⛔**But 37 is not the population.** `workflows/304423283` was **created 2026-06-30T02:37:24Z** — and
its only commit is `cf5d225f8c` *"Rename CI and nightly workflow files (#11828)"*, with
`previous_filename` = **`.github/workflows/vk-gl-cts-nightly.yml`**. Querying the predecessor by
filename: **`total_count` 375**. The rename is **eight months AFTER** the `slang.dll` rename
(`dcb47b716`, 2025-10-31), so the id they queried **cannot cover the window where the latent defect
first became possible.** Measured in the immediate post-rename window (2025-10-31 → 2026-01-15) on
the predecessor: **69 success / 7 failure**.

⇒ ✅ **The verdict survives and strengthens** — across ~450 scheduled nightlies spanning the rename,
the overwhelming majority pass, so "latent, not standing" is *more* supported, not less. **This is
the benign direction**: their population error could only have *understated* the pass rate they were
arguing for.

#### ✅ RECONCILED 12:0xZ — their 220/17/5 vs my 69/7 was TWO DIFFERENT QUESTIONS, not a miscount

They re-measured and got **220 success / 17 failure / 5 cancelled** post-2025-10-31, ~3× my figure,
and correctly published theirs rather than mine. **Cause found on the first check, and it is MY
filter:** I bounded the window `created_at > "2025-10-31" AND < "2026-01-15"`; they used no upper
bound. Re-running both forms against the same 4 pages reproduces each exactly — mine 33+36=**69**
success / 1+6=**7** failure; theirs 85+99+36=**220** / 10+1+6=**17** / **5** cancelled. Both correct.
Their predecessor id **88963700** confirmed: `state: deleted`, `path: vk-gl-cts-nightly.yml`, created
2024-03-08 — i.e. the retired id this file's mechanism predicts.

⇒ ⭐⭐⭐ **This is the near-miss rule firing correctly for once:** *when your recomputation lands near a
peer's, test that YOUR FILTER DIFFERS before concluding their number is wrong.* One `select()` diff
settled it in a single call. Had I published "69/7, they're 3× off," I'd have been asserting a
miscount that never existed — and the numbers were close enough in *shape* (same direction, same
conclusion) to feel like corroboration-with-a-correction.
⚠️ **And my bounded window was the WORSE instrument for the claim being made:** the question is "is
the defect standing or latent," which wants **all** post-rename nightlies. An arbitrary
`< 2026-01-15` cutoff — I never justified it — silently answered a narrower question in the same
units. **A window you didn't justify is a claim you didn't make on purpose.**

#### ✅ THEIR "EXHAUSTED AND NEGATIVE" SEARCH WAS STRUCTURALLY UNABLE TO FIND IT — settled 12:0xZ

They then reported they could **not** locate the aperture producing my 69/7: *"3 populations × **412**
date boundaries ⇒ zero combinations"*, and correctly declined to invent a cause. **The gap is now
closed, and the answer is a property of their SEARCH SHAPE, not of either number.**

Measured on the cached full population (375 rows, all 4 pages):

| search shape | space | windows yielding 69/7 |
|---|---|---|
| **one-sided** (single cut: `> d` or `< d`) | 750 | **0** |
| **two-sided** (pair: `> lo AND < hi`) | 70,125 | **21** — and **my exact pair `("2025-10-31","2026-01-15")` is among them** |

My query was **two-sided**. Their enumeration walked **single boundaries** ("412 date boundaries"),
so *no* member of their search space could reproduce a two-sided filter — the target was not merely
missed, it was **unrepresentable**. `2026-01-15` *is* one of the 375 distinct run dates they
enumerated, so this is not a coverage gap in the date list; it is a **dimensionality** gap: they
searched a 1-D space for a 2-D object.

⇒ ⛔⭐⭐⭐ **"Exhausted and negative" is a claim about a SEARCH SPACE, and it is only as strong as that
space's ability to REPRESENT the thing sought.** An exhaustive sweep of the wrong dimensionality
returns a confident, well-quantified zero — 412 boundaries × 3 populations *sounds* like
overwhelming coverage, and it is, of a space the answer does not live in. Same family as the
`GLSLSource` probe (a null guaranteed by the schema) and their `.get()` near-miss: **a negative whose
impossibility is invisible from the result.**
⇒ ✅ **The cheap check that settles it: before reporting a negative search, ask what SHAPE the target
has and confirm one member of your space could produce it.** Here: "could any single cut-point ever
yield a bounded interval's count?" — no, and that is answerable without running anything.
⇒ ⭐⭐ **They did the right thing with the negative** (reported it unidentified, refused to
manufacture an exculpatory mechanism for another tier's number). **The defect is not the honesty; it
is that a well-conducted exhaustive search licensed "unidentified" when the correct verdict was
"my instrument cannot express this."** Cf. [[feedback_too_coarse_to_measure_is_a_claim_about_an_instrument]]
— an unfalsifiability verdict that reads as rigour.
⚠️ **My share: I never published the filter text.** I reported "69/7 post-2025-10-31" and omitted the
upper bound, so their search was working from a one-sided description of a two-sided query. **A count
without its predicate is not reproducible, and the reader will reconstruct the predicate you
described, not the one you ran.**

#### ⚠️ THEIR ±1 REFINEMENT IS RIGHT ON THE NUMBERS, BUT THE STATED CAUSE IS NOT WHY MINE RECONCILES

They flagged that my window gives **70/7 under inclusive endpoints**, reconciling to 69/7 only
half-open, and attributed it to *"a `success` run sitting on **each** endpoint … your `>`/`<` notation
was strict, so it does reconcile exactly."* ✅**All four of their date-level figures reproduce
exactly** (`lo<=d<=hi` 70/7 · `lo<=d<hi` 69/7 · `lo<d<=hi` 69/7 · both-exclusive 68/7), and there is
indeed one `success` run on each endpoint day.

⛔**But "my notation was strict, so it reconciles" is not the mechanism, and the reasoning it implies
is false.** A genuinely strict-on-both-sides reading gives **68/7**, not 69/7 — their own table says
so. What I ran compares a **full ISO timestamp against a bare date literal**, as strings:

```
"2025-10-31T07:06:05Z" > "2025-10-31"  → True    ⇒ lower endpoint INCLUDED
"2026-01-15T07:09:15Z" < "2026-01-15"  → False   ⇒ upper endpoint EXCLUDED
```

Because `YYYY-MM-DDThh…` shares a prefix with `YYYY-MM-DD` and is **longer**, it sorts *after* it.
⇒ **A predicate WRITTEN as symmetric-and-strict EXECUTES as `[lo, hi)` — half-open and asymmetric.**
The two endpoints behave differently under identical-looking operators. So mine lands on 69/7 not
because strictness matched, but because the string comparison silently supplied the half-openness;
had I intended strict-both I would have been off by one and never seen it.

⇒ ⭐⭐⭐ **Mixing granularities in a comparison (timestamp vs date) makes the *operator you wrote*
differ from the *interval you got*, and the error is exactly ±1 per endpoint — the size that reads as
a rounding disagreement rather than a bug.** Their conclusion (state the endpoint convention) is
right and worth keeping; the *reason* matters because the fix differs: **compare like-for-like
(truncate the timestamp, or make the literal a full timestamp) rather than trusting the operator to
mean what it looks like.**
⇒ ⭐⭐ **They were auditing my figure and reproduced it correctly while mis-attributing why** — the
same shape as *"reproducing a published figure does not reveal which QUERY produced it"* (#12351), one
level deeper: reproducing the figure *and* the endpoint sensitivity still did not reveal the
comparison's granularity. **Agreement on outputs is not agreement on semantics.**
✅Their practical point stands unaltered and I've adopted it: if someone re-derives this with inclusive
bounds and gets 70/7, **the gap has not reopened** — that is the endpoint convention, not a new defect.

#### ⭐ A CONTROL NEITHER OF US RAN, and it bears on whether the rename is even the variable

Pre-rename (`created_at < 2025-10-31`) on the predecessor id: **132 success / 1 failure / 0 cancelled**
(pages 3-4; pages 1-2 are all post-rename). So the comparison across the `dcb47b716` boundary is
**132-and-1 before vs 220-and-17 after** — the failure rate goes ~0.8% → ~7%, a real but *modest*
shift, on a population that keeps passing 93% of the time after the rename.
⇒ **That is consistent with "latent defect, occasionally triggered" and inconsistent with "the rename
broke the nightly"** — which is the stronger reading their original "costing 11,545 tests per nightly"
implied and which their patch already retracted. ✅Independent support for the corrected framing,
from data neither of us had looked at.
⚠️**Do NOT read the 17 post-rename failures as all being this signature** — they explicitly could not
check: the 2025-11 failures return `loadfail=0 spawn=0` because the **logs are HTTP 410 expired**, a
control that fails silently in the convenient direction. Onset stays **unexplained**.

⇒ ⛔⭐⭐⭐ **This is the EXACT trap already recorded in my own store from #12351, same commit
`cf5d225f8c`: "a RENAME MINTS A NEW WORKFLOW ID and retires the old one; query by FILENAME and follow
`previous_filename`."** It recurred **one day later, on the same repo, on a sibling workflow renamed
by the same commit** — and neither of us reached for it. ⭐⭐⭐**The store held the exact fact and the
exact remedy, and it did not fire, because it was filed under the INCIDENT (#12351 agentic-tests) and
not under the QUERY (`actions/workflows/<id>/runs`).** Same retrieval failure as the `ncl`-flags case:
*key an instrument fact to the command, not the incident.* ⇒ **Before quoting any `total_count` from
`workflows/<id>/runs`, check the workflow's `created_at` against the window you are claiming, and
resolve `previous_filename`.**
⚠️**And note what saved it: a `total_count`-equals-returned check PASSED (37 == 37) — completeness of
a population says nothing about whether it is the RIGHT population.** That is the #12351 lesson
verbatim, re-earned.

⭐⭐ **Why this matters beyond politeness: "0.0.9 fixes it" is safe, but "0.0.7 + this workflow always
fails" would predict an 08-03 failure that did not happen.** A necessary-condition story told in
sufficient-condition grammar reads as root-caused and stops the search for the trigger. The shim is
genuinely built (`source/slang/CMakeLists.txt:425`, gated on `SLANG_ENABLE_SLANG_PROXY`, default
`ON`, introduced `e7e482ba4` #11689) and genuinely never copied — that part is solid.

⛔ **AND A GRAFT TRAP I WALKED INTO GETTING HERE:** `git log -S SLANG_ENABLE_SLANG_PROXY` in my local
tree fingered `0864e60e6` — the exact head of the first failing nightly — which looked like a
smoking gun. **False.** The clone is shallow (`.git/shallow` present, `rev-list --count HEAD` = 8)
and `0864e60` is the **parentless graft root**, so `git show` renders the entire file as `+` lines
and any `-S` search "finds" every token in it. API check: `0864e60` touches **8 files, none of them
`CMakeLists.txt`**. ⇒ ⭐⭐⭐**In a shallow clone, EVERY pickaxe/blame/diff result at the graft root is
an artifact, and it arrives looking like causation because the root is usually the commit you were
already suspicious of.** Cross-check with `commits/<sha> --jq '.files'` before believing any local
history claim. Sibling: [[feedback_shallow_clone_makes_your_head_the_graft_root]].

**Sharpest remaining discriminator (theirs):** **5 sibling `*_minNonUniform` cases PASS in the same
run**, all from the same hand-written-asm generator and the same `NonUniform`/`RuntimeDescriptorArray`
machinery. `storage_image` is the only arm using `OpImageTexelPointer` + `OpAtomicIAdd` ⇒ specific to
the **atomic-on-storage-image texel pointer**, not to non-uniform indexing.

**Cause deliberately NOT isolated** — candidates stated as a set (0.0.9 binary's bundled
SPIRV-Tools build, build/flag differences, driver handling of the atomic, CTS runtime/recipe). ✅**The
right call: exclusion of direct Slang codegen is proven; naming a culprit would have been
unmeasured.** ⭐⭐**"Excluded X" and "identified Y" are different findings and the memo keeps them
apart** — the failure mode would have been "belongs to the driver, not Slang."

⚠️**Open thread I own: PR #12365** (jkiviluoto-nv, open, non-draft, `mergeable_state=behind`,
`closingIssuesReferences=[]` ⇒ will NOT auto-close this issue; flips the nightly to 0.0.9). **Its
body repeats the refuted "upstream test changed" premise.** Triager deliberately did not post there
(reporter's own PR; the #12364 comment it links carries the correction) and escalated the decision
to me. Also: the reporter was **mid-bisect on Slang commits** (`ci/cts-bisect-11667`,
`ci/cts-009-revert-12111`) — an axis that cannot discriminate here.

Deliberate non-actions, both stated publicly: **no `reproduced`/`not reproduced`** (needs
Windows+NVIDIA GPU+prebuilt binary — capability genuinely absent ⇒ apply neither) and **Type unset**
(convention split: #6466 CTS-failure=`Bug` vs #12327/#12145 CI-infra=`Testing`; and `Bug` would
contradict their own verdict) — asked the MEMBER to set it. `bug` label untouched.

### ✅ MY DECISION on the escalated PR #12365 question (08-05) — do NOT post; surfaced to the operator

Triager escalated: #12365's body repeats the refuted "the upstream Vulkan CTS test changed" premise.
**Decision: no bot comment on #12365.** Reasoning, so it can be re-derived rather than re-litigated:

1. **The PR's action is CORRECT and the defective premise does not affect it.** It flips the nightly
   to 0.0.9, which fixes an 11,545-test-per-night limb. The false premise is in a *parenthetical
   explaining why one test now fails* — it changes no line of the diff, no reviewer decision, and no
   merge criterion. **Correcting a premise that gates nothing is noise.**
2. **The correction already reaches the reader.** The PR body links #12364, whose top comment is our
   verdict carrying the refutation. A second write duplicates it onto a MEMBER's own PR.
3. **Closest-to-the-state says the issue, not the PR.** We hold the diagnosis; the diagnosis lives on
   the issue. Posting to both endpoints is the double-post pattern the CI-infra chain already
   recorded (`cmt 5062894889` on #12145 ⇒ EDIT in place, never re-POST).
4. ⚠️**What would flip this:** #12365 stalling *on this point*, a reviewer citing the premise as a
   reason to hold, or the reporter resuming the Slang-codegen bisect (which cannot discriminate —
   the case never invokes Slang). Any of those makes the premise load-bearing and worth one comment.

⭐⭐**The general rule I'm keeping: correct a published premise when it can CHANGE A DECISION, not
merely because it is false.** A refuted-but-inert claim on someone else's PR is the cheapest place to
spend credibility badly — and the pull toward posting comes from having just done the work to refute
it, not from anyone needing it.

## ⚠️ THE TWO HONEST LIMITS — carry these with any restatement of this chain

Both are easy to lose in a clean summary, and a clean summary is what a future reader will lift.

1. **The cause is UNIDENTIFIED, not resolved.** What is proven is **exclusion** of direct Slang SPIR-V
   codegen, not **attribution** to anything else. Live candidates stay a *set*: the 0.0.9 binary's bundled
   SPIRV-Tools build, build/flag differences between two artifacts 18 months apart, the driver's handling
   of an atomic on a non-uniformly-indexed storage image, CTS runtime/recipe differences. ⭐⭐**"Excluded X"
   and "identified Y" are different findings and must not be merged when the report gets shortened.**
2. **The `0x08080808` bit pattern is a WEAK clue, not a lead.** `max difference = 1.34744e+08` is
   *consistent with* 134,744,072 — but the log prints only **6 significant digits**, and **~1,001 integers
   (134,743,500–134,744,500) render as the identical displayed figure.** So the byte-replicated reading is
   **one pre-image among a thousand**. ⇒ ⭐⭐⭐**A round number matching a pretty bit pattern is a
   COINCIDENCE CANDIDATE until you count the pre-images** — and this is the natural next lead precisely
   because it *looks* like a fingerprint, which is why the caveat has to travel with it.

⭐ **Why these are recorded here rather than left in the message:** the triager named them as the limits
most likely to be lost, and the sharpest form of that risk is **a downstream reader inheriting the
confident half.** Same failure this chain hit repeatedly (a refuted detail inside a correct report; a
retracted claim surviving in a peer's later evidence). The strongest single fact remains the discriminator
— **5 sibling `*_minNonUniform` cases pass in the same run**, so whatever this is, it is specific to the
`OpImageTexelPointer` + `OpAtomicIAdd` arm.

## 🟢 2026-08-05 ~16:3xZ — jkwak-work REPRODUCED LOCALLY and proposes WONT-FIX. Verdict CONFIRMED; his CAUSE HYPOTHESIS REFUTED by CI data he did not have

**Inbound** [cmt 5198139511](https://github.com/shader-slang/slang/issues/12364#issuecomment-5198139511),
jkwak-work (MEMBER): reproduced on his own box (RTX 3090, driver `0x988f8000`), traced the shader to
`initAsmPrograms`, and proposes **close as won't-fix, keep the waiver**, venue = driver report or upstream CTS.

✅ **His routing verdict INDEPENDENTLY CONFIRMS ours, and his four empirical probes are the experiment we
could not run** (no Windows/GPU/prebuilt binary here): deleted `slang-compiler.dll` outright → identical
failure, no load error; `SLANG_DLL_PATH_OVERRIDE` at a nonexistent dir → identical; in-process server mode
→ identical; **and no `test.slang.comp` is ever written** — the glue writes every shader it is handed
before compiling. That last one is a *positive* control on the negative claim, which is stronger than our
structural argument. He also reports the other five `*_minNonUniform` variants pass locally, matching our
sibling-discriminator.

### 🔬 THE ARTIFACT WE NEVER HAD — decoded his embedded PNGs (both 64×64 RGBA)

| image | distinct pixel values | content |
|---|---|---|
| **Result** | **1** | `(0,0,0,255)` × **4096** (all-black **as DISPLAYED**, not raw-zero — see below) |
| **Reference** | 2 | `(223,0,0,255)` × 2912 + `(255,0,0,255)` × 1184 |

⛔⛔ **MY TWO CONCLUSIONS FROM THIS DECODE WERE BOTH WRONG — retracted 22:5xZ, triager-caught,
Main-re-derived from the log's own normalization.** The decode reproduces exactly; the inferences do not.

**The transform was printed two lines above the images in the same log and I did not use it:**
`p' = p × 7.42148e-09 − 1.25`. **Negative offset ⇒ zero crossing at `1.25/7.42148e-09 ≈ 168,430,017`.**

- ❌ *"the atomic wrote NOTHING / total absence of output"* → **every raw value 0 … ~1.684e8 displays as
  black.** All-black is consistent with no writes **and** with a vast range of non-zero values. The PNG
  cannot distinguish them. ⇒ ⭐⭐⭐ **A NORMALIZED IMAGE SUPPORTS NO "the output was X" CLAIM UNTIL YOU
  COMPUTE WHAT MAPS TO DISPLAYED ZERO.**
- ❌ *"`1.34744e+08` = `R_ref − 0` ⇒ `0x08080808` is DEAD"* → **refuted, and it INVERTS.** Inverting for
  displayed 223 gives raw ∈ [286,264,977 … 286,793,385) ≈ **2.86e+08**, nowhere near 1.34744e+08. And
  running the normalization forward on the byte-replicated family (Main-verified):

  | raw | displayed |
  |---|---|
  | `0x09090909` = 151,587,081 | **0** |
  | `0x0A0A0A0A` = 168,430,090 | **0** |
  | `0x11111111` = 286,331,153 | **223** |
  | `0x12121212` = 303,174,162 | **255** |

  with `0x11111111 − 0x09090909 = 0x12121212 − 0x0A0A0A0A = 134,744,072 = 0x08080808` → prints
  `1.34744e+08`. ⇒ **The pattern reproduces BOTH displayed reference values, so it is MORE informative
  than the printed difference alone — I tried to retire the one lead the images actually support.**
  ⚠️ Still **consistency, not identification**: ~1,001 integers render as `1.34744e+08` (0x08080808 is
  134,744,072 vs the printed 134,744,000 — off by 72), displayed 255 is saturated so larger equal-step
  pairs also fit, and the PNGs establish no pixel correspondence. **Raw buffers, or a pre-normalization
  dump, would settle it.** No mechanism assigned.

⭐⭐ **The triager over-corrected in the opposite direction first** (weak-clue → nearly-retracted →
"exact"), contradicting its own earlier ~1,001 measurement, and caught it pre-publication. ⇒ **Over-correcting
a hedge is the same defect as the overclaim; the stable move is to compute the quantization threshold ONCE
and state what it does and does not determine.**

### ⛔ HIS CAUSE HYPOTHESIS IS REFUTED — "most likely the driver version on the runner at each run"

He proposes the environment/driver as the remaining variable, explicitly *"worth confirming before we spend
more time on it."* **Confirmed, and it does not hold in CI.** Re-fetched both runs and read the device
block:

| run | CTS | verdict | deviceName | deviceID | driverVersion | apiVersion |
|---|---|---|---|---|---|---|
| `30997089246` | **0.0.7** (archive-dir verified) | **Pass** | RTX 6000 Ada | `0x26b1` | **`0x950ec000`** | 1.4.329 |
| `30985159061` | **0.0.9** | **Fail** | RTX 6000 Ada | `0x26b1` | **`0x950ec000`** | 1.4.329 |

**Same GPU, same driver, same `SLANGWIN5` runner, opposite outcomes.** ⇒ **The driver cannot be the CI
variable.** ✅Control that the probe discriminates: his local box reads `0x2204` / `0x988f8000` — different
device *and* driver, so the field is not a constant we are reading blind.
⚠️ **Scope, precisely:** this refutes *driver-version-across-the-two-CI-runs*. It does **not** exclude
driver *behaviour* as the mechanism — one driver mishandling this SPIR-V is fully consistent with both
CI runs failing on the *same* driver. What is excluded is **a driver CHANGE explaining the 0.0.7/0.0.9
delta.** Since the test file is byte-identical between tags (he re-derived our finding) and Slang is out of
the path, **the delta remains unexplained** — the live candidate is the difference between the two prebuilt
binaries (bundled SPIRV-Tools/glslang build, flags), which he did not address.

### Disposition

**Won't-fix is right on the Slang side** and we should say so plainly — his evidence is stronger than ours.
But the closure needs two corrections routed to him: **(1) the driver-delta hypothesis is refuted by his
own CI, with the table above; (2) the failure is a ZERO result, not a value mismatch**, which changes what
a driver report should say. Also: **closing #12364 while keeping the waiver INVERTS his own earlier
instruction** (cmt `5194000311`: revert the waiver when resolved) — that tension is his to resolve, and it
must be surfaced, not silently absorbed. Routed to `slang-triager`.

## 🔴 REOPENED 2026-08-05 15:47Z — jkwak-work (MEMBER) adds a REVERT OBLIGATION, and my own trigger missed it

**Inbound:** `issue_comment` [5194000311](https://github.com/shader-slang/slang/issues/12364#issuecomment-5194000311)
— *"When this is resolved, the following comment needs to be reverted: …/VK-GL-CTS/commit/2ab0526b7a…"*
(he wrote "comment", linked a **commit**; intent unambiguous).

✅ **Verified before routing:** commit `2ab0526b7a` (Janne Kiviluoto, 10:39:08Z) touches **one file**,
`test-lists/slang-waiver-tests.xml`, **+3/−0** — the `<t>` entry plus its two issue-link markers. The ask
is a **clean, self-contained 3-line revert**, already delimited by `<!-- … 12364 -->` /
`<!-- end … 12364 -->` fences. Nothing else rides on it.

⛔⭐⭐⭐ **MY v3 RESUME TRIGGER DOES NOT STRICTLY FIRE ON THIS — a THIRD failure mode, after never-fires
and always-fires.** Clause 3 wanted *"changes a load-bearing input … or the waiver being reverted."* This
comment reverts nothing, touches no diagnosis, answers no open question. A literal read leaves the chain
closed — **wrongly**, because it **changes the DEFINITION OF DONE**: resolving #12364 now entails a revert
in a *different repository*.
⇒ ⭐⭐⭐ **I scoped the predicate to "changes the ANSWER" and it was blind to "changes the OBLIGATION."** A
trigger can be correctly selective (not always-fires), correctly satisfiable (not never-fires), and still
**miss a whole category of inbound**. ⇒ **Resume predicates need a scope/definition-of-done clause, not
only evidential ones** — a maintainer adding a cleanup requirement is the commonest such inbound and the
easiest to silently no-op on.
⇒ ⚠️ **Near-miss of this store's #11616 shape:** an obligation whose only record is a GitHub comment on a
chain everyone treats as closed **goes dark**. Not tracked by the waiver file (its fences say *what*, not
*when*), not by #12365, and absent from this memo until now.

**Disposition:** nothing to DO yet — the revert is conditioned on resolution, and the cause is
deliberately unidentified (exclusion proven, attribution not). The obligation must simply **survive**.
Routed to `slang-triager` (closest-to-the-state: they own the verdict comment and the 363-line memo) to
fold it into their definition-of-done and acknowledge on GitHub so jkwak sees it landed.
⚠️ **NOT a continuation of the converged meta-exchange both sides stopped** — a new human inbound is new
work, categorically distinct. Per [[feedback_stop_a_converged_exchange_the_yield_curve_bends]], the stop
rule governs *echoes*, never *new inputs*.

## RESUME (v4 — amended 08-05 for the obligation axis)

Fires if **any** of:
- **A. Evidential** (all three, per v3): non-bot author · addressed to us/the diagnosis, not the reporter ·
  changes a load-bearing input (an answer on "is Slang in this case's path", a single-SHA CTS A/B, a fix
  PR, the waiver actually being reverted).
- **B. ⭐ NEW — Scope / definition-of-done:** a non-bot participant adds, removes, or alters an obligation
  attached to resolution, **even when the diagnosis is untouched**. **jkwak's revert requirement is the
  founding instance.**
- **C. Terminal:** the issue closes, or master's nightly is bumped to 0.0.9 (making this a live CI blocker
  rather than a tracked fix).
- **D. ⭐⭐⭐ CATCH-ALL, and it OUTRANKS A–C: any fresh substantive comment from a non-bot participant.**
  Added 08-05 after the triager pointed out the gap: **A–C are all enumerations, and an enumeration is
  blind to the category you did not think of.** Their own trigger had five answer-scoped clauses that all
  missed jkwak's obligation comment — **but their broad human-comment catch-all DID fire**, which is why
  they weren't blind while their specific clauses were.
  ⇒ ⭐⭐⭐ **A catch-all is NOT redundancy against the specific clauses; it is the coverage for the
  categories you have not enumerated.** ⇒ ⛔ **Do NOT tighten D after adding a more specific clause** —
  that instinct is exactly backwards, and it is strongest right after a B-type clause makes the specific
  set feel complete. **Every clause added to A–C should make D feel MORE necessary, not less.**

**Definition of done now includes:** revert `2ab0526b7a` in shader-slang/VK-GL-CTS (3 lines, fenced) —
**or**, if the waiver should persist, say so explicitly to jkwak rather than letting it lapse silently.

## RESUME (v3 — superseded by v4, kept for the trigger-evolution record)

Fires only if **all** hold (a state predicate on comments alone would be always-fires — see
#12110's twice-broken trigger):
1. non-bot author, **and**
2. addressed to us / the diagnosis, not to the reporter, **and**
3. it changes a load-bearing input — an answer on "is Slang in this case's path", a CTS-version
   A/B run at **one** Slang SHA, a fix PR, or the waiver being reverted.

Or: the issue closes, or master's nightly is bumped to 0.0.9 (which would make this a live CI
blocker rather than a tracked fix).
