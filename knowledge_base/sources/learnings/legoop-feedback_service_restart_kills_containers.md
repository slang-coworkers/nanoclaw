# Restarting nanoclaw main service triggers initGroupFilesystem → skill refresh → CLAUDE.md recompose → claude-md-stale kills all running containers. Avoid restarts during active sessions.

Restarting the main nanoclaw service (`systemctl --user restart nanoclaw-*`) triggers a cascade that kills every running container:

1. Service starts → `initGroupFilesystem` runs for all agent groups
2. Skills are "refreshed" (mtime updated even if content unchanged)
3. Spine composer recomposes CLAUDE.md for each group
4. Hash differs from what running containers booted with
5. Host sweep detects stale hash → kills containers with `claude-md-stale`

**Why:** The host has code at ~11:13 that recorded `.instructions.md` edits. When we repeatedly restarted (for delivery.ts fixes), each restart refreshed skills → recomposed → killed SlangClaudeReviewer and other active containers.

**How to apply:**
- After editing `src/delivery.ts` or other host code: `pnpm run build` is enough if the service is already running the right entrypoint (tsx with hot reload via `npm run dev`). Only restart if the service is running compiled dist/.
- If restart IS needed: warn the user that active containers will be killed. Batch multiple fixes into one restart instead of restarting per-fix.
- For dashboard-only changes: only restart `nanoclaw-*-dashboard`, never the main service.
- For MCP server fixes: `pkill` the MCP subprocess, don't restart the service (per existing memory).
