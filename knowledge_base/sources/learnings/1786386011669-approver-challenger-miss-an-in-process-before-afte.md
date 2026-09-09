---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-10T18:20:11.669Z
---

# [approver/challenger-miss] An in-process before/after split refutes the "bad CI runner" confound that a base-vs-head comparison alone cannot

## Symptom

slang-rhi#826's pinned head was red: both Linux `clang` legs (the only Linux legs
that run the suite) reported `855 | 711 passed | 144 failed`, while the base commit
had been `854 | 854 passed | 0 failed` on the same self-hosted pool two minutes
earlier. All 144 failures were `.vulkan`, all the same assertion — every subsequent
Vulkan `createDevice` failing — preceded by
`libnvidia-tls…: cannot allocate memory in static TLS block` and
`loader_icd_scan: Failed loading … ICD JSON libGLX_nvidia.so.0` (head 5×/5×, base
0×/0×).

I nearly stopped at: *"both red legs ran on runner slot `2u1g-b650-0826-*` while the
green base legs ran on `…-0025`/`…-0036` ⇒ revision and host are confounded; a
broken NVIDIA ICD on that one host is not excluded; resolving it needs a re-run."*

That caveat was too weak, and it would have downgraded a real BLOCK to a
hand-wave — the artifacts already contained the control.

## Root cause of the near-miss

I looked for the control **across jobs** (head-vs-base, host-vs-host) when the
decisive control was **inside a single job**. A test binary is one process on one
host with one driver; if the host's ICD were broken, tests would fail *from the
first one*. So the log's own ordering is a within-subject control that holds host,
driver, and build constant — exactly the variables the cross-job comparison
confounds.

## How to catch it

When a suite shows mass failures of one backend, split each failing log at the
suspected trigger and count pass/fail on **both sides**:

```
NEW=$(grep -nE "<new-test-name>.*PASSED" $LOG | head -1 | cut -d: -f1)
awk -v n=$NEW 'NR<n' $LOG | grep -cE '\.vulkan +PASSED'   # before
awk -v n=$NEW 'NR<n' $LOG | grep -cE '\.vulkan +FAILED'
awk -v n=$NEW 'NR>n' $LOG | grep -cE '\.vulkan +FAILED'   # after
```

Result here, identical in both legs: **before → 130 PASSED / 0 FAILED; after → 2
PASSED / 144 FAILED.** A host-level fault cannot produce 130 consecutive passes on
that host in that process. Host hypothesis refuted; the revision owns it.

Ask of any "environment flake" explanation: **would it have failed the earlier
tests too?** If yes and they passed, it is not the environment.

## Two refinements the split also buys

1. **Shape of the break.** Two `.vulkan` cases still passed *after* the trigger,
   then the TLS warning fired and everything later failed ⇒ *cumulative* resource
   exhaustion, not a single fatal call. That distinction pointed straight at the
   mechanism: the new test is the only test calling `releaseCachedDevices()`
   mid-run (plus `initTaskPool(1)` and a dtor doing `device.setNull()` /
   `initTaskPool(-1)`), so later tests re-create devices and repeated driver
   load/unload exhausts glibc's static-TLS budget. Grep confirmed the only other
   callers are shutdown and a debug-layer path.
2. **Scope the residual honestly.** "This PR triggers it" was established; "which
   half of the PR owns it" was not (the header change touches only CUDA pipeline
   scheduling and cannot break Vulkan device creation; the test-side churn is the
   likely owner). Name the part that is proven and the part that is not, rather
   than letting the unproven part dilute the proven one.

## Fix

For any mass-failure-of-one-backend signal, run the in-process split **before**
writing any "host/infra flake, unresolvable from artifacts" caveat. A cross-job
comparison answers "did it change?"; only the within-process split answers "did the
change cause it?" — and it costs three greps against logs already downloaded.

Also: a *global* test-state mutation in a new test (dropping cached devices,
re-initializing a global pool) is a review-worthy blast-radius change even when the
new test itself passes. The test passing says nothing about what it did to the
1000 tests after it.
