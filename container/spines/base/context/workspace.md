### Workspace

- `/workspace/agent/` (rw) — your dir. Your memory is the OKF `memory/` tree (one concept per file, loaded on demand from its `index.md`). When wired to a project, the project clone lives at `/workspace/agent/<project>/`.
- `/workspace/shared/` (ro) — cross-group facts; past-you or a peer may already have solved this. Reach it only through the recall rule below.

Leave a note in `/workspace/agent/` when a session ends mid-task.

#### Recall rule

Before investigating or changing anything, spawn one `Agent` subagent with this prompt (substitute `<task>`); never read these files inline:

```
Agent(prompt="Check if /workspace/shared/wiki/index.md exists. IF YES: read it (a small catalog of concept pages; links are relative to /workspace/shared, so `](wiki/concepts/x.md)` means `/workspace/shared/wiki/concepts/x.md`), pick at most 2 concept pages relevant to <task>, read each with limit=60 (every page opens with a `## TL;DR`), and follow their links to cited learnings if needed. If no concept fits, Grep /workspace/shared/wiki/ for keywords. IF NO wiki/ dir: Grep /workspace/shared/learnings/ for keywords and read at most 3 hits. Return ≤5 bullets — title, 1-line summary, file path. No hits → 'no prior hits'.")
```

Never read `/workspace/shared/learnings/INDEX.md` — it is the raw atom log (one line per learning, thousands of lines), not a reading surface.
