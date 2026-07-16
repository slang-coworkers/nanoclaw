---
name: feedback_scan_py_overflags_bot_logins_dispositions
description: "scan.py over-flags needs_nudge — coderabbit/slangbot absent from bot_logins + pull-universe omits dispositions; verify, don't blast"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c155d051-5657-4d95-bac6-caa24f4a3f29
---

Supervisor tick 87 (2026-07-15): `scan.py` flagged **102 needs_nudge / 7 escalate** out of 167 in-flight — ~100× the verified steady-state (tick 67 fired 0/31, tick 86 fired 1). All 102 resolved to NOT-our-ball on inspection. **0 nudges was correct.**

Two structural false-positive sources, both in the tooling, not the chains:

1. **`pull-universe.sh` does not inject prior-state `disposition` into chain payloads.** `scan.py`'s bot-last carve-out (`we_owe_next_step`, reads `chain["disposition"]`) therefore can't park maintainer-driving / human-debate / reviewer-gated / stood-down chains. Fix each tick: read `memory/supervisor-state.json`, map `{thread_id: disposition}`, inject into `uni['chains'][tid]['disposition']`, re-run scan. Drops flags but NOT enough (the `ball==ours` path ignores disposition by design).

2. **`scan.py` default `bot_logins` = only `nv-slang-bot`.** So `coderabbitai` and `slangbot` review comments read as "human spoke last → awaiting_us" even when we pushed after. ~15+ chains/tick are pure coderabbit-last false positives.

**The decisive verification test** (apply to every flagged row before nudging): a flag is a false positive if EITHER (a) the last comment author matches `coderabbit|slangbot|nv-slang-bot|[bot]`, OR (b) our_last_outbound/our_last_push ≥ last comment time (we already answered), OR (c) the carried disposition contains a parking token (`maintainer-driving|human-debate|external-pr|reviewer-gat|awaiting-pickup|stood-down|advisory|held|blocker|escalat|auto-retry|lingering session`). After all three filters, the genuine survivors are typically <5 and each still needs a per-chain look (maintainer-assigned? approved-pending-merge? stale sub-thread on a CLOSED issue?).

**Why 0 nudges is usually right:** in steady state maintainers (jkwak-work, szihs, jhelferty-nv, skiminki-nv, pdeayton-nv, jvepsalainen-nv) spoke last *because they own the chain* — we correctly stood down. A maintainer's last word on a chain they're assigned to is a handoff, not an owed reply. See [[feedback_dead_promise_check_assignee_before_rewake]], [[feedback_holding_echoes_are_noise]].

Blind-firing scan's raw `needs_nudge` would be a spam incident that re-wakes dozens of settled/parked chains. The skill's "`needs_nudge=true` is authoritative" MUST-rule assumes scan had dispositions + full bot_logins; when it doesn't (current pull-universe), the supervisor's judgment call is mandatory.
