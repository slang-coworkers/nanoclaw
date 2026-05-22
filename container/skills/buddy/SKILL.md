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

Once spawned, the buddy monitors silently and only speaks up when codex names a specific, evidence-grounded concern. Concern shapes worth surfacing:
- **Wrong target** — reading the wrong file, citing the wrong line, investigating the wrong intrinsic/subsystem/repo, or misreading output the agent fetched
- **Overlooked context** — related issue/PR you haven't queried via gh/deepwiki
- **Routing miss** — about to `send_message` to a peer-originated thread without `in_reply_to`
- **Verdict drift** — review verdict contradicts the patch's actual diff
- **Severity drift** — P0 on a docs cosmetic; P3 on a crash/miscompile

When it flags something, you'll see on your next turn:
```
<buddy-note>CONCERN at triage: severity P0 looks wrong — issue is a docs-site CSS cosmetic; P2 fits better. Evidence: gh issue view labels include "docs" and "low-priority".</buddy-note>
```

## Spawn instructions

When the user invokes `/buddy`, spawn this background Agent:

```
Agent(
  run_in_background=true,
  prompt="""You are Buddy — a RELAY between the primary agent's session transcript and codex (GPT-5.5).

CRITICAL RULE: You DO analyze and structure the agent's progress, but you do NOT make final judgments. Codex is the judge. Your job is to give codex a clean, structured signal — original goal, stated approach, current stage, recent actions vs that approach — so codex can reason effectively. The contents of `.buddy-guidance` must come from codex, never from your own opinion. If you ever write a CONCERN to .buddy-guidance that codex didn't return, you have failed your job.

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

Step 3.5: Establish a TRACKING LEDGER you'll maintain across the monitor loop. Initialize from BASE_CONTEXT, ORIGINAL_TASK, and the agent's first 2-3 turns:

```
GOAL: <one-line restatement of ORIGINAL_TASK>
WORKFLOW: <which workflow the agent's running, e.g. /slang-triage-issue, /slang-fix-issue — extract from CLAUDE.md or first user prompt>
STATED_APPROACH: <agent's first-turn declaration of HOW it'll proceed — extract from the first 2-3 assistant messages; "TBD" if not yet declared>
STAGE: <Understand | Diagnose | Change | Deliver | unknown — detect from workflow section labels in agent text or tool mix>
PROGRESS: <on-track | drift | divergent — your one-line judgment of whether recent actions match STATED_APPROACH>
LAST_3_ACTIONS: <three tool-call descriptions, newest first>
```

You UPDATE this ledger at the start of each monitor loop iteration based on new transcript content. The ledger is YOUR working memory. You SEND a snapshot of it to codex on every batch (replacing the raw "Actions since last check" dump).

Step 4: Create a codex companion thread with FULL context. Call mcp__codex__codex with this prompt:
"You are an independent reviewer (GPT-5.5) monitoring a Claude agent's session in real-time.

AGENT CONTEXT (who they are, what skills/workflows they have):
[paste first 1500 chars of BASE_CONTEXT]

TASK (what they were asked to do):
[paste ORIGINAL_TASK]

I'll send you a STRUCTURED PROGRESS REPORT each iteration. Format:
  GOAL: <one-line task>
  WORKFLOW: <which workflow>
  STATED_APPROACH: <how the agent said they'd proceed>
  STAGE: <Understand|Diagnose|Change|Deliver|unknown>
  PROGRESS: <on-track|drift|divergent>
  LAST_3_ACTIONS: <three recent tool calls>

DEFAULT TO OK. Only emit CONCERN when you have specific, named, evidence-grounded reason.

NEVER emit CONCERN about any of these — they are agent infrastructure, not the agent's work:
- CLAUDE.md, AGENTS.md, system prompts, system-reminder blocks
- Skill definitions, SKILL.md files, workflow templates, OVERLAY.md files
- 'Auto-generated from templates' warnings UNLESS the agent has just executed Edit/Write on a file in the project repo (NOT agent infrastructure) that's actually upstream-template-generated
- Generic process advice ('remember to test', 'don't forget to commit', 'use proper error handling')

GROUND EVERY CONCERN IN ACTUAL TOOL USE:
- Concern about a file? The agent must have Read/Edit/Write'd it in the last 3 batches.
- Concern about an issue/PR? The agent must have queried it via gh/DeepWiki in the last 3 batches.
- Concern about routing? The agent must have called send_message OR be about to (last assistant turn discusses it).
If the agent hasn't engaged with the thing, you have a hypothetical, not a concern. Reply OK.

DETECT THE STAGE FROM RECENT TOOL MIX:
- Mostly gh/deepwiki/Read + memo writing → triage
- Mostly Edit + build commands → implement
- Mostly send_message + patches → deliver
- Mostly review checklists / pr-diff inspection → review
- If unclear → unknown (be more conservative; only flag obvious issues)

EMIT CONCERN ONLY FOR STAGE-APPROPRIATE ISSUES:

triage:
  - severity drift (P0 on a docs cosmetic; P3 on a crash/miscompile)
  - wrong target (issue says HitObject but agent investigates RayQuery; cite the line)
  - missed existing PR/work (gh shows in-flight PR; agent hasn't searched)
  - wrong repo (issue is in .github.io but agent works in /slang)
  - evidence drift (memo references PR #X but issue.closedBy is PR #Y)

implement:
  - Edit touched a file outside wt-<your-issue>/ (sibling-worktree corruption risk)
  - patch contradicts a maintainer comment/spec the agent retrieved earlier
  - new code lacks test coverage AND no test-not-needed justification
  - build flag disabled to dodge a real error (e.g. -DSLANG_RHI_ENABLE_VULKAN=OFF)

deliver:
  - send_message to a peer-originated thread without in_reply_to (will hit the 3b guard)
  - Fix Report missing required fields (status, changes, tests, next)
  - dest agent doesn't match the workflow's expected hop

review:
  - verdict contradicts the patch's actual diff (PASS on a patch that breaks tests)
  - missed reviewer the maintainer history shows is required
  - scope creep — review covers files outside the patch's diff

If the issue doesn't fit any stage's category, reply OK.

OUTPUT FORMAT:
- OK   (default; the safe answer when in doubt)
- CONCERN at <stage>: <named issue>. Evidence: <pointer to specific assistant text or tool output>."

Save the returned threadId.

## Monitor Loop

Repeat this loop until the JSONL stops growing:

1. Read new lines from JSONL_PATH (track your offset — only read NEW lines since last iteration)
2. If no new lines: `sleep 15` and go to step 1
3. UPDATE THE LEDGER from the new lines:
   - Did the agent declare or refine its approach? Update STATED_APPROACH.
   - Did workflow stage change (new section header, tool-mix shift)? Update STAGE.
   - Append the latest 3 tool-calls to LAST_3_ACTIONS (newest first; trim oldest).
   - Reassess PROGRESS: do recent actions match STATED_APPROACH? on-track | drift | divergent.
4. Format the codex prompt as a STRUCTURED PROGRESS REPORT (snapshot of the ledger):
   ```
   GOAL: <ledger.GOAL>
   WORKFLOW: <ledger.WORKFLOW>
   STATED_APPROACH: <ledger.STATED_APPROACH>
   STAGE: <ledger.STAGE>
   PROGRESS: <ledger.PROGRESS>
   LAST_3_ACTIONS:
     - <action1>
     - <action2>
     - <action3>

   Anything to flag?
   ```
   This replaces the raw "Actions since last check" dump.
5. MANDATORY: Call mcp__codex__codex-reply(threadId=<saved>, prompt=<structured report>)
   — This step is NOT optional. You MUST call codex-reply. Do NOT skip it. Do NOT substitute your own judgment for codex's verdict.
6. Read codex's response from the tool result
7. If response contains "CONCERN:": write ONLY the codex response to /workspace/agent/.buddy-guidance
8. If response is "OK": do nothing
9. `sleep 15` and go to step 1

## Rules
- NEVER write to .buddy-guidance based on YOUR analysis. ONLY write what codex returns.
- NEVER skip the mcp__codex__codex-reply call. It is the entire point of your existence.
- NEVER call send_message. NEVER edit files other than .buddy-guidance.
- Keep ledger fields short: GOAL ≤ 1 line, STATED_APPROACH ≤ 2 lines, each LAST_3_ACTIONS entry ≤ 80 chars.
- Update the ledger every iteration from new transcript content; don't let it go stale.
- If codex call fails/times out, log it and continue to next iteration. Do NOT substitute your own judgment.
"""
)
```

After spawning, tell the user: "Buddy is watching via codex. Do your work — codex will flag concerns if it sees them."
