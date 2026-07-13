---
title: "slangpy CI: test_tensor_interfaces[d3d12] and matrix-vector grad tests are flaky on GFX pipelines"
type: learning
topic: slang-compiler
source: learnings/1783887861915-slangpy-ci-test-tensor-interfaces-d3d12-and-matrix.md
---

# slangpy CI: test_tensor_interfaces[d3d12] and matrix-vector grad tests are flaky on GFX pipelines

**Signature:** `slangpy/tests/slangpy_tests/test_pytorch.py::test_tensor_interfaces[DeviceType.d3d12]` fails intermittently in Windows CI with `AssertionError: Tensor deviates by <large N> from reference` (e.g. 2.928 vs 1e-4 tol) while 5120+ other tests pass. The **build succeeds** — it's a single Python gradient-comparison test failing, not a compile error.

**It is flaky, not a real regression.** How to confirm quickly:
- The same test's `[DeviceType.cuda]` and `[DeviceType.vulkan]` variants PASS in the SAME run — only d3d12 fails.
- The sibling test `test_tensor_arguments` (same `get_test_tensors` helper, same `torch.outer` grad assertion) is explicitly `pytest.skip("Test currently unreliable on GFX pipelines")` for all non-CUDA backends. `test_tensor_interfaces` is the same class of matrix-vector gradient test but lacks that skip — so it flakes on GFX (d3d12/vulkan) pipelines. Maintainer-documented unreliability.
- slangpy CI is broadly flaky on GFX: other PRs show *different* sporadic single-test failures (test_nn_parameter_signature, test_module_cache) — a rotating flake set, not a shared regression.

**These matrix-vector grad tests use `torch.randn` inputs and both IDiffTensor params `requires_grad=True`**, so a mixed-requires_grad backward fix (e.g. #1056's no-grad-input scratch-buffer) does NOT touch this path — both params take the unchanged requires_grad=True branch, and the only no-grad input binds as a plain array, not an IDiffTensor pair.

**Bot limitation:** `nv-slang-bot` CANNOT `gh run rerun --failed` — returns `Must have admin rights to Repository`. To clear a flaky CI failure on a bot PR, a human must re-run the job or push a no-op; the bot can only triage and report. Don't burn cycles trying to rerun.

**Triage rule:** a single-test Python failure on ONE backend, where other backends of the same test pass + the test is green on the PR's base + your change is backend-agnostic, is flaky CI — report to parent, don't hunt for a bug in your diff.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783887861915-slangpy-ci-test-tensor-interfaces-d3d12-and-matrix.md`_
