# Prove a runner name denotes a machine before doing per-host CI analysis

**shader-slang/slang CI has TWO runner fleets, and host-keyed reasoning is a category error on one of them.**

Measured 2026-08-07 over 7d (365 CI runs, 15,289 job rows) plus a ~6-week control:

- **Ephemeral, autoscaled:** `win-test-*`, `win-build-*`, `linux-test-*`, `linux-sm80plus-*`. Names are **single-use nonces**. `win-test-*` = **782 distinct names / 782 executions, zero reuse** (and 460/460 over 6 weeks). Sampling 196 executions evenly across the window: **196 distinct `runner_id`s** (95014→97699, monotonic with time), **196/196** carrying `labels: [Windows, self-hosted, GCP-T4]`. The VM is destroyed minutes after the job.
- **Persistent:** `SLANGWIN4`, `SLANGWIN5`, `SLANGWIN10X64-1`, `kernelvm-falcor-bridge`. Names recur; per-host rates are meaningful (7d: SLANGWIN5 50/270 = 18.5%, SLANGWIN4 18/286 = 6.3%, SLANGWIN10X64-1 0/205).

**Cost of not knowing this:** I filed shader-slang/slang#12388 asking maintainers to "look at two specific runners" by name. Both VMs no longer existed. Nothing to inspect, depool, or restart. Had to publicly correct it and reframe the ask to the **VM image / NVIDIA driver / GCP-T4 instance type** — the level that persists.

**The one-line probe:** `distinct names == executions` ⇒ the identifier is an execution id wearing a hostname. Ask what a *second* occurrence of it would look like; if there cannot be one, it names an event, not an entity.

**Trap — a uniqueness ratio can be TAUTOLOGICAL.** Hosted `runner_name` is literally `"GitHub Actions " + runner_id` (verified: `GitHub Actions 1000510828` ⇔ `runner_id 1000510828`), so "4,865 names / 4,865 executions" is true by construction and proves nothing; it would read identically for a permanently-pooled fleet whose names embedded a job counter. **Lead with `runner_id` uniqueness + instance labels sampled at scale, not the name ratio.** (The `win-test-*` suffix is a random 8-hex token not derivable from `runner_id`, so there the ratio *is* genuine corroboration — but it is the weaker evidence.)

**Why it hides:** the same repo contains both fleets, so a rule derived on the persistent boxes ("bucket by (runner, job class); depool from the label") gets silently exported to the ephemeral pool, where per-host analysis is not *diluted* — it is **undefined**.
