# learnings-wiki daily fold — nemoclaw-coworkers

Mirrors prod's series task (`docs/scheduled-tasks.slang-coworkers-prod.json`, PART A only): the
Orchestrator wakes at 06:00 UTC when the gate says there is something to fold, rebuilds the base
layers, folds the uncovered atoms into `wiki/concepts/*.md`, and reports one line.

- `gate.sh` — the task's script gate (prefers `python3 .learnings_wiki.py gate`, bash fallback).
- `prompt.md` — the task prompt (prod's PART A + backlog guard, no GitHub mirror).

Create (once, on the box; operator decision):

```bash
cd ~/haaggarwal/nemoclaw-coworkers
./bin/ncl tasks create --group ag-822c9c8a-23e2-4e7a-a6bc-4c071d976392 \
  --name "learnings-wiki daily fold" --recurrence "0 6 * * *" \
  --script "$(cat ops/nemoclaw-coworkers/learnings-wiki/gate.sh)" \
  --prompt "$(cat ops/nemoclaw-coworkers/learnings-wiki/prompt.md)"
```

Preconditions: the recursive-discovery fix in `container/skills/learnings-wiki` deployed (a fresh
install has 100 % of its atoms under `learnings/<agent-group-id>/`), the skill mirrored into the
Orchestrator group, the Orchestrator rw on `/workspace/shared`. Output: `data/shared/{sources,wiki}/`,
served at `/wiki/` and `/learnings/` on the 8091 viewer (`refresh-viewers.sh`).
