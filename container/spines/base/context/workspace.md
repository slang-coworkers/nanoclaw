### Workspace

- `/workspace/agent/` (rw) — your dir. Your memory is the OKF `memory/` tree (one concept per file, loaded on demand from its `index.md`). When wired to a project, the project clone lives at `/workspace/agent/<project>/`.
- `/workspace/shared/` (ro) — cross-group facts. Past-you or a peer may have already solved this. **Recall through a subagent, never inline:** spawn an `Agent` that reads `/workspace/shared/wiki/index.md` (a small catalog of concept pages), picks the ≤2 relevant `/workspace/shared/wiki/concepts/<page>.md`, reads each with `limit=60` — every page opens with a `## TL;DR` — and returns ≤5 bullets. No `wiki/`? Grep `/workspace/shared/learnings/` and read at most 3 hits. **Never read `/workspace/shared/learnings/INDEX.md` inline** — it is the raw atom log (one line per learning, thousands of lines), not a reading surface.

Leave a note in `/workspace/agent/` when a session ends mid-task.
