---
name: project-12192-e55215-constantbuffer-no-source-location
description: "#12192 ConstantBuffer IR source-provenance (loc-drop in buffer-element lowering) — FIX AUTHORIZED v2, needs IR-level regression; no PR yet"
metadata:
  node_type: memory
  type: project
  originSessionId: e9890b07-f14d-40cc-a265-9b3dcfd802ee
---

# #12192 — ConstantBuffer IR source-provenance preservation (orig. title: E55215 no valid source location)

**Status (2026-08-03):** FIX AUTHORIZED v2 — patch implemented, **held, NO PR pushed**. Blocked on writing the **IR-level regression** pdeayton specified. Fixer went dark ~6 days (07-28→08-03); chased. P3/diagnostics-quality. Labels: Diagnostics, spirv_vulkan. Owner: pdeayton-nv. Sibling: [[project_12191_e55215_postopkill_deadcode]].

⚠️ **This file was rewritten 08-03 to purge superseded layers.** Three claims that lived here and are now DEAD — do not resurrect: (a) "blocked on #12186 / can't test until it lands"; (b) "`-g2`/OpLine golden as the regression"; (c) "#12186 never introduced E55215, still aborts, so no consumer exists anywhere."

## The defect (stable, confirmed by source-read)

Frontend DOES stamp locs (slang-lower-to-ir.cpp:5133). ConstantBuffer's `.v` access is **re-synthesized loc-lessly** by **`deferStorageToLogicalCasts`** (`slang-ir-lower-buffer-element-type.cpp`, def :1194 / `traverseUses` :1213 @sha `d9353c09`) — it calls `setInsertBefore(user)` + `emitFieldAddress`/`emitLoad` with **no sourceLoc propagation**. NOT `materializeStorageToLogicalCastsImpl` (early-returns for a plain CB) and NOT `lowerMatrixAddresses` (matrix path) — see the resolved fix-site table below. Mechanism: `_maybeSetSourceLoc` (slang-ir.cpp:1825) reads the builder's loc **stack**, not the `setInsertBefore(user)` anchor → new insts get empty `sourceLoc`. StructuredBuffer's scalar load is never re-synthesized → keeps its loc (hence the original CB-vs-SB asymmetry). Sibling same-class defect: `processConstantBufferDescriptorHeapLoad` (slang-ir-spirv-legalize.cpp:1300 → new `emitLoadDescriptorFromHeap` :1329).

**Scope per maintainer = general IR source-provenance preservation**, NOT the E55215 symptom. Decoupled from #12186 entirely.

## Authorized fix + test contract (pdeayton, cmt 5110503770, 07-28)

> "proceed with the hygiene cleanup, but **don't use an OpLine/DebugLine golden** and **don't treat byte-identical SPIR-V as meaning the patch is effectless**. The contract to test is at the **IR level**: an instruction synthesized to replace a source-derived operation must retain the replaced operation's sourceLoc. Add a focused **pass-level/unit regression that inspects the post-pass IR directly** — `user->sourceLoc` for the per-use materialization and `loadInst->sourceLoc` for the descriptor-heap replacement. Frame the new PR as **IR source-provenance preservation** and **Fixes 12192**, without coupling it to 12186. If a direct IR test requires a broad harness change, **report that specific obstacle, but don't park solely because emitted SPIR-V is unchanged**."

- **Fix = Approach A (producer-side):** `IRBuilderSourceLocRAII(builder, user->sourceLoc)` (or copy `user->sourceLoc`) around the CB-access re-synthesis; mirror by copying `loadInst->sourceLoc` at slang-ir-spirv-legalize.cpp:1300.
- ✅**FIX SITE RESOLVED** — triager-adjudicated (it holds the clone; I do not) by mapping each disputed line to its **enclosing function definition** at sha `d9353c09006cb95a30a2bedd00a48372096cb760`. The six citations were **three different real functions**, not a drifting one:

| line(s) | enclosing function | verdict |
|---|---|---|
| **:1194** (def), **:1213** (`traverseUses`) | **`deferStorageToLogicalCasts`** | ✅ **THE site** — materializes the CB `.v` per-use access |
| :1940 (def), :2017, :2035 | `materializeStorageToLogicalCastsImpl` | real fn, ≠ deferStorage…; **early-returns for a plain CB** (`loweredType == originalType`) |
| :2244 (def), :2272 | `lowerMatrixAddresses` | real fn — the **matrix** path |

  `grep -n deferStorageToLogicalCasts` → definition only at :1194. So "**:1194/:1213 = deferStorageToLogicalCasts**" is correct; the earlier "**:2017/:2035 = deferStorageToLogicalCasts**" (07-28) was **wrong**.

