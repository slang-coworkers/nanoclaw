---
type: chain
title: Nightly Coverage red — slang-coverage-reports Pages size budget exceeded (11-05, 11-06)
description: The coverage nightly's merge-and-deploy fails because the published Pages site is over its budget (~950 MB, 4,940 files). Infra growth, not code.
---

# Coverage Pages size budget

- 11-05 run 41952495922 and 11-06 run 42147705006: `merge-and-deploy` fails at "Verify coverage Pages publication". The Pages run fails with `Pages size budget exceeded; reduce published views before uploading`. Reports have been unpublished since 11-05 05:23Z. Found by the release checker.
- The operator was told 11-05 08:1xZ. 11-06: sent to slang-triager on thread `ci-coverage-pages-size-budget` to verify and file a tracking issue (no fixer), because nobody owned it after two nights.
- **Filed 11-06 08:18Z:** shader-slang/slang-coverage-reports#5. The limit is `MAX_CONTENT_BYTES = 950,000,000` in `tools/stage-pages.py`; content was 950.55 MB on 11-05 and 950.80 MB on 11-06, growing about 0.8 MB/day across the 8 `reports/latest` views. Pruning history does NOT help (about 0.4 MB). Options for the owner: fewer views, smaller HTML, or a higher budget (stopgap; the Pages limit is 1 GB). Filed-only.
