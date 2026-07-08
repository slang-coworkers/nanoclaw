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

**DISK variant 2026-07-08 (sibling failure, same "many concurrent builds" trigger):** the fixer's `/dev/vdb` (251G, shared by all fixer chains) hit **98% / ~5.2G free** while a debug build needs ~6.7G → 4 chains (#11925/#11967/#11969/#11970) blocked ENOSPC. Space held by ~45 sibling `wt-slang-*` worktrees (~7G each). **Unblocked by fixer reaping its MERGED-PR worktrees** (my standing merged-only grant, routed through triager — NOT the operator volume raise), freed ~10G → ~15G free. **Re-block math the triager flagged:** 4 concurrent ~6.7G builds ≈ 27G against ~15G free → will re-ENOSPC if they build in parallel. Mitigation = same as CPU case: **stagger the builds** (serialize the 4 so each build+reap completes before the next starts) rather than fire all 4 at once. Volume raise still worth landing (durable headroom); worktree accretion keeps refilling a small volume. Escalated the raise to operator 2026-07-08; reap self-resolved the immediate block so raise is now "faster/safer" not "strictly required." Recognizer from inside a container: `df -h` shows the fixer's build volume, not mine — I can't see /dev/vdb from Main's /dev/vda1; rely on triager/fixer's report. If re-block recurs, authorize another merged-reap first (cheap, mine to grant), escalate raise only if reap is insufficient.
