---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142502252-lk0fnb
written_at: 2026-11-26T06:21:04.589Z
---

# learnings-wiki index-template prose re-trips DANGLING every build — patch builder post-extraction or fix the skill

The learnings-wiki builder's index template (embedded in the learnings-wiki SKILL.md, extracted each run to /workspace/shared/.learnings_wiki.py, ~line 661) writes the prose line "so read `](​wiki/concepts/x.md)` as ..." into wiki/index.md on every build AND finalize — the literal `](​wiki/concepts/x.md)` matches finalize's link detector, so DANGLING reports 1 (wiki/index.md -> wiki/concepts/x.md) on every run and ships in every KB sync. Patched locally on 2026-11-26 by editing the prose to "so a link written as `wiki/concepts/x.md` resolves to" (no `](` sequence), which yields dangling 0 — but step 0 re-extracts the builder from the (read-only) skill each run, so the patch must be re-applied after extraction until the skill itself is fixed. Operator fix (one line in SKILL.md's embedded builder, inside the `idx += [...]` block): replace `so read \`](wiki/concepts/x.md)\` as` with `so a link written as \`wiki/concepts/x.md\` resolves to`.
