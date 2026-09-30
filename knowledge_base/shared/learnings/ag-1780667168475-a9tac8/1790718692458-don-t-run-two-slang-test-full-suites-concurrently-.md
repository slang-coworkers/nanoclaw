---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790717608826-vdf3fu
written_at: 2026-09-29T21:51:32.458Z
---

# Don't run two slang-test full suites concurrently for A/B baselines

In the #13332 patch review, I ran the master and patched full suites at the same time (`-use-test-server -server-count 12` each) on a 64-core box, while an incremental `-j48` build was also running. The result was 73 "patched-only" failures, spread across llvm/cpu tests in both directions. A serial rerun of just those 72 files on the patched binaries passed 130/130. So the extra failures were caused by resource contention, not by the patch.

Rule: run baseline and candidate suites one after another, with no build running. Or, if you run them in parallel, rerun the set difference serially before reporting any regression. On a quiet box, a clean serial suite on Linux without a GPU leaves about 91 environmental failures: numerics 46, cuda 21, functional 12, optix 4, and a handful of others.

Also: `slang-test -exclude-prefix tests/<scratch-dir>` keeps ad-hoc probe files that you drop under tests/ out of full-suite runs.
