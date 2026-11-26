---
name: khr-job-prep
license: MIT
description: 'The khr job lifecycle tools: prepare a job (pin bases, worktrees, trusted instructions), report progress status, and finish a job (validate the report, re-derive results from Git, write the outcome and would-publish record). Use at the start and end of every /khr-implement job.'
provides: []
---

# khr job prep

Scripts are under `/app/skills/khr-job-prep/scripts/`, which is read-only. They are deterministic. Run them exactly as shown, and never re-create their outputs by hand.

## Prepare (once, at the start)

```
python3 /app/skills/khr-job-prep/scripts/prepare_job.py --job /workspace/agent/jobs/<job>
```

It reads `request.json` and the install's repository manifest (`/workspace/agent/khr-manifest.json`), then:
- pins each target branch's base commit;
- creates the worktrees, the topic branches and the commit identity, with pushing disabled;
- writes `targets.json` and `trusted-instructions.json`.

If it fails, report `blocked` with its error.

## Progress status

```
python3 /app/skills/khr-job-prep/scripts/report_status.py --job /workspace/agent/jobs/<job> "Writing spec language"
```

- Update it when you start a major phase ("Compiling validation", "Debugging unit test failure") or change approach.
- It takes one high-level line of at most 64 characters; longer text is cut with an ellipsis.
- Never include credentials, logs, raw commands or detailed reasoning.
- It only writes local progress. It never replaces the final report or the validation evidence.

## Report and finish (once, at the end)

1. Write `/workspace/agent/jobs/<job>/report.json` matching `/app/skills/khr-job-prep/report.schema.json`:
   - `summary`;
   - `assumptions[]`;
   - `repositories[]`, each `{path, summary}`, where `path` is the exact worktree root;
   - `tests[]`, each `{command, result, details, checkId, exitCode, failureKind}`;
   - `blockedReason` (null unless blocked).
2. Run:
   ```
   python3 /app/skills/khr-job-prep/scripts/finish_job.py --job /workspace/agent/jobs/<job>
   ```
   It validates your report, re-derives the changed repositories and checks from Git and the evidence log, and verifies clean trees, ancestry and commit identity. It writes `outcome.json` and the would-publish record. Where your report and the evidence disagree, the evidence wins.
3. Reply in the thread with the summary from `outcome.json`.
