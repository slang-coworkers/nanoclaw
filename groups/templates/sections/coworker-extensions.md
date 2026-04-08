## Shared Learnings

When you produce a result other agents might need (reports, findings, issue lists), save it to `/workspace/group/memory/` so they can read it directly from your group folder without querying the database.

**At session start**, read `/workspace/global/learnings/INDEX.md` for a summary of discoveries shared by other coworkers. Read individual files only when relevant to your current task.

**IMPORTANT: Always save learnings.** Whenever you solve a problem, find a workaround, discover undocumented behavior, or learn something non-obvious about the codebase — share it immediately via `append_learning`. This is how the team builds collective knowledge. Don't skip this even if the finding seems small.

```bash
cat > /workspace/ipc/tasks/learn_$(date +%s).json << 'EOF'
{
  "type": "append_learning",
  "content": "# Discovery Title\n\nWhat you learned and why it matters."
}
EOF
```

This writes to the shared learnings directory on the host. Other coworkers will see it on their next session.

Learnings paths:
- **Read from**: `/workspace/global/learnings/` (non-main) or `/workspace/project/groups/global/learnings/` (main)
- **Write via**: IPC `append_learning` task (as shown above)

## Available Subagents

Three subagents are available via the `Agent` tool for parallelising work:

| Subagent | Model | Tools | Use for |
|----------|-------|-------|---------|
| `explorer` | haiku | Read, Grep, Glob, WebFetch | Tracing call paths, finding implementations, grepping patterns |
| `test-runner` | sonnet | Bash, Read | Running tests, reproducing failures, validating fixes |
| `code-modifier` | sonnet | Read, Edit, Bash, Grep | Applying targeted fixes, running affected test after |

### Brief First

Before spawning subagents, confirm you have enough to brief them properly:
- The specific issue, file, or test involved
- Any reproduction steps or known symptoms
- What output you need back

If the task is vague, ask the user for clarification before proceeding.

### Briefing Rule

Subagents start with **zero context**. Every subagent prompt must include:

1. **Workspace path** — `/workspace/group/` (or specific project dir)
2. **Specific target** — file + function + line if known
3. **What you already know** — findings from this session
4. **Expected output** — exactly what to return (concise)

```
# Bad brief
"explore the bug"

# Good brief
"In /workspace/group/<project>, trace why <function>() at
<file.cpp> fails when <condition>. Issue #<N>. Return: the exact
condition that fails and the line number."
```

### Parallel vs Sequential

Run subagents **in parallel** when tasks are independent:
- explorer tracing root cause + test-runner reproducing the failure → parallel

Run **sequentially** when one depends on the other:
- code-modifier applies fix → THEN test-runner validates → sequential

## Progress Updates

When working on long tasks (builds, scans, multi-step investigations), send brief progress updates via `mcp__nanoclaw__send_message` so the dashboard shows you're alive:
- After completing each major step: `"Step 2/5 done — profiling results saved to memory/"`
- When hitting a blocker: `"Blocked: cmake needs libx11-dev. Installing and retrying."`
- When finishing: `"Done — full report in memory/latest-report.md"`

Keep updates to one line. Don't send updates more often than every few minutes.

## Report Persistence

After every report, save it so other coworkers can read it:

```bash
cp /workspace/group/memory/latest-report.md /workspace/group/memory/report-$(date +%Y-%m-%d).md 2>/dev/null
cat > /workspace/group/memory/latest-report.md << 'EOF'
<your full report here>
EOF
```

Other agents read `latest-report.md` to coordinate work. Always save before sending via `send_message`.
