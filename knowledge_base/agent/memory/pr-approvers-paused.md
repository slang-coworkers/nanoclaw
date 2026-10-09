---
type: guardrail
description: Both PR approvers are operator-paused; check `paused` before dispatching any approver webhook
---

# PR approvers are paused: check before dispatching

**State (last verified 2026-10-09, at slang#13485):** `slangpy-pr-approver` (`ag-1783611156448-d49n0a`) and
`slang-pr-approver` (`ag-1783611156430-vvj8oi`) are both `paused=1`. Neither has processed a
message since about 2026-09-10. Whether to unpause them is the operator's call. I asked on
2026-09-29 (dashboard msg 29) with three options: keep both paused / resume slangpy only / resume
both. Unpausing is admin-approval-gated, so I never unpause without an explicit answer.

**Rule:** before forwarding a `pr_ready_for_review` webhook (opened or synchronize) to either
approver, run `ncl groups list` and read the `paused` column. A paused group does not wake. The
message sits unread in its session, so each extra synchronize forward only adds another queued
dispatch naming a head that will be stale by the time it is read. If the approver is paused:
- don't forward the webhook;
- add the PR, its approver session id and its live head to the pause follow-up task's prompt
  (`approver-pause-followup-b5f2`);
- tell the operator in one line, on the first event only. A later event for the same PR (a
  synchronize, or a draft→`ready_for_review` re-fire) gets nothing more than the `paused` check: the task prompt tells the follow-up to read the live
  head with `gh` at dispatch time, so there's no need to re-edit the prompt on each push.
  slangpy#1199 had 4 synchronizes in a day.

**Why:** on 2026-10-01 I forwarded slangpy#1198 three times (opened plus two synchronizes)
before noticing the pause. It happened again with slangpy#1192 (four forwards, 09-30 to 10-01), because
the check was skipped on the opened event. Again 10-01 with slang#13370: forwarded on its first
event. And slang-rhi#739: three forwards (09-29 ×2, 10-01) before the check caught it on 10-02. And slang-rhi#865 on 10-02: three forwards (opened + 2 synchronize) in one session, check run only on the 4th event — the Map line alone does not get read at webhook time. And slang#13219 (09-30 → 10-02): five forwards (ready_for_review + 4 synchronize) before the check ran on the 6th — the Core Memory line was loaded the whole time, and I improvised a "debounce" note to a paused approver instead of checking. And slang#12249 (09-30): two forwards (f226f26b65, 30c856ff24) with no check at all; I read the #11075 chain record instead of this file, and caught it on the 3rd event (10-02). And slang#13360 (10-01 opened): forwarded with no check; caught on the 2nd event (10-03 synchronize). And slang-rhi#841: R7 + a coalesce note forwarded 09-15/09-16, after the pause began, with no check; caught 10-03. And slang#13371: forwarded on its 10-01 synchronize with no check, right in this session; caught on the 2nd event (10-03). And slang#12935: forwarded 09-27 (head d5d5924d) with no check, well after the pause began; caught 10-05. And slang#13232: two forwards on 09-29 (ready_for_review, then synchronize naming a7df8bab), both in the same session, with no check; caught on the 3rd event (10-05). And slang#13316: forwarded on its 09-29 synchronize with no check; caught on the 2nd event (10-05). And slangpy#1164: opened + 2 synchronizes forwarded 09-16/09-17 in one session with no check (I even wrote "head moved, re-evaluate" notes to a paused approver); caught on the 4th event (10-06). And slang#13328: forwarded on its 09-29 ready_for_review with no check, even though the Core Memory line was loaded and I'd just grepped memory for `pr-approver` (hits in feedback notes, so I took the routing rule from there and never opened this file); caught on the 2nd event (10-06 synchronize). And slang#11709: forwarded on its 09-29 synchronize with no check. I grepped `pr-approver|pr_ready_for_review` with `head_limit 20`, this file was not in the 20 results, and I took the chain record's warnings as the routing context. Caught on the 2nd event (10-06). And slang#13303: two forwards on 09-29 plus a 09-30 "re-drive" after the container-stop notice, all with no check. I read its in-only rows and "no cost_cap row" as lost in-flight work rather than as the pause signature below, and told the operator it was re-driven. Caught on the 4th event (10-07 synchronize). A resume notice is not an exemption: run the check before any re-drive too. A long-running chain I'd dispatched to six times before the pause is the easiest one to forward on reflex. The always-loaded index Map line already said "check `paused` before routing any approver
webhook", and I went to grep instead; my grep pattern matches this file's text, but the output was
cut at `head_limit 10` and this file wasn't among the ten shown. Act on the index line itself; a truncated search is not a negative. Run the check on the very first event, not only once a PR repeats. A sign that the target is paused: the approver session shows only
`in` rows, and `ncl cost-cap status --session` reports "no cost_cap row yet", meaning the
container never started.

**Prompt edits race.** Each webhook runs in its own session, and `ncl tasks update --prompt` replaces the whole prompt. On 2026-10-02 the slang-rhi#887 and #888 sessions edited it at the same minute, and #888's write disappeared with no error. After an update, re-read the prompt and confirm your PR is in it. If it's missing, re-apply your entry to the prompt as it now stands. That means a fresh `ncl tasks get` right before the write, not the file you built from your first read. On 10-07 (slang#13479) my first write was lost, and the retry re-sent that cached file, which overwrote slangpy#1210's entry. Diff the before and after prompts for other sessions' PRs, not just your own.

**A silent approver session may be paused rather than out of budget.** On 10-01 I diagnosed #12136's silence
as a cost escalation and asked continue/lapse without checking `paused`. The R7/R9 dispatches were sent
after the pause began. Check both before asking the operator to pick a remedy. Same miss on 10-01 with #12446: I called a 3-dispatch silence a single stuck session, sent a re-wake (#93) to a paused approver, and told the operator that the approver was "still handling other PRs today". Those other sessions were `in`-only too: created, never run.

**Lost-update hazard:** several of my sessions read, modify and write `approver-pause-followup-b5f2`'s prompt.
My 10-02 #1192 entry was gone by 10-05, overwritten by another session's write. After an
`ncl tasks update --prompt`, re-read the entry; on the next event, check that it is still there.

**Follow-up timer:** `approver-pause-followup-b5f2` was itself `paused` and past due on
2026-10-01, so the pending decision had no live timer. Who paused it, and why, is unknown, so I
didn't resume it on my own authority.
