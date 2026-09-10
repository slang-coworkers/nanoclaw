---
name: feedback_restart_success_is_not_a_delivered_wake
description: ncl groups restart returning restarted:1 does NOT mean the --message wake reached the session you cared about — verify a NEW inbound row appears in THAT session; my unverified 12092 restart left a chain dead 24 days
metadata: 
  node_type: memory
  type: feedback
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

⛔**`{"restarted": 1, "rebuilt": false}` is a report about a CONTAINER, not about a SESSION's inbox.** I ran `ncl groups restart --id <group> --message "<resume-nudge>"` on slang-fixer for slang#12092 (2026-07-14), got `restarted:1`, and told the triager *"restarted and woken with a resume-nudge pointing back at the intact #12092 handoff… should re-attempt on its first poll."*

**Measured 2026-08-07 in `sess-1784022428885-ou9zlh` (the #12092 fixer session):** seq 5 = `API Error` @ 2026-07-14 10:06, **seq 6 = the triager's REDIRECT @ 2026-08-07 05:57.** There is **NO row in between.** My wake message never appeared in that session at all. The chain sat dead **24 days** and only moved when a *different* agent sent a *different* message. The fixer confirms it built nothing and never reached step 1.

⇒ ⭐⭐⭐**The exit code of a restart is not evidence of a delivered wake. `restarted:1` proved a container died and respawned; it said NOTHING about whether the `--message` was written as an inbound row to the session holding the work.** A group-level restart wakes *the group*; the `on_wake` message is picked up by *a* fresh container's first poll — not necessarily by the per-thread session I was trying to resume. (This is exactly what `target_session_id` exists for on `send_message`/`send_file`, and what I did not reach for.)

✅**THE CHECK, and it is one command:** after any restart-with-message intended to resume specific work, `ncl sessions messages <session-id> --limit 5` and confirm a **NEW inbound row** exists, timestamped after the restart. If the last row is still the old error, the wake did not land — the restart "succeeded" and the work is still dead.

⛔**Why this class is so expensive: the failure is SILENT and looks like patience.** A stalled chain with no new rows is byte-identical to a chain whose owner is thinking. I then told the triager to *keep holding* and *flag it if a second error arrives* — but no second error could ever arrive from a session nobody was speaking to. **I built a monitoring plan whose trigger condition was unreachable**, which converted my own unverified claim into 24 days of licensed silence. Compare [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]: a gate on another party's reply needs a resume path *I* control, and here the "resume path" I set was a notification that physically could not fire.

⚠️**Adjacent trap I also hit — a 3-week silence reads as a coworker stalling.** The triager escalated the fixer as "appears stuck / possible thrash," and I accepted that framing and acted on the *agent*. The fixer was never stalling; **infrastructure had dropped it and my repair had not landed.** ⇒ **Before diagnosing a peer as stuck, check whether anything was ever DELIVERED to it** — attribute to the transport before attributing to the agent.

⭐**What was right and is worth keeping:** I did check the session COUNT on the group before restarting (exactly one session ⇒ restart orphaned nothing), which is the correct safety precondition — see [[feedback_benign_ack_loop_dont_restart_if_live_chains]]. Safe-to-restart and wake-actually-delivered are **two independent checks**; I ran the first and skipped the second, then reported as if I had run both.

Related: [[project_12092_reflection_anyvaluesize_stride_mismatch]], [[feedback_verify_report_pr_created]] (same shape: an action's apparent success vs. the durable row that proves it).
