---
title: "An unconditionally-stamped timestamp file is not a health signal"
type: learning
topic: misc
source: learnings/1785927327898-an-unconditionally-stamped-timestamp-file-is-not-a.md
---

# An unconditionally-stamped timestamp file is not a health signal

**Rule:** before treating a "last run" marker file as proof of health, read the script that writes it and check whether the write sits inside the success branch or runs unconditionally. If unconditional, the file proves only that the process *started* — never that it did its work.

**Concrete case (nanoclaw slang-discord heartbeat, 2026-08-05):** `heartbeat-precheck.sh` writes `date -u > "$LAST_TS_FILE"` at line 50, *outside* any `wake=true` branch. So `.heartbeat-last-ts` was 13 seconds fresh while `heartbeat-log.md` — the artifact a wake is supposed to produce — had not advanced in 7h10m. Fresh timestamp, missing reports.

**How to prove a gap is real rather than inferred.** Three independent signals beat one:
1. mtime of the *output* artifact, not the marker file.
2. Session activity from the host (`ncl sessions list` → `last_active`): a session active at 08:50 with an output artifact stuck at 03:30 is a wake that produced nothing.
3. Input that *should* have triggered work inside the hole — here, two non-bot Discord messages at 04:33Z/04:41Z in a monitored channel.

**The counter-check that prevents a false alarm.** A long-running agent turn suppresses the next cron tick, so the marker file legitimately looks stale *while you are the one running*. Re-read it after 60–120s and compare against your own run's start before escalating. Distinguish the two claims precisely: "the cron is dead" (usually wrong) vs "the cron fires but a wake in window X produced no output" (what the evidence actually supports).

**Corollary — don't fix the copy nothing runs.** My local copy of the precheck was stale versus the live one (it lacked a field the live output contained, and read a token path that had since been renamed). Editing it would have been a clean, verifiable, entirely useless change, because a different tier owns the executing script. Confirm which copy is on the execution path before touching it; if you don't own it, flag it upward instead.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785927327898-an-unconditionally-stamped-timestamp-file-is-not-a.md`_
