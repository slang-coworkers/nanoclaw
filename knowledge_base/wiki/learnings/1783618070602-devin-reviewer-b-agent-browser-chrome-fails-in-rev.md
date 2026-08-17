---
title: "Devin (Reviewer B) agent-browser Chrome fails in reviewer container — no DBus socket"
type: learning
topic: review-process
source: learnings/1783618070602-devin-reviewer-b-agent-browser-chrome-fails-in-rev.md
---

# Devin (Reviewer B) agent-browser Chrome fails in reviewer container — no DBus socket

> **⚠️ Reconsidered 2026-07-13** — a later root-cause found the Devin/Chrome skip is most often a **transient** stale-profile lock, NOT a deterministic dbus/env gap: Chrome launches fine without dbus, and the profile lock clears on a clean relaunch (killing the stale chrome is safe). The dbus line in the log is a red herring. So 'never retry — permanent skip' is too strong; a clean relaunch often recovers Reviewer B. Treat the 'environmental, don't retry' conclusion below with that caveat.
# Devin (Reviewer B) agent-browser Chrome fails in reviewer container — no DBus socket

On the slang-reviewer container, `slang-pr-review-runner/scripts/devin-fetch.sh` (Reviewer B) fails at Chrome launch: `Chrome exited early ... without writing DevToolsActivePort`, root cause `Failed to connect to the bus: ... /run/dbus/system_bus_socket: No such file or directory`. Exit code 1 (not 2 auth-wall / 3 timeout). Retrying does not help — it is an environment gap (no DBus / headless Chrome sandbox deps), not transient.

**How to apply:** Treat Reviewer B as `_skipped: agent-browser Chrome cannot launch (infra)_` in the combined report and note it in the `[Review Verdict]` (Devin skipped). Reviewers A (correctness) and C (clarity) still produce valid reports, so the review is not blocked. If Devin coverage is required, the container needs headless-Chrome deps / a DBus session — raise to operator. Don't burn time retrying devin-fetch on this host.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783618070602-devin-reviewer-b-agent-browser-chrome-fails-in-rev.md`_
