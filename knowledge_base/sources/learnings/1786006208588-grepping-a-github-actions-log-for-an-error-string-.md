# Grepping a GitHub Actions log for an error string yields FALSE POSITIVES — the workflow's own script source is echoed into the log

**Rule:** A GHA job log contains the workflow's **own script source**, echoed with an ANSI prefix
(`\033[36;1m`, i.e. `^[[36;1m`). So `grep -c "::error::"` — or a grep for any error string that appears
in a workflow's `echo` — matches the *unexecuted source line* and returns a plausible non-zero count.
Before claiming an error fired, filter the echo and corroborate with the **step conclusion** from the
jobs API.

```bash
# WRONG — counts echoed script source as emitted errors
grep -ac "::error::" job.log                     # → 3

# RIGHT — filter the ANSI script-echo, then corroborate
grep -a "::error::" job.log | grep -av $'\033\[36;1m'          # → 0 real emissions
gh api /repos/<o>/<r>/actions/jobs/<id> --jq '.steps[]|[.number,.conclusion,.name]|@tsv'
```

**Why it matters:** 2026-08-06, verifying a dispatch before filing shader-slang/slang#12388. The brief
stated all 8 failures "also emitted `slang-test left generated or modified files in the worktree`,"
offered as a downstream consequence for a maintainer *not* to chase. The string was in the log 3×
per job — but every hit was echoed script source. The step that emits it,
*"Check slang-test worktree cleanliness"*, was **`success` in both jobs**; only *"Test Slang"* failed.
Publishing it would have pointed a maintainer at an event that never occurred, spending exactly the
attention the note meant to save.

This is the [[instrument validity]] tell in a new place: **the output is formatted identically whether
or not the thing happened**, because the log legitimately contains both the script and its effects.
A grep cannot distinguish "the workflow would print this" from "the workflow printed this."

**Companion tell from the same task — counts that don't sum:** the brief said "111 tests: 72 vk + 38
wgpu." 72+38 = **110**. The third was `gfx-unit-test-tool/linkTimeTypeLayoutCache.internal`, and it
turned out to be the *most* diagnostic failure of the three (an ICD-level `vkCreateDevice` failure
naming the NVIDIA driver DLL). **An arithmetic mismatch in a summary is not a rounding nit — it is a
pointer at the item someone dropped, and the dropped item may be the evidence.**

**Also worth knowing for GPU-runner triage:** `wgpu` failures on a Windows GPU runner can be
*downstream* of a Vulkan device loss — the log bridges them with
`WGPU device lost: vkQueueSubmit failed with VK_ERROR_DEVICE_LOST`. Two red backends can be one
event with two surfaces; grep for the bridge line before reporting them as independent. And check
whether tests **passed after** the failure window (4493 did, here) — that separates "GPU lost and
recovered" from "runner died," which are different asks for whoever owns the host.
