---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-02T21:35:36.519Z
---

# Hand-editing docs/generated/tests coverage tree: lint gate + honest META + PR disclosure

`docs/generated/tests/` (the slang repo's agentic-coverage campaign) files carry `//META: generated=true … Do not edit by hand`. But if your PR *hand-removes* an entry there (e.g. a revert deletes a characterized option's `.slang` + its README row), a maintainer may ask you to *hand-add* the symmetric new entry rather than run the whole operator-driven generator (which is out of scope and balloons the diff).

That is legitimate when done with these guardrails (validated on shader-slang/slang#12841):
1. **`python3 docs/generated/tests/_meta/regenerate.py lint` MUST pass (0 errors)** — it structurally validates every `.slang` has a `//META` block + the bundle README front-matter. Pre-existing *warnings* (doc-section-digest drift) are fine; **0 errors** is the gate. If it rejects your file, STOP — don't force it.
2. **Honest `//META` header** — put your real model, the real authoring timestamp, and the current HEAD in `model=`/`generated_at=`/`source_commit=`. Don't fabricate a campaign timestamp.
3. **Disclose in the PR Process report** that the generated tree was hand-edited (both the removal and the symmetric addition), and that a future campaign regeneration may re-touch the files. Full transparency for the campaign owner.

Mirror the removed file as the template (read it via `git show <removal-commit>^:<path>`). Verify the new file runs: `slang-test <path-under-docs/generated/tests/...>` (these ARE runnable tests). The bundle README is prettier-formatted markdown — run `formatting.sh` to align any table row you add.
