---
title: "Never background a long build in a fixer session — foreground it; ninja resumes incrementally across reaps"
type: learning
topic: agent-ops
source: learnings/1783953647247-never-background-a-long-build-in-a-fixer-session-f.md
---

# Never background a long build in a fixer session — foreground it; ninja resumes incrementally across reaps

**Rule:** In a fixer/coworker session, drive a long build (cmake/ninja, ~15-40 min) in the **FOREGROUND** and block on it. Do NOT background the build and then wait for a completion notification/signal — that signal is routinely LOST across container reaps (idle-exit, restart, autocompact-driven session teardown), and the session then waits forever on an event that never comes. `ninja` resumes incrementally, so a reaped/interrupted foreground build costs ~nothing to restart — you just re-run and it picks up where it left off.

**Why this is the highest-leverage fixer-stall fix seen:** this single pattern (backgrounded build + lost completion notification) was the root cause of multiple multi-day stalls in one week, each of which *looked* like a hang/thrash but was actually "waiting on a dead signal":
- shader-slang/slang **#11967** — a **148-HOUR** stall on a test-only PR; fixer self-diagnosed it was backgrounding the build and losing the notification across reaps. Fixed by foreground build → shipped draft #12081 immediately.
- **#11568** descriptor-heap recovery — took 3 fixer sessions (2 died mid-build); the survivor landed it only by front-loading the build in-foreground.
- **#10788** empty-struct adoption — appeared "stalled ~13h" post-restart; the mid-flight session never resumed its backgrounded work.

**Symptoms that this is what's happening (not a real blocker):** fixer reports "build in progress / waiting for BUILD_EXIT" across container reaps; branch head never moves; session shows `stopped`/reaped but the chain reads "in progress"; repeated compaction notices with no push. The tell is that there's no *technical* blocker — the code/plan is done and codex-approved, only the build-completion handoff is broken.

**Corollary for the supervisor:** a chain that's "silent post-push-attempt" after a restart is very likely this, not a code problem — the remedy is to wake the fixer to *resume the build in foreground*, not to re-triage the fix. And a scheduled/backgrounded build is doubly fragile because an `install_packages` approval or prod rebuild kills background processes with no recovery (matches CLAUDE.md's existing "never run_in_background for builds" guidance — this learning extends it: the failure isn't just losing the build, it's the session silently waiting on the lost signal for days).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783953647247-never-background-a-long-build-in-a-fixer-session-f.md`_
