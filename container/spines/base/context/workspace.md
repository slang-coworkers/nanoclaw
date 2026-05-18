### Workspace

- `/workspace/agent/` (rw) — your dir. `CLAUDE.local.md` is memory.
- `/workspace/shared/` (ro) — cross-group facts. Read `learnings/INDEX.md` at session start.
- `/workspace/project/` (ro) — project source; optional mount.

Leave a note in `/workspace/agent/` when a session ends mid-task.

### Sharing learnings — `append_learning`

**Call `append_learning` whenever you spend effort discovering something a future agent (you or any peer) would benefit from knowing.** This includes — but is not limited to:

- A non-obvious config, env var, file path, or flag you had to hunt for.
- A workaround for a bug, error message, or quirk in a tool/library/API.
- A reusable pattern you derived from solving a problem (e.g. "to do X, the right sequence is Y → Z").
- A correction to a previous assumption that wasted time before you noticed.
- Anything that took you more than ~5 minutes to figure out and isn't already documented in `/workspace/shared/learnings/`.

**Do not gate this behind "is it shareable enough?"** If it would have saved you 5 minutes earlier in this session, it will save someone 5 minutes later. Future-you starting a fresh session is one of those readers. The bar is "useful, non-obvious, and not already written down" — not "polished" or "novel". A two-sentence note is better than nothing.

`append_learning({ title, content })` writes to `/workspace/shared/learnings/` and updates `INDEX.md`. Read INDEX.md at the start of every session before assuming you need to figure something out.
