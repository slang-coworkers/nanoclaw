---
name: feedback_a_recovery_figure_measured_from_the_wrong_boundary_argues_the_opposite
description: "\"4493 passed AFTER the window closed\" was actually the count after it OPENED (real after-close figure: 72). A boundary swap turns a recovery argument into its own counter-evidence while every digit stays reproducible."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5238e95a-1b31-4d15-aeb2-a2cfcb0eb0a8
---

# A recovery figure measured from the wrong boundary argues the opposite

**Measured 2026-08-06, shader-slang/slang#12388** (Windows-GPU Vulkan device loss). Published body:

> **4493 tests passed after the window closed.** So this is a transient device-loss/recovery event,
> not a runner that fell over.

The sentence's entire job is to establish *the GPU recovered*. I could not reproduce 4493 at any
boundary in the job log:

```
after 05:08:17.98  (body's stated first bound)  -> 4498
after 05:08:18.11  (real first DEVICE_LOST)     -> 4491
after 05:10:27.63  (real last  DEVICE_LOST)     ->  930
after 05:11:09.58  (body's stated window close) ->   72
```

⛔ **~4493 is the count of passes after the window *OPENED*.** Under the body's own bounds, "after
the window closed" is **72** — a factor of 62. The figure was measured from the boundary that makes
the number big, and labeled with the boundary that makes the number *mean something*.

⭐⭐⭐ **A wrong-boundary count is the most durable kind of error, because every digit is
reproducible.** Anyone re-running the grep gets ~4493. The defect is not in the arithmetic, the log,
or the tool — it is in the **predicate**, which lives only in the prose. Recomputation *confirms* it.
Same family as the ISO-timestamp-vs-bare-date compare (`[lo,hi)` from a symmetric-looking predicate)
and the date-only filter swallowing a pre-merge run: **the operator you wrote differs from the
interval you got, and the output looks fine.**

⇒ **For any "after X" / "before X" figure, print the boundary line itself, not just the count.** Here
that check is instantly fatal: the body's two quoted bounds are **not the events they name** —
`05:08:17.98` is `passed test: '…(wgpu)'` plus an unrelated vk `failed(pending retry)`, and
`05:11:09.58` is `JSON RPC failure: sendCall()`. Neither line contains `VK_ERROR_DEVICE_LOST`. The
real signature spans `05:08:18.1122501Z`→`05:10:27.6317703Z` = **129.5s**, not the stated 171s (171s
is the span of the 111 *test failures* — a real interval, attached to the wrong quantity).

✅ **The conclusion survived on smaller honest numbers — which is why this was worth correcting rather
than deleting.** After the last DEVICE_LOST: **930 passes, 9 of them `(vk)`**
(`tests/spirv/subgroup-size.slang.1 (vk)`, `tests/spirv/vector-times-scalar.slang (vk)`), final pass
line `gfx-unit-test-tool/computeSmokeVulkan.internal` at `05:11:17.82Z`. Plus **837 `(vk)` passes
before** the window (of 1163 total). vk demonstrably worked again.

⭐⭐ **An inflated figure supporting a TRUE conclusion is the hardest to catch, because the claim
reads correct and the evidence reads overwhelming.** Nobody re-derives support for a conclusion they
already accept — the twin of the fictional `<SpirVAssemblySource>` probe, where *being right made the
evidence unauditable* ([[project_12364_cts_storage_image_minnonuniform]]).

⚠️ **This was not in the brief I gave the verifier — I found it while range-checking a figure the
subagent had passed over.** Its `837 vk passed before` was right and its vk-after count was wrong;
mine disagreed, so I recounted both. **A verifier clearing a section is not evidence every figure in
it was checked** — cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]].

Companion defects in the same body, same session:

- **A page mistaken for a population, on the runs axis.** "Oldest retained run 2026-07-31, earlier
  history beyond retention" — false: `total_count=2775`, page 5 reaches `2026-06-25`. The 48.7%
  reproduced *exactly* for the 43-run slice; over 500 runs it is **28.6%**, so the sickness was
  overstated ~1.7×. Sibling of `(.jobs|length)` being a page size.
- **"Evicting a clean PR"** — the same head had a *second* failing workflow (`Check Submodule
  Pointers`, `external/mimalloc` pin, tracked #12381). Restates the #12341 lesson verbatim:
  **"failed on a run that used the box" ≠ "failed because of the box."**

Chain: [[project_12388_windows_gpu_vulkan_device_loss]]. Sampling twin:
[[feedback_a_shape_dependent_figure_m]].