- ✅**RESOLVED 08-03 (fixer's contemporaneous log): BOTH defects real, in sequence — neither substitutes for the other.**
  1. The originally-directed patch **was** mislocated (`materializeStorageToLogicalCastsImpl` + `lowerMatrixAddresses` only, NOT `deferStorageToLogicalCasts`) ⇒ the *first* byte-identical `-g2` result came from a patch that could not work and proves nothing about the layer. **Wrong-location = a genuine separate defect** (origin: triager's coordinates → my directive).
  2. Fixer found this **itself** on 07-28 via fprintf probes: `materializeStorageToLogicalCastsImpl` entered 3× for the CB shader but always hit the **early return before its `traverseUses`** ⇒ that RAII never executed for CB access.
  3. It then added the RAII at `deferStorageToLogicalCasts` and re-tested — **still byte-identical** — then reverted that exploratory edit (not in the directive then), which is why the diff inspected later looked :2035/:2272-only.
  ⇒ **OpLine/statement-marker explanation is independently established, NOT a red herring** — restored as a real finding, not a casualty. Wrong-location does not subsume it.
- ⚠️**CAVEAT — keep, do not smooth over (fixer volunteered this against its own interest):** step 3 was a `-g2` **textual diff + mechanism read**. It did **NOT** verify at IR level that the `deferStorageToLogicalCasts` RAII actually stamped the synthesized insts (`-dump-ir` doesn't print locs ⇒ no direct read available). So *"the fix sets the loc and SPIR-V still can't show it"* is **INFERRED for that site, not measured.** Mechanism makes it near-certain; it is not proven. **The blocked IR-level test is exactly the instrument that would measure it** ⇒ if pdeayton picks a seam, the per-site drill retires this caveat as a side effect.
- **Error provenance (settled between tiers):** the `:2035/:2272` coordinates originated in the **triager's** memo (it holds the clone and supplied them without checking the enclosing function); **I converted them into an actionable handoff directive** without requiring a durable handle. Triager also owns the `-g2` unsatisfiable-bar choice and the abort-string `#12186` inference. ⭐**My tier's lesson regardless of origin: never turn a second-hand line number into an instruction — demand function name + sha.** The fixer plausibly implemented what it was told at a site where it could not work ⇒ **the 6-day stall is NOT fixer fault.**

- 🚩**pdeayton named TWO assertion sites; site 2 is not reachable from the same test** (triager-verified, same sha). Site 2 (`loadInst->sourceLoc`, `processConstantBufferDescriptorHeapLoad`) lives in a **different pass** — dispatched from `legalizeSPIRV`/`legalizeIRForSPIRV`, not the pass a site-1 unit test invokes — and requires an `IRSPIRVLoadDescriptorFromHeap`, which a plain `ConstantBuffer<Data>` shader never produces. A single `total > 0` non-vacuity guard would **not** catch this ⇒ half the patch would ship untestable. Resolution (authorized): either give site 2 its **own per-site counter** with its own reachable input, or **scope the PR to site 1** and drop the site-2 edit + relay the harness obstacle to pdeayton (pre-authorized). Plus a **per-site revert drill** — a global drill can't distinguish "both sites work" from "site 1 works, site 2 untested."

- **Conventions adopted (chain-wide):** function name = durable handle; **every line number is paired with a sha**; no line numbers in GitHub comments to pdeayton unless confirmed at a named sha (triager owns public wording).
- **Regression = post-pass IR assertion.** Named obstacle (triager, 08-03): the `.slang` test harness asserts on **emitted output**, so a post-pass IR assertion likely wants a **C++ unit test under `tools/slang-unit-test/`**. If that plumbing is missing → report the specific obstacle to pdeayton (pre-authorized), don't go quiet.
- **PR:** title/body "IR source-provenance preservation", `Fixes #12192`, no #12186 coupling. Drafts-only, OP-gated. `report_pr_created` on open.

## Why the `-g2` golden was impossible (our miss, not his)

Approach A builds clean but emits **byte-identical SPIR-V at `-g1/-g2/-g3`** across every shape (verified by revert-drill). Reason: `DebugLine`/`OpLine` emit ONLY from explicit `kIROp_DebugLine` marker insts (slang-emit-spirv.cpp:4831), placed by frontend at **statement granularity** — function-body value insts never emit a DebugLine from their own `sourceLoc`. So loc-propagation changes no emitted output *by construction*. ⭐**Lesson: byte-identical output ≠ effectless — we measured at the wrong layer.** The `-g2`-golden requirement was OURS (my handoff directive), not pdeayton's.

## #12186 status — I WAS WRONG, he was right (corrected 08-03, posted)

Our public claim (cmt 5110128845) that #12186 "never introduced E55215 and still aborts via `SLANG_UNEXPECTED`" was **false**. Re-verified at head `107f158ffe`: the `SLANG_UNEXPECTED` at slang-emit-spirv.cpp:5292 is a **residual internal-invariant fallback** in the `CastDescriptorHandleToResource` switch, reachable only by a result type that is neither texture nor sampler. **Buffer handles never reach it** — they route via `kIROp_SPIRVLoadDescriptorFromHeap` (:5091) → `emitDescriptorHeapLoad` (:5105), which #12186's 4 added desc-handle tests assert. ⭐**Root error: grepped for the abort STRING instead of reading the dispatch ROUTING** — presence of an abort in a switch says nothing about whether your input reaches it. Correction posted on the issue. Does not affect #12192 (decoupled). ⇒ [[project_12185_bindless_texture_nv_desc_handle_nonimage]] any "#12186 introduces E55215" wording there is STALE.

## GitHub footprint (all live)

| cmt | what |
|---|---|
| 5052648390 | orig triage verdict → edited-in-place to parked → now superseded |
| 5054159599 | our "masked-on-master, no honest repro" clarifying question |
| 5109599120 | pdeayton: proceed as general source-loc hygiene |
| 5109630864 | our ack of hygiene framing |
| 5110128845 | our re-consult — **contains the false #12186-status claim**, corrected later |
| 5110503770 | pdeayton: IR-level test contract, don't park for unchanged SPIR-V (the operative directive) |
| 5169034444 | pdeayton: "is there a PR ready?" |
| 5169089988 | our honest answer: no PR; what's outstanding; harness obstacle named; + #12186 correction |

## State + resume

- **No PR, no remote branch** — verified 08-03 two ways: all 56 open `nv-slang-bot` PRs (both pages reconciled) have no #12192 reference; `git ls-remote --heads origin | grep 12192` empty. So nothing was lost upstream; the patch only ever existed in the fixer's local worktree `wt-slang-12192` (not inspectable by triager or me).
- **Likely cause of the 6-day silence:** the fixer's Fix Report **predates** cmt 5110503770, so it was probably holding for a park decision that had already been overruled. Triager relayed the verbatim override + chased for true state (its msg 45).
- **FIXER REPORTED 08-03 16:47Z (verified by name @sha `d9353c0900`):** diff touches **`deferStorageToLogicalCasts()`** (the real CB path) + `materializeStorageToLogicalCastsImpl()` + `lowerMatrixAddresses()`, 6 insertions, **site 1 only** ⇒ **no relocation needed**, correct site is covered (adjudication landed before push). IR test **calls the pass directly**, scoped to `computeMain`, with **per-op non-vacuity counters** (fixes the shared-`total>0` hole). **Site 2 DROPPED by the fixer un-prompted** as unreachable from a unit test, obstacle characterized ⇒ narrow well-tested change, nothing synthetic manufactured — matches my stated preference without being told.
- 🛑**BLOCKED 08-03 on a MAINTAINER BUILD-SURFACE DECISION — IR test compiles but CANNOT LINK.** Triager verified: `nm libslang.so | grep lowerBufferElementTypeToStorageType` → **`t` (local)**, `nm -D --defined-only` → **0**; same for `IRInst::getFirstChild` ⇒ undefined set is the whole IR-traversal surface + pass entry, not one stray symbol. Obstacle relayed to pdeayton = cmt **5169316548** (function names + sha only, no bare lines, explicit "revert drill has NOT been run" admission). Three options offered: (1) link `slang-common-objects`; (2) narrow export/test-shim seam; (3) **don't spend build surface on a P3 — hold until a pass-test seam lands for another reason.** Fixer told to stand by, NOT to improvise a shared-target change. **Nothing pushed; patch + test uncommitted on `fix/issue-12192` in fixer's worktree, resurrects either way.**
- **MY OWN READ of the tree (orch, 08-03, master @ raw — NOT from triager; corroborates + adds two facts):**
  - ✅**Recompile-a-TU precedent CONFIRMED and it is load-bearing**: `tools/CMakeLists.txt` already does exactly this for `slang-unit-test`, with a comment stating `isReproStateValid()` "is a free function in namespace Slang with no SLANG_API export annotation, so it is not visible from outside the DLL. The unit tests call it directly, so compile the .cpp again into this module **without publishing an internal validator as part of the stable public ABI**." ⇒ the *pattern* pdeayton is being asked about is already sanctioned in-tree; the objection is **scale** (1 leaf file vs ~14.9k lines of core TUs), not novelty. `slang-unit-test` is a `MODULE` linking `core compiler-core unit-test slang` PRIVATE.
  - 🔑**LINKAGE FACT the seam analysis omits — `deferStorageToLogicalCasts` is NOT a free function.** At :1194 it is an **indented member of `struct LoweredElementTypeContext`** (struct spans :460–:2389, file-local, no anon namespace). The only free function is the pass entry **`lowerBufferElementTypeToStorageType` at :2391, column 0, NOT `static`** (the `static` in this file is `getTypeLayoutRuleNameFromOpAlways` at :2400). No `-fvisibility` flag in root CMakeLists. ⇒ the entry is `t`/local from **default hidden visibility + no `SLANG_API`**, not internal linkage. A test cannot call the *member* `deferStorageToLogicalCasts` at all (file-local struct) ⇒ **the test must drive the pass entry and assert on resulting IR** (which is what the fixer's test does). ✅Both linkage readings confirmed by triager at the same sha.
  - ❌**"Export the one pass entry" = REJECTED FOURTH SEAM. Do not re-propose.** I gated it on caveat (a) — "does exporting that entry actually satisfy the link?" — and the answer is **no**. Every symbol in the undefined set is defined **out-of-line in a `.cpp`**, so the test TU cannot emit them and each *definition* needs exporting: `IRInst::getFirstChild` → slang-ir.cpp:**8863** (only *declared* at slang-ir.h:636); `getLastChild`/`getOperands`/`getDecorations`/`IRConstant::getStringSlice` → all out-of-line in slang-ir.cpp; `IRInstListBase::begin`/`end` → slang-ir.cpp:**229/233** + iterator `operator++`; `ComponentType::getTargetProgram` → slang-linkable.cpp:**1190**. ⭐**Lesson (fresh shape): my premises were all CORRECT and the inference still failed** — I verified the symbol I could see (the pass entry) and extrapolated to a set I hadn't checked. Inverse of [[project_11225_capability_target_incompat_slangpy_break]] (wrong premise → right conclusion). **The gate is what saved it**: had it gone to pdeayton as a fourth option it would have been `:2035/:2272` in a new costume — an unverified coordinate handed to a maintainer.
  - **Residue for whoever builds the seam:** it must cover IR-traversal **definitions in slang-ir.cpp**, not just a pass entry ⇒ only option 1 (link `slang-common-objects`) or a test-only "run pass P on module M" shim actually works.
  - ✅**Precedent framing landed in the public comment**: triager quoted the in-tree rationale verbatim and framed our objection as **scale, not novelty** ⇒ "we already do this" pre-empted.
- **RESUME:** triager reports once at Fix Report + PR#. Queued triager action at PR time: relay the site-2 harness obstacle to pdeayton + state the PR is **scoped to site 1**, so he isn't expecting both assertions he named. No unverified line numbers in that comment. If fixer unreachable / worktree gone → triager reports and I re-dispatch. **Do not let this go quiet again — pdeayton is actively asking.**
- Infra note: GraphQL 401 this session (REST fine) — `gh pr view` fails; use REST/git. See [[project_github_actions_graphql_401_outage]].

## Two points that lived only in the MEMORY.md index line (moved here 08-03)

- **❌ The 4th seam — "just export the one pass entry point" — is REJECTED.** It looks like the minimal fix,
  but all **7** other undefined symbols the test needs are out-of-line definitions in the `.cpp`, so
  exporting a single entry resolves one of eight. The three live options remain: link
  `slang-common-objects`, add a test-shim, or hold at P3.
- **⭐ Every premise TRUE, the inference still FALSE — I verified one member of a set and generalized to the
  set.** I checked that the pass entry was file-local and concluded the whole link surface behaved that way;
  the other symbols differ in kind (out-of-line `.cpp` definitions). What saved it was the gate — *"don't
  send it until it's confirmed to link"* — not the reasoning. A conjunction over a set needs the set
  enumerated, not a representative sampled. Cf. [[feedback_name_what_you_held_fixed]],
  [[feedback_mechanism_must_predict_observed_coordinates]].

