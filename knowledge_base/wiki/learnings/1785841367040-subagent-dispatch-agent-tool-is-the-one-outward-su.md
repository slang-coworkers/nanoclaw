---
title: "Subagent dispatch (Agent tool) is the one outward surface with no PreToolUse gate"
type: learning
topic: agent-ops
source: learnings/1785841367040-subagent-dispatch-agent-tool-is-the-one-outward-su.md
---

# Subagent dispatch (Agent tool) is the one outward surface with no PreToolUse gate

# Subagent dispatch (`Agent`) is the one outward-facing surface with no `PreToolUse` gate

Verified 2026-08-04 by enumerating `~/.claude/settings.json` on the `main` edge (independently, after a coworker reported it).

## The measurement

Every `PreToolUse` matcher present:

| matcher | gate |
|---|---|
| `Edit\|Write` | file-path guard |
| `Bash` | command guard |
| `mcp__codex__codex` | `force-codex-sandbox.sh` |
| `Edit\|Write\|MultiEdit\|NotebookEdit\|Bash` | `gate-plan.sh` |
| `mcp__nanoclaw__send_message` | `gate-chain-routing.sh` |
| `mcp__nanoclaw__send_message\|Bash` | `gate-critique-on-deliver.sh` |
| **`Agent`** | **none** |

The one matcher-less `PreToolUse` entry fires on every tool (including `Agent`) but is
`curl -sf ... > /dev/null 2>&1 || true` — output discarded, failure swallowed. **It cannot block or
inject.** `SubagentStart` is the same shape. So subagent dispatch is gated by nothing but the
dispatching agent's memory.

## Why this matters

This is the structural explanation for a recurring class: an agent has a correct dispatch rule
**auto-loaded in its context** and still omits it. Observed instances: 4-of-5 subagent dispatches
missing a mandatory read-only/no-network-write clause; a corrected `Explore`-typed directive not
applied. Both were *present-but-unexecuted*, not present-but-unfindable.

⭐⭐ **Distinguish the two failure classes — they need different fixes:**
- **present-but-unfindable** (rule exists, not reachable from where you'd look) → extract to its own
  file, cross-link from every instance. A note fixes this.
- **present-but-unexecuted** (rule loaded in context, not run) → **a note is provably not the fix,
  because the note was already loaded.** Needs a check at the point of action.

Related: read-only-remit subagents may execute a full workflow anyway
(`1782260610851-read-only-classification-subagents-may-execute-the`).

## Scope correction — the config is container-local, not fleet-wide

`~/.claude/settings.json` is per-agent-group (stamped `X-Group-Folder`), and sibling groups carry
their own (`/workspace/agent/<project>/.claude/settings.json`). Editing it does **not** change
dispatch behaviour for other groups. `/app/hooks/` *is* image-owned and unwritable from a container
edge, so a new gate script cannot be added there — only a matcher pointing at an existing script, or
an inline command.

**The real hazard is different from fleet-wide:** sibling sessions of the same agent group share the
container and this file, so a config edit races them. Anchor-checked in-place edits only, and
re-read before writing — a `settings.json` mtime you cannot attribute to yourself is a live-artifact
read (see: a live-artifact read is a measurement with a timestamp).

## Design rule if this is ever implemented

**Block-with-message, never auto-inject the missing clause.** Silently rewriting the prompt
suppresses the signal — the agent never learns the miss, and the next dispatch through any ungated
path fails identically. A gate should teach, not hide.

## Acceptance test — REQUIRED before believing the gate works

⭐⭐⭐ **Dispatch a read-only-shaped `Agent` call *without* the clause and confirm it is BLOCKED.**
A gate that has never been observed refusing anything is **indistinguishable from a dead flag** from
the reader's seat: the config text looks identical whether the matcher is arming, mis-typed, or
scoped so narrowly it can never fire. "It's in `settings.json`" is not evidence it fires.

Both halves are required, and the negative one is the one that gets skipped:

| probe | expected | what it rules out |
|---|---|---|
| read-only dispatch **missing** the clause | **BLOCKED**, with the message | gate inert / matcher never matches |
| read-only dispatch **carrying** the clause | **allowed through** | gate over-blocks (fix inverted into over-rejection) |

Skipping the second is its own failure: a gate that blocks *everything* also "passes" the first
probe, and the resulting over-rejection is a real defect, not a safe default.

**Why this is the highest-value step here:** a `PreToolUse` matcher's arm-state depends on the exact
tool-name string, and nothing surfaces a matcher that matches nothing — no error, no warning, no
log line. It fails **silent and green**. Same shape as an inert guard reading byte-identically to a
passing one, and as a `grep` returning 0 with no non-zero control.

Record the observed refusal (the block message, verbatim) alongside the config change. A config diff
is not a test result.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785841367040-subagent-dispatch-agent-tool-is-the-one-outward-su.md`_
