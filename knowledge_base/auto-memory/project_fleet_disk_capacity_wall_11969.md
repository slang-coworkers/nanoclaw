---
name: project_fleet_disk_capacity_wall_11969
description: "2026-07-08 /dev/vdb hard capacity wall — merged reap exhausted (0G), P1"
metadata: 
  node_type: memory
  type: project
  originSessionId: 62aa630d-2cf2-4171-b501-95bd015c1719
---

**2026-07-08:** Fleet shared build volume `/dev/vdb` hit a **hard capacity wall** — 251G, 100% used, 988M free. The standing merged-only worktree reap is **fully exhausted**: fixer re-verified all 41 non-active worktrees via fresh `gh pr view --json state,mergedAt` → **0 merged, 0 bytes reclaimable** (30 OPEN PRs isolation-protected, 11 no-PR, 4 active chains + main clone). This is a **capacity** problem, not hygiene — the reap can't keep pace with 40+ multi-GB worktrees on a full 251G volume.

**Blocked work:** P1 #11969 (Metal fragment out-param ICE) — fix committed + codex-approved on `fix/issue-11969@20bc7d0125` (5.5G partial, build died at 828/1170 on ENOSPC, needs ~6.7G to finish incrementally). Instantly resumable; disk is the sole gate. Held staged, NOT thrashing against a full disk.

**Two operator-only levers (neither is Main's to pull):**
1. Expand `/dev/vdb` — structural fix; merged reap won't keep pace otherwise.
2. Operator-authorized pruning of genuinely-stale **no-PR** branches. Candidate set (needs fixer per-branch safe-and-recoverable confirmation first): `rebase-tot`, `rebase-11591`, `ci/issue-11926-sanitizer`, `pr9085-takeover`, `slangpy-1014`.

**⚠️ DO NOT PRUNE — live triaged→fixer chains (fixer wrongly listed as "abandoned"):** `11981`, `11982`, `11983`, `11984`, `6557`, `11952`. #11981 is #11969's sibling. These hold staged/pending work. [[project_11981_metal_export_out_param_addrspace]] [[project_11969_metal_out_param_addrspace]]

**Rules held:** Main never git-worktree-removes directly — reaps/prunes run via the owning fixer ([[feedback_always_reap_merged_worktrees]]). Pruning open-PR worktrees is forbidden (isolation). Operator capacity-lever ask timed out again (600s this round, 300s prior) — treated as async-pending, NOT denial ([[feedback_push_not_away]]); P1-with-fallback doesn't justify a blocking timeout:0 re-ask. Post-de-escalation posture = **STABLE HOLD, not acute-blocked**: Main deliberately did NOT re-fire a blocking gate for a now-non-urgent structural issue; surface the lever non-urgently on the operator's next touchpoint instead. Relates to [[project_fleet_build_thundering_herd]].

**Resume trigger:** the moment ≥6.7G frees by any lever → fixer resumes build → repro + tests/metal/fragment-out-param.slang → push → draft PR (Closes #11969) → report_pr_created → triager rolls up.

**2026-07-08 11:50 — RESOLVED (disk gate cleared, no operator prune needed).** Prod update to build 2.1.39 rebuilt/restarted containers; during update /ephemeral was 100% so regenerable `build/` output was cleared from git worktrees. Source/commits/uncommitted TRACKED changes untouched — only gitignored CMake/compiler output. Net: `/dev/vdb` dropped 100%(308MB) → **36% used, 154G free** (verified by Main via `df -h`). Capacity wall gone; 6 live chains all intact (nothing pruned). **#11969 fix commit `20bc7d0125` intact — but the 5.5G partial build (828/1170) is cleared → fixer must REBUILD FRESH (CMake reconfigure + full build), not resume incrementally.** Resume signal relayed to triager (msg149): re-check branch state → rebuild → repro+tests → push → draft PR → report_pr_created → triager rolls up. #11981 build output likewise cleared (source intact); re-check + rebuild if needed. Structural capacity issue (19G clone + ~40 worktrees on 251G) still real long-term but no longer acute.

**08:52–08:56 acute-drain episode — RESOLVED, do not re-read as active emergency:** free space briefly fell 988M→17MB (~88M/min); diagnosed (read-only via fixer) as an **external container** writing to shared /dev/vdb, NOT our fixer (0 build processes, #11969 partial idle not thrashing). It **self-flattened** (recovered to ~308MB, stable). No fleet-zero action was needed. **Scope correction:** the draining volume is `/dev/vdb` (shared worktree/build volume, fixer fleet) — NOT all containers. Daily-report agent is on `/dev/vda1` (separate, 11G free), unaffected. My initial "every container's session-DB writes fail" framing was overstated; true blast radius = work/containers on /dev/vdb. Structural saturation source: 19G base clone `/workspace/agent/slang` + ~40 worktrees @7–7.7G. Standing watch: if drain restarts at that rate, re-sample + fingerprint the external writer.
