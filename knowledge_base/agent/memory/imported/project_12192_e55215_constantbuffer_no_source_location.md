---
name: project-12192-e55215-constantbuffer-no-source-location
description: "#12192 ConstantBuffer IR source-provenance (loc-drop in deferStorageToLogicalCasts) — fix + IR-level test exist locally, NO PR; parked since 08-03 on pdeayton's build-surface decision (IR test cannot link: internal symbols hidden). Issue still open, no reply as of 10-02."
metadata:
  node_type: memory
  type: project
  originSessionId: e9890b07-f14d-40cc-a265-9b3dcfd802ee
---

# #12192 — ConstantBuffer IR source-provenance preservation

Issue title: *"spvBindlessTextureNV: E55215 for ConstantBuffer DescriptorHandle has no valid source
location"*. P3 / diagnostics quality; labels Diagnostics, spirv_vulkan; owner **pdeayton-nv**.
Sibling: [[project_12191_e55215_postopkill_deadcode]].

## Status

**Parked on a maintainer decision since 2026-08-03; issue still open, no reply as of 2026-10-02**
(last activity 08-03T16:56Z). Patch + IR test are uncommitted on `fix/issue-12192` in the fixer's
worktree `wt-slang-12192`; no PR, no remote branch. #12186 (the #12185 fix) merged/closed 09-02 and
was always decoupled from this issue.

Dead claims — do not resurrect: "blocked on #12186"; "a `-g2`/OpLine golden is the regression";
"#12186 never introduced E55215 and still aborts".

## The defect

The frontend stamps locs (`slang-lower-to-ir.cpp`), but ConstantBuffer's `.v` access is
re-synthesized loc-lessly by **`deferStorageToLogicalCasts`** (a member of file-local
`struct LoweredElementTypeContext` in `slang-ir-lower-buffer-element-type.cpp`, def :1194 /
`traverseUses` :1213 @ `d9353c09`). It calls `setInsertBefore(user)` + `emitFieldAddress`/`emitLoad`,
and `_maybeSetSourceLoc` (`slang-ir.cpp`) reads the builder's loc **stack**, not the insert anchor ⇒
empty `sourceLoc`. StructuredBuffer's scalar load is never re-synthesized, hence the CB-vs-SB
asymmetry. Not the site: `materializeStorageToLogicalCastsImpl` (early-returns for a plain CB) or
`lowerMatrixAddresses` (matrix path). Same-class sibling: `processConstantBufferDescriptorHeapLoad`
(`slang-ir-spirv-legalize.cpp`) → `emitLoadDescriptorFromHeap`.

## Authorized fix + test contract (pdeayton, cmt 5110503770, 07-28)

> "proceed with the hygiene cleanup, but **don't use an OpLine/DebugLine golden** and **don't treat
> byte-identical SPIR-V as meaning the patch is effectless**. The contract to test is at the **IR
> level**: an instruction synthesized to replace a source-derived operation must retain the replaced
> operation's sourceLoc. … Frame the new PR as **IR source-provenance preservation** and **Fixes
> 12192**, without coupling it to 12186. If a direct IR test requires a broad harness change,
> **report that specific obstacle, but don't park solely because emitted SPIR-V is unchanged**."

- **Fix (producer-side):** `IRBuilderSourceLocRAII(builder, user->sourceLoc)` around the re-synthesis.
  Fixer's diff (verified 08-03 @ `d9353c0900`): 6 insertions in `deferStorageToLogicalCasts` +
  `materializeStorageToLogicalCastsImpl` + `lowerMatrixAddresses`, **site 1 only**.
- **Site 2 dropped** (fixer, un-prompted): the descriptor-heap replacement lives in a different pass
  (`legalizeSPIRV`) and needs an `IRSPIRVLoadDescriptorFromHeap`, which a plain `ConstantBuffer<Data>`
  never produces. At PR time, tell pdeayton the PR is scoped to site 1 and why.
- **Test:** C++ unit test that drives the pass entry on `computeMain` and asserts on post-pass IR,
  with per-op non-vacuity counters (a shared `total > 0` would hide an untested site).
