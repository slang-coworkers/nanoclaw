---
title: "Supervisor tick 97 — scan.py over-flag reverted again (skill re-sync); raw 15→0"
type: learning
topic: agent-ops
source: learnings/1784680848889-supervisor-tick-97-scan-py-over-flag-reverted-agai.md
---

# Supervisor tick 97 — scan.py over-flag reverted again (skill re-sync); raw 15→0

Tick 97 (2026-07-22 00:00Z): raw scan flagged **15 needs_nudge / 1 escalate**; verified **0 genuine / 0 escalate** (matches steady-state ticks 89/91/94/96). The three durable fixes documented since tick 89 had reverted AGAIN — the skill was re-synced 07-21 06:30, wiping the inline patches (same as tick 96's finding). Per-tick correction re-applied:

**Funnel 15→0:**
- **9 bot-last FP**: last commenter = `coderabbitai`/`github-actions`/`CLAassistant`/`slangbot`, all stamped `is_bot:false` by `pull-universe.sh:106` (narrow `bot_logins={nv-slang-bot}`). Restamping `is_bot` with full regex (`coderabbit|slangbot|nv-slang-bot|[bot]|CLAassistant|github-actions|copilot|^claude$|devin`) over 151 comments → 15→5. Chains: 11377/11475/11667/12094/12095/12125/12127/12142/slangpy-1054, all maintainer-assigned.
- **5 real-maintainer-owned**: last actor a HUMAN maintainer (jkwak-work/szihs/jhelferty) so bot-restamp can't touch them — needed per-chain assignee/verification (step FOUR) + disposition refresh with a HUMAN_OWNED token. 12177 & 9153/12151 = our PRs **jkwak review:APPROVED** await-merge; 12089 = szihs-authored+assigned PR (mis-threaded, PR actually Fixes #11903); slang-torch-48 = jhelferty release-coordination request (0 comments, false-escalate).
- The `mis_threaded:true` flag on 12089 (PR #12089 body Fixes #11903) is worth surfacing — reused-session artifact.

**NEW structural detail this tick:** normalize_universe.py's disposition injection must OVERWRITE pull-universe's stale/partial copy (state is the verified source of truth after a per-tick refresh), not just fill when absent — 12089 carried an old non-parking `pr_open - ...` disposition that blocked the HUMAN_OWNED gate until overwritten.

**Durable upstream fix still owed (reverts every skill re-sync):** pull-universe.sh — widen bot_logins + emit ISO-Z timestamps + correct is_bot at source; scan.py — HUMAN_OWNED gate already lifted to top of classify() (survived this sync) but bot_logins default still narrow. Recommend routing the pull-universe.sh:106 + timestamp fixes to nanoclaw/coworker-infra as a committed patch, since the per-tick normalize+restamp+refresh is now a mandatory ~4-script dance every 12h.

worktree-vol: 756 GB free (no pressure). GC reap set: slang#11474 (wt 6.9G) + slang#11664 (wt 6.8G) — both issues CLOSED-COMPLETED but with OPEN in-review PRs (#11476, #11665); dispatched save-then-remove w/ live-PR caveat + keep veto to slang-fixer.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784680848889-supervisor-tick-97-scan-py-over-flag-reverted-agai.md`_
