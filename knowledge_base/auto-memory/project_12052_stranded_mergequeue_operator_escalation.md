---
name: project_12052_stranded_mergequeue_operator_escalation
description: "#12052 APPROVED bot PR stranded ~18h+ by #11955-flake merge-queue eviction; PARENT-owned operator escalation (card fired 2×, both timed out); exact fix = maintainer/operator runs gh pr merge --merge-queue"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**#12052** ("Fix #12049: specializing a generic entry point can't see primary-file extension conformances", branch `fix/issue-12049`, **bot-authored, APPROVED, all 46 head checks green**). jkwak-work actively drove it (enabled auto-merge 07-11 00:56Z, added to merge queue 04:29Z), then it was **evicted 04:29:51Z** by the tracked **#11955** cpu-LLVM SIGSEGV-at-exit flake (batched with queue-mates; NOT this PR's code). Has NOT auto-requeued — past the ~15h GitHub-auto budget (recalibrated off #11934's 14.5h recovery). Verified still stranded 07-11 22:04Z: `isInMergeQueue:false`, `mergeStateStatus:BLOCKED`, `merged:false`, head green.

**Why it can't self-rescue:** bot token lacks push to the protected `gh-readonly-queue/*` branch → bot (and Main, same nv-slang-bot token) **cannot** `enqueuePullRequest`. Only a human/maintainer can. **Exact fix:** `gh pr merge 12052 --repo shader-slang/slang --merge-queue`.

**Escalation state (PARENT/Main-owned):**
- Babysitter posted 2 on-PR comments (14:15Z `4946620769`, 22:04Z `4948921374` — should have edited-in-place not stacked; left as-is). jkwak-work mentioned/subscribed 14:15Z but **no reply / no manual re-queue** in ~8h.
- **Main surfaced to operator via `ask_user_question` TWICE (msg-628-turn ~20:xxZ, and 22:xxZ) — BOTH timed out (300s, 600s), no in-window answer.** Per [[feedback_push_not_away]] a timeout says NOTHING about operator presence (plausibly off-hours at 22:00Z UTC). Did NOT escalate to `timeout:0` — there IS an acceptable fallback (APPROVED bot PR, lands eventually, not blocking anything critical), so indefinite turn-block isn't warranted.
- **Babysitter STOOD DOWN + persisted the handoff** (`owner:"PARENT"`, `do_not_re_escalate:true` in its `_rearm` marker, survives respawn) → it reports state changes only, does not re-escalate.

**Main's forward posture (do NOT re-spam):** the decision is surfaced and rests with a human; the durable GitHub trail (babysitter's comment with the exact command) is live. **Re-surface to operator at most ONCE more** — only if the NEXT babysitter sweep still shows it stranded AND operator still hasn't engaged. On ANY state change (auto-recovers, merges, maintainer re-queues, operator answers), act on it and close this. Do NOT fire a third card reflexively. Systemic lever lives on [[project_11951... / #11955 issue]] (quarantine/reland degrading cpu-llvm runner + give bot enqueue rights) — that's the real fix; #12052 is one victim.
