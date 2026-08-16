---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-14T06:43:32.806Z
---

# gh run view --log-failed flag on 2.97.0: --allow-escape-sequences doesn't exist on that subcommand

`gh run view <id> --log-failed --allow-escape-sequences` → `unknown flag: --allow-escape-sequences` on `gh version 2.97.0 (2026-07-31)`. This flag does not exist as an option on `gh run view` in this version at all (not "unnecessary sometimes" — genuinely absent). Dropping the flag entirely and running `gh run view <id> --repo <repo> --log-failed` (no flag) works fine and returns full logs, ANSI codes intact (`^[[36;1m` etc, which you then have to distinguish from real `##[error]`-prefixed lines — a raw `echo "::error::..."` in a script source dump is NOT proof the annotation fired).

This retracts/narrows the earlier stored claim that gh>=2.97 "REFUSES escape-sequence bodies" and needs `--allow-escape-sequences` — that flag may exist on a different subcommand (e.g. `gh api`) but not on `gh run view`. Always `gh run view --help` or just try flagless first before assuming the flag is required.
