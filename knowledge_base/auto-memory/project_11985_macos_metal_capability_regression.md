---
name: project_11985_macos_metal_capability_regression
metadata: 
  node_type: memory
  type: project
  originSessionId: b63b776f-b15c-43f2-90e2-00d74c7ee891
---

**#11985 "Intermittent MacOS CI failure"** — filed by maintainer jkwak-work (surfaced on bot PR run pr=11907, the mimalloc chain [[project_11925_mimalloc_core_parked]]).

Triaged @ ToT 33f9ed0ce → bug/regression, medium/P2, target-emit (Metal)+capabilities. Verdict posted on #11985 (comment 4910230625); `regression`+`Metal` labels added (human `Testing` type + `Dev Opened` preserved).

**Root cause (triager + fixer both @ ToT 33f9ed0ce — REFINED to a capability-default POLICY defect, not a mechanical gate bug):** The emit gate `slang-emit-metal.cpp:215 implies(metallib_4_0)` is *correct* (#10592's own `tests/metal/threadgroup-size.slang` uses explicit `-capability`, METAL3-NOT case passes). The actual bug: bare `-target metal` **defaults** target caps to `metallib_4_0` — abstract `metal` atom canonicalizes to `metallib_latest`, which #10592 flipped 3_1→4_0 (`slang-capabilities.capdef:207`). So the Metal-4.0-only `[[required_threads_per_threadgroup]]` is emitted BY DEFAULT while offline is hardcoded `-std=metal3.1` (`slang-gcc-compiler-util.cpp:973`) and slang-rhi passes only `Capability::metal` with no 4.0 `MTLLanguageVersion` (`metal-device.cpp:252,329`) → attribute rejected on free macos-latest runners with <4.0 Metal → createComputePipeline fails → gpu-printing exits 255. Intermittency = free-runner Metal-version heterogeneity, NOT a flake. Same masked error caused `slang-test` `*Metal.internal` failures (cleared on retry).

**Regression from PR #10592 (72fdc442c) — now PUBLICLY ENDORSED by maintainer jkwak-work** on the issue (comment 4910286902, looped in @jhelferty-nv). Main did not independently re-verify at hunk precision, but maintainer endorsement is stronger corroboration; relay as "maintainer-endorsed" not "Main-verified" per [[feedback_verify_regression_claims_at_precision]].

**Fix forms (maintainer picks — HELD):** **A1** revert `metallib_latest`→3_1 (surgical, immediately shippable, fixer's recommended-minimal); **A2** decouple default-from-latest; **A4** thread a real Metal-version option (correct-by-construction, touches slang-rhi submodule → multi-PR). Fixer confirmed the diagnosis independently, wrote plan artifact `reports/slang-11985.md` (fixer's fs), opened NO PR. On maintainer GitHub direction the fixer is instantly executable: worktree + chosen option + default-target FileCheck-NOT test + draft PR.

Related: #10560 (feature), #11973 (same job, was framed infra — now refined to a compiler cause).

**State:** HELD — blocked on a **human design decision (A1/A2/A4)** owned by **@jhelferty-nv** (#10592 area owner), jkwak-work aligned on diagnosis. NO PR. Both decision-owners already engaged on the issue, so NO additional bot comment (public footprint carried by verdict cmt 4910230625 + jkwak endorsement + jhelferty-nv loop-in). Triager owns the fixer edge — do NOT double-dispatch [[feedback_no_double_dispatch_peer_wired]]. No further bot action until jhelferty-nv/jkwak GitHub direction (webhook) or triager re-dispatch. Local Metal/GPU verification impossible (Linux host) → final validation via CI on a 4.0-capable macOS runner. See also [[project_11989_examples_fail_on_warnings]].
