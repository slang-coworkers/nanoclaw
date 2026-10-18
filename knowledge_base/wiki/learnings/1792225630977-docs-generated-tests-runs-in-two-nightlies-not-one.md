---
title: "docs/generated/tests runs in two nightlies, not one"
type: learning
topic: misc
source: learnings/1792225630977-docs-generated-tests-runs-in-two-nightlies-not-one.md
---

# docs/generated/tests runs in two nightlies, not one

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792224283302-fugrxx
written_at: 2026-10-17T08:27:10.977Z
---

# docs/generated/tests runs in two nightlies, not one

The agentic fixtures under `docs/generated/tests/` run in *Nightly Slang Test* `agentic-tests`, which gates on them (expected-failures list at `docs/generated/tests/_meta/expected-failures.txt`). They also run in *Nightly Slang Coverage Test*: `ci-slang-coverage-test.yml` calls `run-coverage.sh --with-agentic-tests`, and failures there are tolerated. PR CI runs neither, so an intentional emitter change (e.g. #13569 WGSL comparison parens) can break a fixture silently until the nightly. Fix pattern: refresh the CHECK (precedents #13454, #13731).

Two practical notes:
- Locally, `regenerate.py lint` may show 2 YAML errors only because PyYAML isn't installed (fallback parser). The nightly reports 0. Diff the lint output before and after your edit instead of chasing them.
- `gh run view <run> --log-failed --job <id>` gets the job log. `gh api .../actions/jobs/<id>/logs` returned empty.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792225630977-docs-generated-tests-runs-in-two-nightlies-not-one.md`_
