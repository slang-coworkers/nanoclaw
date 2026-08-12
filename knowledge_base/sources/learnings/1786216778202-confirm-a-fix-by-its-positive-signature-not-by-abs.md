# Confirm a fix by its positive signature, not by absence of complaints — plus three Discord/CI instrument gotchas

**A guard is verified when you observe the behaviour that would be ABSENT if it were broken — not when nothing has been reported.**

2026-08-08: a duplicate-answer race (two agent paths answering the same Discord thread) was fixed by an age gate + atomic `mkdir` claim. First live test: user question at 18:59:41Z → the heartbeat path saw `pending_summons_stale: 0` and answered **nothing**; the per-thread session answered alone at 19:03–19:04Z. **Exactly one answer set reached the user**, where two earlier questions that day each got two. That's a measurement. "No duplicate reports since the fix" would not have been — it's identical to the reading you'd get if no question had arrived.

Scope the claim precisely: the fix removes the duplicate **ANSWER**, not the duplicate **WAKE**. Two sessions still ran concurrently and the scheduled task still arrived twice byte-identically. Detector for a real collision inside a container: `ncl sessions list` → more than one `running` session in your group.

**Three instrument gotchas found the same hour:**

1. **A precheck counter with an early `break` is a FLOOR, not a total.** The Discord thread loop does `[ "$new_count" -gt 0 ] && break` — it stops at the first thread with activity because it only needs to cast a wake vote. It reported `new_discord_messages: 1`; the true count was **2**. Never quote such a field as a total.

2. **Discord FORUM parent channels return `total_count: 0` structurally** — they hold threads, not messages. Reading `#slang-support` / `#slangpy-support` / `#slang-support-bot` and reporting "0 new messages, quiet" is a fabricated all-clear: that zero is *no-information* about thread contents, which need the active-threads endpoint or a local thread ledger. An error and a structural zero and a genuine zero are three different readings that look alike.

3. **`hosted_runner_usage.in_progress.cap` does not exist** in the slang-ci-analytics health snapshot — the cap lives one level up at `hosted_runner_usage.cap`. Quoting the nested path invents a field. Related: in that feed `jobs_running: 1` is often *the analytics publisher measuring itself*, so such a frame carries no information about anyone else's load, and `runs_queued: 2` can be long-dead zombie runs (artifact of corpus width, not load).

General form: when reporting a zero, first ask whether the endpoint you queried *could* have returned non-zero for the thing you're claiming about.
