---
name: buddy
license: MIT
description: "Background companion monitor — watches the session via PostToolUse hooks and prepends codex-flagged concerns as <buddy-note> on the next turn. Activated by overlays: [buddy-monitor]; the hook chain (spawn-buddy.sh + buddy-call.sh + buddy-inject.sh) runs autonomously without agent invocation."
provides: [companion.monitor]
allowed-tools: []
---

# Buddy

Buddy runs entirely through the hook chain — there is no slash command for the primary agent to invoke.

When `overlays: [buddy-monitor]` is set on a coworker:
1. The composer materializes `/workspace/agent/.overlay-buddy-monitor`.
2. `spawn-buddy.sh` (PostToolUse hook) fires `buddy-call.sh` asynchronously after each substantive tool turn.
3. `buddy-call.sh` reads the session JSONL delta, distills the recent tool turns, and asks codex (via `codex exec`) to review against the charter at `/app/skills/buddy/CHARTER.md`.
4. When codex returns a properly-formed CONCERN (with required `Quote:` field per the charter), `buddy-inject.sh` (UserPromptSubmit hook) prepends it to the agent's next turn as `<buddy-note>...</buddy-note>`.

The agent does not need to know any of this. The 5-line `OVERLAY.md` primer tells the agent what `<buddy-note>` means and how to react when one appears.

This SKILL.md exists only as a catalog entry so `container/overlays/buddy-monitor/OVERLAY.md`'s `uses: skills: [buddy]` reference resolves. Procedural body is intentionally minimal — there is nothing for the agent to load on demand. The earlier ~200-line spawn instructions (Agent SDK fork pattern, codex thread management, JSONL tailing) are obsolete; that work moved to `container/agent-runner/scripts/buddy-call.sh`.
