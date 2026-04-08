---
name: add-dashboard
description: Add Pixel Office dashboard for real-time agent observability. Isometric pixel-art office visualization with live tool use indicators, activity timelines, memory browser, and hook event streaming. Triggers on "add dashboard", "pixel office", "agent dashboard", "observability dashboard".
---

# Add Pixel Office Dashboard

This skill adds the Pixel Office dashboard — a real-time observability UI that shows your NanoClaw agents as pixel-art characters in an isometric office.

## Phase 1: Pre-flight

### Check if already applied

```bash
ls dashboard/server.ts 2>/dev/null && echo "ALREADY_APPLIED" || echo "NEEDS_INSTALL"
```

If `ALREADY_APPLIED`, skip to Phase 3 (Configure). The code changes are already in place.

## Phase 2: Apply Code Changes

### Ensure slang remote

```bash
git remote -v
```

If `slang` remote is missing, add it:

```bash
git remote add slang https://github.com/szihs/nanoclaw.git
```

### Merge the skill branch

```bash
git fetch slang skill/dashboard
git merge slang/skill/dashboard || {
  # Resolve package-lock.json conflicts if any
  git checkout --theirs package-lock.json 2>/dev/null && git add package-lock.json
  git merge --continue
}
```

This merges in:
- `dashboard/` — Full dashboard server and client (server.ts, public/app.js, public/index.html, sprites.js, 60+ pixel art assets, tests)
- `.claude/skills/dashboard/` — Setup instructions, integration guide, gotchas
- `src/channels/dashboard.ts` — Virtual channel for `dashboard:*` JIDs
- Channels are auto-discovered — just drop the file into `src/channels/` and rebuild.
- `src/container-runner.ts` — Dashboard URL injection, HTTP hooks in settings.json
- `container/agent-runner/src/index.ts` — (unchanged, dashboard hooks use native HTTP hooks in settings.json)
- `vitest.config.ts` — Dashboard test path added
- `package.json` — `dashboard` script added

If the merge reports conflicts, resolve them by reading the conflicted files and understanding the intent of both sides.

### Validate code changes

```bash
npm install
npm run build
npx vitest run
```

All tests must pass, including dashboard-specific tests (`dashboard/server.test.ts`) which are self-contained.

## Phase 3: Register Dashboard Group

The dashboard needs at least one registered group to route messages to. Register a main group with a `dashboard:*` JID:

```bash
npx tsx setup/index.ts --step register -- \
  --jid "dashboard:main" \
  --name "Orchestrator" \
  --folder "dashboard_main" \
  --trigger "@Andy" \
  --channel dashboard \
  --no-trigger-required \
  --is-main
```

This creates:
- A main group that responds to all messages (no trigger prefix needed)
- The group folder `groups/dashboard_main/` with the agent's memory and workspace
- The agent gets the project mounted read-only, can manage other groups via IPC

## Phase 4: Configure

### Set dashboard port (optional)

The dashboard runs on port 3737 by default. To change:

Add to `.env`:
```
DASHBOARD_PORT=3737
```

### Dashboard authentication (optional)

By default the dashboard is open (no auth). To require a secret for admin mutations:

Add to `.env`:
```
DASHBOARD_SECRET=your-secret-here
```

### Rebuild and restart

```bash
npm run build
./container/build.sh  # rebuilds container with dashboard hooks
```

Restart the service:
```bash
# macOS
launchctl kickstart -k gui/$(id -u)/com.nanoclaw

# Linux
systemctl --user restart nanoclaw
```

## Phase 5: Verify

### Start the dashboard

```bash
npm run dashboard
```

### Open in browser

Navigate to `http://localhost:3737` (or your configured port).

You should see:
- An isometric pixel office
- Agent characters appear when coworkers are active
- Live tool use indicators and status badges
- Activity timeline on the right panel

### Test hook events

Send a message to any registered chat. The dashboard should show:
- The agent character animating
- Tool use events appearing in the timeline
- Status changing from idle → thinking → working

## Troubleshooting

### Dashboard shows no agents

- Ensure NanoClaw service is running
- Check that `store/messages.db` exists (created on first run)
- Verify registered groups: `node -e "console.table(require('better-sqlite3')('store/messages.db',{readonly:true}).prepare('SELECT * FROM registered_groups').all())"`

### Hook events not arriving

- Check container settings: `cat data/sessions/<group>/.claude/settings.json | jq .hooks`
- Hooks should show `type: "http"` entries pointing to the dashboard URL
- Restart the service to regenerate hook configuration

### Connection refused

- Dashboard must be running (`npm run dashboard`) separately from the main NanoClaw service
- Check port: `lsof -i :3737` (or your configured port)

## Removal

To remove the dashboard:

```bash
# Find the merge commit
git log --merges --oneline | grep dashboard

# Revert it
git revert -m 1 <merge-commit>

# Rebuild
npm run build
```
