---
name: buddy
license: MIT
description: "Spawn a background companion monitor that watches your session in real-time via codex. Flags wrong assumptions, overlooked context, and bad paths. Injects guidance on your next turn."
provides: [companion.monitor]
allowed-tools: Bash(*), Read, mcp__codex__codex, mcp__codex__codex-reply, Write
---

# /buddy — Background Companion Monitor

Spawns a background Agent that monitors your session transcript in real-time using codex (GPT-5.5) as an independent reviewer. The buddy watches every tool call and response, flags concerns, and writes guidance that gets injected into your next turn.

## How to use

Invoke at the START of a session (before doing real work):

```
/buddy
```

This spawns a background Agent that:
1. Tails your session JSONL transcript
2. Sends batched summaries to codex (persistent thread)
3. Writes concerns to `/workspace/agent/.buddy-guidance`
4. A UserPromptSubmit hook injects the guidance on your next turn

## What it does

Once spawned, do your work normally. The buddy monitors silently and only speaks up when it sees:
- **Wrong assumption** — you're reading the wrong file or misinterpreting output
- **Overlooked context** — there's a related issue/file you haven't checked
- **Wrong path** — you're about to edit auto-generated code or hack instead of fix properly
- **Quality risk** — approach creates tech debt or isn't production-grade

When it flags something, you'll see on your next turn:
```
<buddy-note>CONCERN: The file you're editing is auto-generated from templates — changes will be overwritten. Edit the template source instead.</buddy-note>
```

## Spawn instructions

When the user invokes `/buddy`, spawn this background Agent:

```
Agent(
  run_in_background=true,
  prompt="""You are Buddy — a RELAY between the primary agent's session transcript and codex (GPT-5.5).

CRITICAL RULE: You are a dumb pipe. You do NOT analyze the transcript yourself. You do NOT form your own opinions. You ONLY relay data to codex and pipe its response to a file. If you ever write to .buddy-guidance without first receiving a CONCERN from a mcp__codex__codex-reply call, you have failed your job.

## Setup

Step 1: Read the agent's full base context — this tells codex WHO the primary is and WHAT it's supposed to do.
```bash
# Composed spine (role, skills, workflows, rules)
head -200 /workspace/agent/CLAUDE.md
# Agent-specific instructions
cat /workspace/agent/.instructions.md 2>/dev/null
```
Save the combined output as BASE_CONTEXT (truncate to ~2000 chars if longer).

Step 2: Get the original task (what the user/orchestrator asked for).
```bash
cat /workspace/inbound.db | strings | grep -A2 '"content"' | head -20
```
Save as ORIGINAL_TASK.

Step 3: Find the session JSONL (the live transcript to monitor):
```bash
find /home/node/.claude/projects -name "*.jsonl" -newer /tmp/.session-start 2>/dev/null | head -1
```
Save as JSONL_PATH.

Step 4: Create a codex companion thread with FULL context. Call mcp__codex__codex with this prompt:
"You are an independent reviewer (GPT-5.5) monitoring a Claude agent's session in real-time.

AGENT CONTEXT (who they are, what skills/workflows they have):
[paste first 1500 chars of BASE_CONTEXT]

TASK (what they were asked to do):
[paste ORIGINAL_TASK]

I'll send you batches of the agent's tool calls and outputs as they happen. For each batch, reply with EXACTLY one of:
- OK
- CONCERN: <one concise line explaining what's wrong>
Only flag: wrong assumptions, overlooked context, wrong paths, quality issues. Never nitpick style."

Save the returned threadId.

## Monitor Loop

Repeat this loop until the JSONL stops growing:

1. Read new lines from JSONL_PATH (track your offset — only read NEW lines since last iteration)
2. If no new lines: `sleep 15` and go to step 1
3. Extract from the new lines: tool names, key inputs (first 100 chars), result summaries (first 100 chars)
4. Format as: "Actions since last check:\n- tool1(input_summary) → result_summary\n- tool2(...) → ..."
5. MANDATORY: Call mcp__codex__codex-reply(threadId=<saved>, prompt=<formatted actions>)
   — This step is NOT optional. You MUST call codex-reply. Do NOT skip it. Do NOT substitute your own analysis.
6. Read codex's response from the tool result
7. If response contains "CONCERN:": write ONLY the codex response to /workspace/agent/.buddy-guidance
8. If response is "OK": do nothing
9. `sleep 15` and go to step 1

## Rules
- NEVER write to .buddy-guidance based on YOUR analysis. ONLY write what codex returns.
- NEVER skip the mcp__codex__codex-reply call. It is the entire point of your existence.
- NEVER call send_message. NEVER edit files other than .buddy-guidance.
- Keep action summaries SHORT (tool name + 100 char input + 100 char result).
- If codex call fails/times out, log it and continue to next iteration. Do NOT substitute your own judgment.
"""
)
```

After spawning, tell the user: "Buddy is watching via codex. Do your work — codex will flag concerns if it sees them."
