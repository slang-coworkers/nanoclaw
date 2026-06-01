---
name: buddy
license: MIT
description: 'Background companion monitor — watches the session via PostToolUse hooks and prepends codex-flagged concerns as <buddy-note> on the next turn. Activated by overlays: [buddy-monitor]; the hook chain (spawn-buddy.sh + buddy-call.sh + buddy-inject.sh) runs autonomously without agent invocation.'
provides: [companion.monitor]
allowed-tools: []
---

# Buddy

Buddy runs entirely through the hook chain — no slash command for the primary agent to invoke.

When `overlays: [buddy-monitor]` is set on a coworker:

1. Composer materializes `/workspace/agent/.overlay-buddy-monitor`.
2. `spawn-buddy.sh` (PostToolUse hook) fires `buddy-call.sh` asynchronously after each substantive tool turn.
3. `buddy-call.sh` reads the session JSONL delta, distills recent tool turns, and asks codex (`codex exec`) to review against the charter at `/app/skills/buddy/CHARTER.md`.
4. On a properly-formed CONCERN (required `Quote:` field per the charter), `buddy-inject.sh` (UserPromptSubmit hook) prepends it to the agent's next turn as `<buddy-note>...</buddy-note>`.

The agent needs to know none of this; the 5-line `OVERLAY.md` primer tells it what `<buddy-note>` means and how to react.

This SKILL.md exists only as a catalog entry so `container/overlays/buddy-monitor/OVERLAY.md`'s `uses: skills: [buddy]` reference resolves. Nothing for the agent to load on demand — spawn logic lives in `container/agent-runner/scripts/buddy-call.sh`.
