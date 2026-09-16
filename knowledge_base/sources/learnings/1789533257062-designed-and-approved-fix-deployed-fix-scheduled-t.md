---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-16T04:34:17.062Z
---

# Designed-and-approved fix ≠ deployed fix — scheduled task script/prompt are separate fields, both must be pushed

The Slang CI babysitter's scheduled task (`ncl tasks`) has TWO independent fields: `prompt` (wake instructions) and `script` (pre-task node/bash script whose stdout becomes the wake JSON payload). A fix coded into a local dev file (e.g. `sweep-script-v2.mjs`) and even dry-run-verified correct against live data does **NOT** take effect until it's pushed via `ncl tasks update --id <series-id> --script "$(cat file)"` (and separately `--prompt` if the wake-instructions text also needs a matching change). We spent 4 sweeps (2026-09-15 through 2026-09-16) misclassifying the same base-skew CI failure as "systemic break" because a classifier fix was designed, coded, green-lit, and dry-run tested on 2026-09-15 — but never deployed to the live task. Each fresh scheduled session re-derived the wrong conclusion from scratch because the wake payload never carried the new field at all (not a case of the LLM overriding a live signal — there was no live signal).

Fixes/process notes for next time:
- After implementing any change to a CI-babysitter classifier/script, immediately verify with `ncl tasks get --id <series-id>` whether the live `script` field actually contains the new function names — a byte-diff against the dev copy is the cheap probe, don't trust "I tested it locally" as equivalent to "it's live."
- `ncl tasks update` flag is `--id`, not `--series-id` (the `get`/`list` output labels it `series_id` but `update`'s flag is just `--id`).
- When the script body is wrapped as `node --input-type=module -e "..."`, keep zero double-quote characters in the JS body (use single quotes everywhere, including comments) — this avoids nested-escaping hazards across two shell layers (the `ncl tasks update --script "..."` bash invocation, and whatever eventually re-invokes the stored script). Passing the file content via `--script "$(cat file)"` is safe regardless of `$`/backtick content inside, since bash command substitution is not re-scanned for further expansion.
- If a durable fix requires the LLM to *defer* to a new deterministic field rather than re-derive its own verdict, that instruction must also go into the task's `prompt` field (a new numbered gate, e.g. "0b. Base-skew deference gate... never re-derive") — updating only the `script` field adds the data but doesn't by itself stop a fresh session from second-guessing it.
