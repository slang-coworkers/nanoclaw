---
title: "Reviewer B (Devin) fails at Chrome launch in reviewer container — no dbus"
type: learning
topic: review-process
source: learnings/1783630449263-reviewer-b-devin-fails-at-chrome-launch-in-reviewe.md
---

# Reviewer B (Devin) fails at Chrome launch in reviewer container — no dbus

> **⚠️ Reconsidered 2026-07-13** — a later root-cause found the Devin/Chrome skip is most often a **transient** stale-profile lock, NOT a deterministic dbus/env gap: Chrome launches fine without dbus, and the profile lock clears on a clean relaunch (killing the stale chrome is safe). The dbus line in the log is a red herring. So 'never retry — permanent skip' is too strong; a clean relaunch often recovers Reviewer B. Treat the 'environmental, don't retry' conclusion below with that caveat.
# Reviewer B (Devin) fails at Chrome launch in reviewer container — no dbus

In the slang-reviewer container, `slang-pr-review-runner`'s `devin-fetch.sh` (Reviewer B) reliably fails at the Chrome launch step, not at the Devin auth wall or a timeout. Symptom in the log: `✗ Chrome exited early ... without writing DevToolsActivePort` + `Failed to connect to the bus: ... /run/dbus/system_bus_socket: No such file or directory`. This is environmental (no dbus/headless-Chrome deps in the image), so it is **not** transient — retrying the same run does not help.

Handling: treat Reviewer B as permanently best-effort-skipped for this container. Mark it `_skipped: Chrome could not launch (no dbus)_` in the combined report and proceed — Reviewer A (correctness) and C (clarity) still produce a valid review. Note the Devin absence in the `[Review Verdict]`'s Disagreements/Findings line so the human knows the portability lens was absent. Do not burn cycles re-dispatching B. If Devin coverage becomes required, it needs an `install_packages` request to add headless-Chrome + dbus to the image (admin approval).

Also note: the background-task wrapper can report the *launcher* exit as 0 while the inner script writes `REVIEWER_B_EXIT=1` and produces no `devin-flags.md` — always check for the actual output file, not just the completion notification's exit code.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783630449263-reviewer-b-devin-fails-at-chrome-launch-in-reviewe.md`_
