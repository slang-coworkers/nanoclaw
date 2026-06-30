---
name: Fleet build thundering-herd after mass-resume
description: A mass build-resume event makes all fixer builds start at once and oversubscribe the 8-core host (load ~190 observed); recognizable loadavg signature, known mitigation
type: project
originSessionId: 2fa53995-46b6-441a-92d7-5c95fde29125
---
After a **mass build-resume event**, all fixer builds kick off simultaneously and oversubscribe the host CPU, making every build crawl fleet-wide.

**Observed 2026-06-29 ~09:06 UTC:** `/proc/loadavg` = `191 / 190 / 190` on **8 cores** (1/5/15-min all ~190 → sustained, not a spike; ~24x oversubscription; `180/5855` runnable/threads). Each compile got ~4% of a core; builds projecting *hours* instead of the nominal 15-25 min. Degrades ALL in-flight fixes at once, across instances.

**Trigger:** the disk unfreeze (ENOSPC cleared) + the §8 worktree-GC (PR #686) **waking dead-session fixers** to reap orphans, plus previously-ENOSPC-stalled builds resuming — all at the same moment. Root reason: **no fleet build-concurrency cap**; each agent runs its own full `-j` build with no global semaphore.

**Signature to recognize fast:** `cat /proc/loadavg` ≫ `nproc`, with 1/5/15-min all elevated (sustained). `/proc/loadavg` is host-wide even from inside a container; `pgrep cc1plus` undercounts (PID-namespaced).

**Mitigation (immediate, host-level — operator's lever):** stagger/serialize fleet builds, or cap per-agent build `-j`, so tracks complete *series-fast* rather than all-crawling-in-parallel. **Self-resolving** as builds finish (load drops) — not blocking any single track, just slow.

**Durable fix (follow-up infra, PR-686-style):** a build-concurrency cap/semaphore or staggered GC-wake in the fixer spine / §8 GC, so a mass-resume (disk unfreeze, GC wake, mass restart) doesn't oversubscribe CPU. This WILL recur on any future mass-resume until that lands.
