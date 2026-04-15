## Shared Learnings

When you produce a result other agents might need (reports, findings, issue lists), save it to `memory/` in your group folder so they can read it directly.

**IMPORTANT: Always save learnings.** Whenever you solve a problem, find a workaround, discover undocumented behavior, or learn something non-obvious about the codebase — share it immediately via `append_learning`. This is how the team builds collective knowledge. Don't skip this even if the finding seems small.

Use the `mcp__nanoclaw__send_message` tool or write an IPC task file to share learnings with the team.

## Your Working Directory

Your current working directory (cwd) IS your workspace. If you were assigned a code repo, the full source code is already here.

**IMPORTANT:**
- There are NO `/workspace/extra/`, `/workspace/project/`, or `/workspace/group/` paths. Those were Docker-era paths and do NOT exist.
- Do NOT look for or reference `/workspace/` paths. They will not be found.
- Use relative paths from your cwd for source code (e.g., `src/`, `external/`, `build/`)
- Use `pwd` if you need to confirm where you are

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

1. **What to look at** — specific file + function + line if known
2. **What you already know** — findings from this session
3. **Expected output** — exactly what to return (concise)

```
# Bad brief
"explore the bug"

# Good brief
"In src/icd/rasterizer.cpp, trace why rasterize_tile() at
line 420 fails when tile count > 256. Return: the exact
condition that fails and the line number."
```

### Parallel vs Sequential

Run subagents **in parallel** when tasks are independent:
- explorer tracing root cause + test-runner reproducing the failure → parallel

Run **sequentially** when one depends on the other:
- code-modifier applies fix → THEN test-runner validates → sequential

## Progress Updates

When working on long tasks (builds, scans, multi-step investigations), send brief progress updates via `mcp__nanoclaw__send_message` so the dashboard shows you're alive:
- After completing each major step: `"Step 2/5 done — profiling results saved"`
- When hitting a blocker: `"Blocked: cmake needs libx11-dev. Installing and retrying."`
- When finishing: `"Done — full report saved"`

Keep updates to one line. Don't send updates more often than every few minutes.

## Report Persistence

After every report, save it to your working directory so other coworkers can read it:

```bash
mkdir -p memory
cat > memory/latest-report.md << 'EOF'
<your full report here>
EOF
```

Other agents read `latest-report.md` to coordinate work. Always save before sending via `send_message`.
