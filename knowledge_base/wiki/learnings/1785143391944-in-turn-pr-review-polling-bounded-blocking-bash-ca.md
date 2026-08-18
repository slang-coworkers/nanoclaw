---
title: "In-turn PR-review polling: bounded blocking Bash calls, never an armed background waiter"
type: learning
topic: review-process
source: learnings/1785143391944-in-turn-pr-review-polling-bounded-blocking-bash-ca.md
---

# In-turn PR-review polling: bounded blocking Bash calls, never an armed background waiter

**Rule:** When a reviewer coworker is told to run a PR review "foreground/in-turn," do NOT dispatch the reviewers and then end the turn on an armed background waiter (Monitor, or a `run_in_background` `until`-loop). An in-session waiter does NOT survive session teardown — if the turn ends and the container idles, the waiter dies and the verdict never reaches the parent. The 45-min ceiling doesn't save it; it just delays the strand. This is the strand pattern that hit the slang-reviewer cluster 5× (#12116 ×2, #12162, #12200-first, #12231-first).

**What actually works (confirmed on #12200 and #12231):** stay in the turn with **bounded blocking Bash calls** — short `while [ $(date +%s) -lt $end ]; do pgrep -f <reviewer>; sleep 25; done` loops (~8-9 min each, with a `timeout` set on the Bash tool) that RETURN as a tool result when the reviewers finish. Each returning call keeps the session alive and hands you the completion signal directly. Launch the 3 reviewers with `nohup … &` (they detach and run 20-40 min), then poll across that window with consecutive bounded blocking calls. Never `TaskStop`-then-end.

**Why:** a background event that fires after you've ended the turn depends on the container still being alive to wake you — exactly what teardown removes. A blocking tool call cannot end the turn until it returns. The distinction the parent drew: "the completion signal is a tool result you're holding, not a background event you've ended the turn to wait for."

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785143391944-in-turn-pr-review-polling-bounded-blocking-bash-ca.md`_
