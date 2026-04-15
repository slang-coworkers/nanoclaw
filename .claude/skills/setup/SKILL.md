---
name: setup
description: Run initial NanoClaw local setup. Use when user wants to install dependencies, configure repos, compile the agent runner, or start the dashboard. Triggers on "setup", "install", "configure nanoclaw", or first-time setup requests.
---

# NanoClaw Local Setup

Run setup steps automatically. Only pause when user action is required (choosing repos, providing paths). This branch runs agents as local Node.js processes in git worktrees — no Docker required.

**Principle:** When something is broken or missing, fix it. Don't tell the user to go fix it themselves unless it genuinely requires their manual action. If a dependency is missing, install it. Ask the user for permission when needed, then do the work.

## 0. Prerequisites

Check Node.js, Git, and Claude Code are available:

```bash
node --version
git --version
claude --version 2>/dev/null || echo "CLAUDE_CODE_EXECPATH=$CLAUDE_CODE_EXECPATH"
```

**Node.js missing or < v20:**
- Windows: `winget install OpenJS.NodeJS.LTS --source winget`
- macOS: `brew install node@22` or `nvm install 22`
- Linux: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`

After installing, verify with `node --version`.

**Git missing:** Install git for the platform. Windows: `winget install Git.Git --source winget`.

**Claude Code missing:** The user must have Claude Code installed and logged in. Check `claude --version`. If not found, check `$CLAUDE_CODE_EXECPATH`. If neither works, tell the user to install Claude Code first: https://docs.anthropic.com/en/docs/claude-code

## 1. Install Dependencies

```bash
npm install
```

If `better-sqlite3` fails to build (no prebuilt binary for this Node version):
- Windows: install Visual Studio Build Tools (`npm install -g windows-build-tools`) or update `better-sqlite3` version
- macOS: `xcode-select --install`
- Linux: `sudo apt-get install -y build-essential python3`

Then retry `npm install`.

## 2. Compile Agent Runner

```bash
cd container/agent-runner && npm install && npm run build && cd ../..
```

If this fails, read the error. Common issues:
- Missing `@anthropic-ai/claude-agent-sdk` — run `npm install` in `container/agent-runner/`
- TypeScript errors — run `npx tsc --noEmit` to see details

## 3. Configure Repos

Read the current seed config:

```bash
cat groups/seed.json
```

The `repos` map defines named repo paths. Each agent references a repo by name.

Ask the user: **What repos do you want agents to work on?**

For each repo they mention:
1. Ask for the local path (e.g. `D:/corvk`, `~/projects/myrepo`)
2. Verify the path exists and is a git repo: `git -C <path> rev-parse --git-dir`
3. Add it to `groups/seed.json` under `repos`

Example result:
```json
{
  "repos": {
    "corvk": "D:/corvk",
    "myproject": "C:/Users/me/projects/myproject"
  },
  "groups": [
    {
      "jid": "dashboard:main",
      "name": "Main Orchestrator",
      "folder": "main",
      "trigger": "@Andy",
      "isMain": true
    }
  ]
}
```

**If the user wants to pre-create agent groups for a repo**, add them to the `groups` array with a `repo` field:

```json
{
  "jid": "dashboard:corvk-qa",
  "name": "corvk qa",
  "folder": "corvk-qa",
  "trigger": "@corvkqa",
  "repo": "corvk"
}
```

Each agent with a `repo` field gets its own isolated git worktree from that repo automatically.

**If the user doesn't want to pre-create agents**, that's fine — the Main Orchestrator can create them dynamically via the dashboard.

## 4. Run Verification

```bash
npm run setup
```

This runs the automated local setup check (`setup/local.ts`). Parse the output:

- **NODE:** Must show a version >= 20
- **GIT:** Must show git version
- **CLAUDE_CODE:** Must show Claude Code version
- **AGENT_RUNNER:** Must say "compiled"
- **SEED_REPOS:** Each repo must say "OK". If any say "MISSING", the path in `groups/seed.json` is wrong — help the user fix it

If STATUS=failed, fix each failing item and re-run.

## 5. Start the Dashboard

Start both the dashboard UI and the main server:

```bash
npx tsx dashboard/server.ts &
npx tsx src/index.ts &
```

Or in two separate terminals:
- Terminal 1: `npx tsx dashboard/server.ts`
- Terminal 2: `npx tsx src/index.ts`

Verify the dashboard is running:

```bash
curl -s http://127.0.0.1:3737/ | head -3
```

Tell the user: **Open http://127.0.0.1:3737 in your browser.** They should see the Pixel Office dashboard.

## 6. Test It

Tell the user to:
1. Open the dashboard at http://127.0.0.1:3737
2. Select the **Main Orchestrator** group
3. Send a test message like "hello"
4. The orchestrator should respond

If the agent shows "idle" but is actually working, the dashboard hooks may not be firing. Check:
- The agent's project-level settings at `{workDir}/.claude/settings.json` should have hook entries
- The hooks use `node -e "..."` commands to POST events to the dashboard

If no response at all, check the server log:
```bash
cat groups/main/logs/agent-*.log
```

Common issues:
- "Not logged in" — Claude Code auth issue. The user needs to run `claude` in a terminal and log in first
- "Claude Code executable not found" — set `CLAUDE_CODE_EXECPATH` env var to the path of `claude` or `claude.exe`
- "No conversation found with session ID" — stale session. The server auto-clears these on retry

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run setup` | Run automated setup verification |
| `npx tsx dashboard/server.ts` | Start dashboard UI on port 3737 |
| `npx tsx src/index.ts` | Start the main agent server |
| `groups/seed.json` | Configure repos and pre-register agents |
| `groups/main/repos.json` | Auto-generated — repos available to orchestrator |

## Troubleshooting

**"tsx is not recognized":** Node.js isn't on PATH. Restart your terminal after installing Node, or run with full path: `npx tsx ...`

**Agent creates worktree from wrong repo:** Check the group's `container_config` in the database. It should have `workDir` pointing to the repo. If created via the orchestrator, make sure it used the `repo` field (which resolves from `seed.json`).

**Dashboard shows agent as idle:** The hook commands may be failing. Check that `node` is on PATH inside the agent's environment. The hooks use `node -e "..."` to POST events.

**Windows path issues:** Use forward slashes in `seed.json` paths (`D:/corvk` not `D:\corvk`). Node.js handles both, but JSON needs escaped backslashes.
