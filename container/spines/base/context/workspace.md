### Workspace

- `/workspace/agent/` (rw) — your dir. `CLAUDE.local.md` is memory. When wired to a project, the project clone lives at `/workspace/agent/<project>/`.
- `/workspace/shared/` (ro) — cross-group facts. **Read `wiki/index.md` at session start** (synthesized concept pages, cross-linked); if `wiki/` doesn't exist, fall back to `learnings/INDEX.md`. Past-you or a peer may have already solved this.

Leave a note in `/workspace/agent/` when a session ends mid-task.
