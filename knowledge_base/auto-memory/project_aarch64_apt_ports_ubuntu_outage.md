---
name: project_aarch64_apt_ports_ubuntu_outage
description: "aarch64 CI apt-fetch ports.ubuntu.com 'Network is unreachable' exit 100 (pre-compile) — FILED slang#12137 (Infra/CI Stability); 2-day flapping outage evicting clean PRs; maintainer-owned, NO operator card; log occurrences against #12137, escalate only on STRANDING"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**Signature:** aarch64 CI jobs fail at **`ports.ubuntu.com` apt-fetch "Network is unreachable" (exit 100)** during pre-compile Common Test Setup (`apt-get install` before any build). Intermittent/**flapping** — same runner tier succeeds and fails across hours (e.g. 07-16: 07:31Z/07:43Z passed, 06:58/07:55/09:22Z failed). No PR-source involvement — dies before compile. Runner network/apt-mirror reachability, not code.

**Scale (babysitter, 07-16 10:05Z):** 2nd day running (started ~07-14/07-15), **14 log hits since 07-14**, hit #12119/#12105/#12089 head-checks + **evicted #12055 from the merge queue twice** (its own head all-green). Keeps bouncing clean PRs from the queue; reruns only paper over it (a runner-network problem, no code fix).

**Disposition (07-16) — same ladder as [[project_11955_degrading_cpu_runner]] / #12062 board-sync:**
- **NO existing issue** (Main searched ports.ubuntu.com/aarch64-apt/arm64-exit-100 — all empty).
- **✅ FILED slang#12137** (07-16 10:17Z, OPEN, labels `Infra` + `CI Stability`; babysitter verified no dup — 5 queries empty). Content: exit-100 `ports.ubuntu.com` signature at pre-compile Setup/Common-Test-Setup; 2-day 16-hit/10-PR frequency + concrete run IDs (29478373791, 29480229495, 29481578414 mg-evict, 29435702237, 29425064181); eviction cost (#12114/#12118/#11979 07-15, #12055 ×2 07-16, all own-heads-green + self-recovered); 3 fix directions (retry+fallback-mirror / pin deps into runner image / force-IPv4); flagged `.github/workflows` fix NOT bot-pushable (maintainer authors; non-workflow retry-wrapper a triager can scope). **Log future occurrences against #12137, don't re-file.**
- **NO operator card.** An arm64 apt-mirror / runner-network fix routes through whoever owns the CI runner fleet (maintainer/infra), NOT the dashboard operator — same as #11955's larger-runner ask and #12062 board-sync. I can't fix a runner apt mirror and neither can the operator without going through the fleet owners.
- **NOT bot-fixable** if the fix is in `.github/workflows` (bot lacks `workflows` perm per [[project_bot_workflows_permission]]) — but a retry-with-fallback-mirror on the dep step MIGHT be a normal-file change; leave scoping to the maintainer/triager. Tracking-only from our side.

**Escalation:** if it escalates from "evicts + self-recovers" to **stranding** an approved PR (eviction that doesn't auto-requeue) or clusters into a throughput stall, THEN it graduates to an operator prioritization surface — same trigger shape as the other infra flakes. Until then, maintainer owns it via the tracking issue. Babysitter watches + logs occurrences against the filed issue, doesn't re-file.
