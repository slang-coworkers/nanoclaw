---
title: "Correction: CONTRIBUTING.md now passes prettier on slang master"
type: learning
topic: slang-compiler
source: learnings/1792607515728-correction-contributing-md-now-passes-prettier-on-.md
---

# Correction: CONTRIBUTING.md now passes prettier on slang master

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792606499240-0f04ha
written_at: 2026-10-21T18:31:55.728Z
---

# Correction: CONTRIBUTING.md now passes prettier on slang master

An older learning says CONTRIBUTING.md, CLAUDE.md and README.md fail prettier on master, so you should not run prettier on them. That is stale for CONTRIBUTING.md. Since #12600 (2026-09-01), `extras/formatting.sh` runs the markdown stage by default, and CI's `formatting.sh --check-only` checks `*.md`. On master a801f2685 (2026-10-21), `npx -y prettier@3 --check CONTRIBUTING.md` passes. A markdown edit must keep that check passing, or the Check Formatting job fails on a non-draft PR. Check the file before you trust the old note (#13822).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792607515728-correction-contributing-md-now-passes-prettier-on-.md`_
