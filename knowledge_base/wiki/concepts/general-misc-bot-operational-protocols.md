---
title: "Bot Operational Protocols and Maintainer Interactions"
type: concept
group: general-misc
tags: [operational, maintainer, triage, pr-watcher, scheduling, design-discussion, latent-defect, tracking-issues]
source_count: 5
---

# Bot Operational Protocols and Maintainer Interactions

Operational rules governing how the bot interacts with maintainers and manages recurring workflows: PR watcher task design, self-scheduling restrictions, external dependency triage, design discussion etiquette, and latent defect filing policy.

## PR Status Watcher Tasks: Put Detection in the Script Guard

A `schedule_task` PR-watcher whose agent prompt does "poll → compare → end turn silently if unchanged" still wakes a full agent session on every fire, and any stray scratchpad output leaks toward wired peers. The correct pattern is to put change-detection in the task's `script` parameter (the pre-agent guard), not the prompt. The script polls, compares against a state file on disk, and emits `{"wakeAgent": false}` when unchanged — the agent never runs on a no-op fire. Only a real delta sets `{"wakeAgent": true, "data": {...}}`. The comparison key should include state, isDraft, reviewDecision, review/comment counts, and a `ciFailed` boolean — but NOT `mergeStateStatus`, which flaps `UNKNOWN→BEHIND→CLEAN` with no real change and reintroduces spurious wakes. Pre-seed the state file with current state right after creating the task so the very first scheduled fire does not wake on `prev=null`. ([[wiki/learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md]])

## Don't Self-Schedule a PR-Watcher After report_pr_created

When a coworker opens a PR and calls `report_pr_created({ repo, pr_number })`, it must NOT also schedule its own recurring PR-watcher poll task. The host already routes future PR webhook events (review comments, CI status, merge) back to the owning session via the `pr_session_mappings` table that `report_pr_created` writes. A self-scheduled poller is fully redundant with that path. After `report_pr_created`, go fully idle — silence is the correct idle state. If a poller has already been scheduled, `list_tasks` → `cancel_task` it once the PR is open. ([[wiki/learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md]])

## Triaging External-Dependency Tracking Issues

When triaging a "re-enable this test / remove this workaround once upstream is fixed" tracking issue, two cheap checks sharpen the verdict: (1) verify the suppression PR actually merged — the workaround-adding PR may still be open and not yet on master; (2) locate the concrete upstream tracker and fix PR via `gh issue/pr list -R <upstream> --search "<keywords>" --state all`. Also check for a companion issue filed at nearly the same time (bug-side tracker + cleanup follow-up). The correct verdict for these is enhancement/tracking, low/P3, "handed off — awaiting external dependency." Park the fixer-forward (root defect is upstream, nothing actionable on the Slang side) but still post the verified state on the issue with an ordered resumption trigger. ([[wiki/learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md]])

## In Maintainer Design Discussions, Be Reticent

When a GitHub issue or PR thread turns into a high-level design discussion among maintainers/developers, the bot should participate sparingly — contribute only high-value verified facts that are clearly wanted (ideally when directly asked or @-mentioned), not a comment on every turn. If a maintainer says any form of "stop responding / let us discuss / we'll ping you," comply immediately and silently — post nothing further, including no "understood, standing down" acknowledgment, which is itself the noise they are trying to remove. The respectful signal of compliance is silence. Re-engage only on an explicit @-mention of the bot, routed through the orchestrator — not on inferred convergence or an apparent "go ahead" from another participant. ([[wiki/learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md]])

## Latent Adjacent Defects: Surface, Don't File Speculatively

When triage uncovers a latent, adjacent defect (by code-reading) that is out of scope of the reported issue, and the reported issue is being resolved by an unmerged PR, do not speculatively open a separate tracking issue. Reasons: the covering PR may change the adjacent code's post-merge state (premature); a code-read flag is not a confirmed user-visible repro (unverified); and surfacing it in the public resolution comment ensures maintainers landing there already see it (not lost). File a fresh issue only if/when the covering PR merges AND the adjacent path still misbehaves with a verified repro. Never open speculatively — filing a new issue is a visible shared-state action that needs authorization anyway. ([[wiki/learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md]])

---
**Source learnings (5):**
- [[wiki/learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md]] — PR/status watcher tasks: use a pre-agent script guard with a state file
- [[wiki/learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md]] — Don't self-schedule a PR-watcher poller after report_pr_created
- [[wiki/learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md]] — Triaging external-dependency tracking issues
- [[wiki/learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md]] — In maintainer design discussions, the bot should be reticent
- [[wiki/learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md]] — Latent adjacent defect found by code-reading: don't file a speculative tracking issue
_Catalog: [[wiki/index.md]]_
