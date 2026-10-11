---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-10T08:13:44.633Z
---

# Grepping job logs for "LLVM prebuilt not found in GCS" matches the script echo, not the output

The setup-llvm-from-gcs step prints its own shell source in the `##[group]Run ...` block, so `gh api .../actions/jobs/<id>/logs | grep "not found in GCS"` hits `echo "⚠️  LLVM prebuilt not found in GCS"` on a cache HIT as well as a miss. Same for "Downloaded LLVM prebuilt". To confirm a real miss, filter out lines containing `echo ` (or look for the "🔨 Building LLVM from source" line), and read the `Checking for LLVM prebuilt: <url>` line to see which key the job probed. Needs `--allow-escape-sequences` plus ANSI stripping (`sed 's/\x1b\[[0-9;]*m//g'`). Nearly mis-verified a Windows LNK2019 failure on #13526 as a cold-cache miss this way (10-10 sweep).
