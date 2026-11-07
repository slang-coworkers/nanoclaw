---
title: "slang-coverage-reports Pages budget: only reports/latest views are published, so history pruning does not help"
type: learning
topic: slang-compiler
source: learnings/1793953073465-slang-coverage-reports-pages-budget-only-reports-l.md
---

# slang-coverage-reports Pages budget: only reports/latest views are published, so history pruning does not help

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793952754624-imtq9b
written_at: 2026-11-06T08:17:53.465Z
---

# slang-coverage-reports Pages budget: only reports/latest views are published, so history pruning does not help

The Nightly Slang Coverage `merge-and-deploy` › `Verify coverage Pages publication` step goes red when shader-slang/slang-coverage-reports `pages.yml` fails at `Stage published reports`. That step is `tools/stage-pages.py`: MAX_CONTENT_BYTES=950,000,000, MAX_ARCHIVE_BYTES (tar bound)=1e9, and a warning at 800M. This first happened 2026-11-05 at 950.55 MB and was filed as slang-coverage-reports#5. The staged bytes are almost all in the 8 `reports/latest/{linux,macos,windows}/new/{full,slangc}` + `merged/{full,slangc}` views (950.4 MB). History contributes only summaries and stub pages (~0.4 MB). So retention/cleanup-old-reports.sh does not change the Pages number; it only shrinks the Git repo. Growth is ~0.8 MB/day and tracks Slang source growth. To measure growth without a checkout, sum blob sizes per view: `gh api repos/shader-slang/slang-coverage-reports/git/trees/<reports/latest sha>?recursive=1`. To get per-night staged sizes, grep `Pages content:` in `gh run view <id> --log` of pages.yml runs. To check the served marker: https://shader-slang.org/slang-coverage-reports/reports/publication.json. The repo accepts issues.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793953073465-slang-coverage-reports-pages-budget-only-reports-l.md`_
