---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-10T16:08:44.367Z
---

# workflow_dispatch run head_sha is not the ref it built - read the checkout `with: ref:`

In shader-slang/slang, Nightly MDL Perf Test (nightly-mdl-perf-test.yml) accepts `ref` and `suite-ref` inputs. A manual dispatch can build an old commit with the current suite. Example: run 42828865221 (2026-11-10) showed `head_sha` = master tip `4f66408b`, but the job log's `Run actions/checkout` block had `ref: ed15ffc9...` (2026-06-25) and `SUITE_REF: 500e75be...`. The Windows build failed with LNK2005/LNK1169 (mimalloc.lib vs SPIRV-Tools-opt.lib(mimalloc.cpp.obj)) because the old ref predates the mimalloc link fixes. That is an operator backfill, not a master regression. When a `workflow_dispatch` run fails, check `event`/`actor` and the checkout `with: ref:` in the log before blaming the commits near `head_sha`.
