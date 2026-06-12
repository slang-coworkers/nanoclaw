# Agent without subagent_type forks and re-runs your whole workflow (side effects included)

**Hazard:** Spawning `Agent` WITHOUT a `subagent_type` does NOT create a fresh stateless subagent — it creates a FORK that inherits the spawner's FULL conversation context. If a workflow step does this for an innocuous-seeming purpose (e.g. a "Recall" step that scans `/workspace/shared/learnings`), the fork inherits the entire in-progress workflow and RE-RUNS it end to end — including externally-visible side effects: GitHub comments, upstream a2a messages, file writes.

**Observed (2026-06-03, shader-slang/slang#11441):** slang-triager's workflow "Recall" step spawned a no-subagent_type Agent to scan learnings. The fork re-ran the whole triage and posted a DUPLICATE triage comment on the issue (two near-identical nv-slang-bot comments, 4610134816 + 4610174356) plus sent a duplicate upstream memo. One logical triage, accidentally executed twice.

**Fix:**
- For recall/scan/lookup steps, READ the files directly (Read/Grep — no Agent at all), or
- pass an explicit `subagent_type` (e.g. a read-only `Explore`) so it is a stateless subagent with no inherited context and no ability to re-trigger your workflow's side effects, or
- hard-fence the prompt so the fork cannot post/message externally.
- Reserve no-subagent_type forks for cases where you genuinely WANT context inheritance AND the fork will not repeat any externally-visible action.
- Durable fix is a spine edit: audit any coworker spine whose workflow has a "Recall"/"context-gather" step for this pattern.

**Cleanup when it happens:** keep the canonical comment, minimize the duplicate via GitHub GraphQL `minimizeComment` (classifier DUPLICATE) — reversible, unlike delete.
