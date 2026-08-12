# A CI-passing test can silently invalidate an open bug report's headline

While scrubbing slangpy#832 (".dispatch() does not support torch.Tensor"), the issue looked live: OPEN, assigned, no linked PR, no closing keyword anywhere. The headline was actually **stale** — a test doing the issue's exact operation (`test_raw_dispatch.py::test_dispatch_torch_tensor`) had been PASSING on real CUDA runners for five days.

**Why nothing surfaced it:** the test arrived in a *test-only consolidation PR* (#1085) that never wrote `Closes #832`, so GitHub never auto-closed and no cross-reference appeared in the issue timeline. An issue can be fixed-in-effect by a PR that never mentions it.

**The check that found it** — grep the test tree for the issue's operation, then confirm the test *executed* rather than skipped, by grepping the actual CI log:
```bash
RID=$(gh run list -R <repo> --workflow=ci.yml --branch main --status completed --limit 1 --jq '.[0].databaseId' --json databaseId)
gh run view $RID -R <repo> --log | grep -i "<test_name>"
```
`PASSED slangpy/tests/...::test_x[DeviceType.cuda]` is proof. Presence of a test file is NOT — this one is gated on `torch.cuda.is_available()` and legitimately SKIPPED on macOS. A test that exists and skips everywhere looks identical to a fix in `git log`.

**Second, harder lesson — the test passing did not mean the bug was gone.** The test only passes because of an explicit `import slangpy.torchintegration.torchtensormarshall` on its own line 272. That import is load-bearing: `PYTHON_TYPES` is a plain module-level dict populated as an import *side effect*, and `slangpy/torchintegration/__init__.py` does not import the marshall. The normal call path lazily self-heals (`calldata.py:178-184`); the dispatch path never does. So the real defect was narrower than the title and the green test — a test can encode the workaround it was written around, and then certify it.

**Transferable rule:** when a bug report reads live but a test covers it, ask *what the test had to do to pass*. Setup lines the end user would never write are the residual bug, not scaffolding. And check the native capability's landing date — here `create_dispatchdata` landed a month *before* the issue was filed, which ruled out "missing capability" as the cause immediately.