- **Why SPIR-V can't show it:** `DebugLine`/`OpLine` come only from explicit `kIROp_DebugLine` marker
  insts placed at statement granularity (`slang-emit-spirv.cpp`); value insts never emit a line from
  their own `sourceLoc`, so the fix is byte-identical at `-g1/-g2/-g3` by construction. ⚠️That the RAII
  actually stamps the synthesized insts is **inferred, not measured** (`-dump-ir` doesn't print locs);
  the IR test is the instrument that would retire this caveat.

## The blocker — the IR test compiles but cannot link

`nm libslang.so`: `lowerBufferElementTypeToStorageType` is `t` (local, default-hidden visibility, no
`SLANG_API`), and so is the whole IR-traversal surface the test needs — `IRInst::getFirstChild` /
`getLastChild` / `getOperands` / `getDecorations`, `IRConstant::getStringSlice`,
`IRInstListBase::begin`/`end` + iterator `operator++` (all out-of-line in `slang-ir.cpp`), and
`ComponentType::getTargetProgram` (`slang-linkable.cpp`). Relayed to pdeayton as cmt **5169316548**
(function names + sha, revert drill admitted not run) with three options:

1. link `slang-common-objects` into the test;
2. a narrow test-only "run pass P on module M" shim/export seam;
3. hold until a pass-test seam lands for another reason (don't spend build surface on a P3).

**Rejected — do not re-propose:** "export just the pass entry" — it resolves one of eight undefined
symbols. Precedent for option 1's pattern exists: `tools/CMakeLists.txt` recompiles a `.cpp` into
`slang-unit-test` for `isReproStateValid()` "without publishing an internal validator as part of the
stable public ABI" — so the objection is **scale** (one leaf file vs ~14.9k lines of core TUs), not
novelty.

**Resume:** on a pdeayton reply picking a seam, re-dispatch the fixer on
`gh-issue-shader-slang/slang-12192`; open the PR as drafts-only, title "IR source-provenance
preservation", `Fixes #12192`, `report_pr_created` on open. No unverified line numbers in public
comments. If the worktree is gone, the fix is 6 lines + one test and resurrects from this note.

## GitHub footprint

| cmt | what |
|---|---|
| 5109599120 | pdeayton: proceed as general source-loc hygiene |
| 5110128845 | our re-consult — contains the false #12186 claim (corrected in 5169089988) |
| 5110503770 | pdeayton: IR-level test contract (operative directive) |
| 5169034444 | pdeayton: "is there a PR ready?" |
| 5169089988 | ours: no PR yet, what's outstanding, #12186 correction |
| 5169316548 | ours: link obstacle + three options (awaiting reply) |

## Lessons

- **Never turn a second-hand line number into an instruction — demand function name + sha.** The
  triager's `:2035/:2272` coordinates (inside `materializeStorageToLogicalCastsImpl` /
  `lowerMatrixAddresses`, not the real site) became my directive; the fixer implemented it where it
  could not work, and the 6-day stall (07-28 → 08-03) was not fixer fault. Map every disputed line to
  its enclosing function at a named sha.
- **Byte-identical output ≠ effectless** — the `-g2` golden was our own unsatisfiable bar; measure at
  the layer the contract lives in.
- **Read dispatch routing, not abort strings.** The `SLANG_UNEXPECTED` in the
  `CastDescriptorHandleToResource` switch is a residual fallback; buffer handles route via
  `kIROp_SPIRVLoadDescriptorFromHeap` → `emitDescriptorHeapLoad` and never reach it (any "#12186
  introduces E55215" wording in [[project_12185_bindless_texture_nv_desc_handle_nonimage]] is stale).
- ⭐**Every premise true, the inference still false:** I verified the one symbol I could see (the pass
  entry) and generalized to the link set; the others differ in kind. A conjunction over a set needs
  the set enumerated, not a representative sampled. The "confirm it links before sending" gate is
  what saved it. Cf. [[feedback_name_what_you_held_fixed]],
  [[feedback_mechanism_must_predict_observed_coordinates]]; inverse shape of
  [[project_11225_capability_target_incompat_slangpy_break]].
- A fixer whose report predates an overruling maintainer comment may be holding for a decision
  already made — relay the override verbatim and chase.
- Infra: a GraphQL 401 that session (REST fine) — [[project_github_actions_graphql_401_outage]].
