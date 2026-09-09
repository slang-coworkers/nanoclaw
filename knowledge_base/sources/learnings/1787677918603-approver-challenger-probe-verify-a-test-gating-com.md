---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787672876385-egq28a
written_at: 2026-08-25T17:11:58.603Z
---

# [approver/challenger-probe] Verify a test-gating-completeness gap by compiling to SPIR-V, not by filename

**Context:** shader-slang/slang#12734 (WOULD_APPROVE, 2026-08-25) — test-only PR appending `-render-feature cooperative-matrix` to the `-vk` execution lines of coopmat-backed tests so no-coopmat devices skip (ignored) instead of SIGSEGV-ing the whole slang-test process.

**Symptom:** The production `github-actions[bot]` review flagged a 🟡 gap — "`tests/neural/activation-coopmat-vector-test.slang` is left un-gated and still segfaults on non-coopmat devices" — on the theory that the PR's sweep was incomplete. The filename contains "coopmat" and its sibling `fflayer-wavetangled-vector-test.slang` WAS gated, so by name-and-sibling inference it looked like a real omission that would undermine the PR's stated exhaustive-sweep purpose (which would normally be OPEN_GAP, not a clearable nit).

**Root cause of the false flag:** The review inferred membership from the filename and the gated sibling, not from what the test actually emits. The PR's real membership criterion (stated by the author, corroborated by Devin) is "gate every test whose *emitted SPIR-V* contains `OpTypeCooperativeMatrix*` / `OpCooperativeMatrix*`." A "coopmat" in the FILENAME is not coopmat in the emitted SPIR-V.

**How to catch it:** Compile the flagged file first-hand at the pinned head and count coopmat ops, with a positive control that IS in the PR:
`slangc -experimental-feature <file> -target spirv-asm -stage compute -entry computeMain -emit-spirv-directly` (add the test's own `-D…` defines), then `grep -oE 'OpTypeCooperativeMatrix|OpCooperativeMatrix[A-Za-z]*'`.
- `activation-coopmat-vector-test.slang`: **0** coopmat ops → correctly needs no flag (its `WaveTangledVector` usage does not lower to coopmat here).
- Positive control `fflayer-wavetangled-vector-test.slang` (gated by the PR): **27** ops (3 `OpTypeCooperativeMatrix`, 12 Load, 7 MulAdd, 5 Store).
Note the `.spv` file is BINARY — a text grep for the mnemonic returns 0 for every file; you must emit `-target spirv-asm` (or disassemble). Also `-experimental-feature` takes NO argument (needed to load `slang/neural`).

**Fix / rule:** For a test-gating-completeness gap, the falsifiable test is "does the flagged file emit the gated feature's ops?" — decide by compiling, not by name. A coopmat-named test emitting 0 coopmat ops is a review FALSE POSITIVE that clears; the gap only stands if the file genuinely emits the ops and is genuinely ungated.

**Companion facts verified this run (reusable):**
- `-render-feature <name>` and `-render-features <name>` are the SAME option (`tools/render-test/options.cpp:154`); each name is validated (`isValidFeatureName` → `SLANG_FAIL` if unknown) and ACCUMULATED into `renderFeatures`, so two spellings on one line register both features (no silent drop). "Mixed spelling" is a cosmetic nit, not a functional bug.
- The valid RHI feature string comes from the slang-rhi X-macro: `include/slang-rhi.h:136` `x(CooperativeMatrix, "cooperative-matrix")`. An unknown feature name loud-fails; it does not silently skip.
- This kind of PR gates test EXECUTION ELIGIBILITY, not a C++ compiler flag/pass — so the standing gate/flag dead-skip probe (green CI on a skip-by-construction path carries zero bits) does NOT apply the same way: capable devices still run these tests (the positive control emits real ops a capable device runs); absent-feature devices correctly skip. That is the intended, correct behavior, not a coverage loss.
- A red **cross-repo** required check ("SlangPy Tests", running in shader-slang/slangpy) can be a self-hosted-runner-comms infra failure ("The self-hosted runner lost communication with the server") rather than a test result — read the failing run's annotations, check the other OS job passed, and check sibling slang PRs' SlangPy status before treating it as a signal. A `.slang`-test-directive-comment-only diff cannot change slangpy's Python behavior.
