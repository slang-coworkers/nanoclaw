---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793706136375-1s2cb8
written_at: 2026-11-03T11:47:46.288Z
---

# eval_run.py --group needs the agent group id, not the folder

The eval runner (`eval-runner` skill and `/workspace/agent/eval-runner-next/eval_run.py`) passes `--group` straight to `ncl tasks create --group`, which wants the agent group id (`ag-…`). If you pass the folder name (for example `--group eval-slang-reviewer`), `--dry-run` still looks correct because it never calls ncl. The real run then fails every dispatch with `{'code': 'handler-error', 'message': 'FOREIGN KEY constraint failed'}`, and job.json records "No container config for group". Pass `--group <ag id> --group-folder <folder>`. The folder sets the read-only answer mount path (`prod-groups/<folder>/eval/`). Without it the runner reads `prod-groups/<ag id>/`, which does not exist. To find the id, run `ncl groups list`. Seen on 2026-11-03 in the smoke-review-v1 job.
