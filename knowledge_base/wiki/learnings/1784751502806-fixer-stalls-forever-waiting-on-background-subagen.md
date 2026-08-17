---
title: "Fixer stalls forever waiting on background-subagent completion notification across teardown"
type: learning
topic: agent-ops
source: learnings/1784751502806-fixer-stalls-forever-waiting-on-background-subagen.md
---

# Fixer stalls forever waiting on background-subagent completion notification across teardown

**Rule:** A coworker must NEVER end a turn waiting on a *background* subagent's completion notification to wake it. If a container restart / teardown happens before that notification fires (instruction updates, redeploys, and image rebuilds all restart containers), the notification does not survive — the coworker waits indefinitely for a wake that never arrives. Use a **synchronous blocking Agent subagent** for builds/tests: it returns its result in-turn, and the coworker acts on it within the same turn. (Reinforces the existing build-delegation rule: never `run_in_background` for builds.)

**Why:** Observed on shader-slang/slang#11682 (2026-07-22): slang-fixer implemented the fix, kicked off a *background* master-baseline `slangi` subagent on 07-19 07:01, said "I'll act on its completion notification," and ended the turn. Two instruction-update restarts hit ~07:06-07:08 and tore the container down. The completion notification died with it. The fixer sat idle for **3+ days** — no branch pushed, no PR — until the maintainer (jkwak-work) pinged the bot twice ("I don't see a PR yet") and the orchestrator investigated and re-woke the session.

**How to apply (orchestrator):**
- When a coworker's session goes dark right after "I'll act on the background subagent's completion notification" + turn-end, and a container restart occurred in the gap, treat it as a **dead-promise stall**, not healthy holding. Don't wait for it to self-resume.
- Verify the real state: `ncl sessions list --agent-group-id <grp> --thread-id <thread>` (check `last_active` + `container_status`), tail the session (`ncl sessions messages <sid>`), and check GitHub for the promised artifact (branch/PR). A 404 on the expected branch + a days-old `last_active` right after a background-wait turn-end = confirmed stall.
- Re-wake the coworker's *existing worktree-bearing session* pinned (`target_session_id` + `in_reply_to=<their last outbound>`), instruct it to resume **synchronously** (blocking Agent, not background), and — if the chain has an external stakeholder waiting (a maintainer who pinged) — have the coworker post an honest delay-acknowledging status first.
- Links to related failure modes: this is the coworker-side analogue of `[[feedback_in_session_monitors_dont_survive_teardown]]` (in-session Monitors die on teardown).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784751502806-fixer-stalls-forever-waiting-on-background-subagen.md`_
