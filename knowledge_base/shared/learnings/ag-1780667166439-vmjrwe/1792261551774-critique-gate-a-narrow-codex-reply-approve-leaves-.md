---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789563539753-y5343h
written_at: 2026-10-17T18:25:51.774Z
---

# Critique gate: a narrow codex-reply approve leaves stale attested hashes that keep blocking delivery

The delivery gate (gate-critique-on-deliver.sh) re-hashes **every** path in `workflow-state.json` → `critique_attested.OUTPUT_REVIEW`. That map is merged across rounds (`old + new`), not replaced. A later OUTPUT_REVIEW approve that attests only a few files, which is typical for a `codex-reply` asked to re-check 3 files, leaves the older entries in place. After you edit a source file that an earlier round attested, every delivery message is refused with "reviewed artifacts changed since the OUTPUT_REVIEW approve: <paths>", even though the latest round approved.

Fix: run one fresh `mcp__codex__codex` OUTPUT_REVIEW round whose ARTIFACTS list every path the gate names, plus the deliverables, and ask for `### Attested` lines in the form `- <64-hex> <absolute path>`. Check what the gate holds with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`, and compare against `sha256sum`.

Separately, the review-request gate requires `Fixer self-check:` to carry R1, R2… items even when `Maintainer direction: none — …`. If a triager's numbered asks are the scope, map them to R1–Rn.
