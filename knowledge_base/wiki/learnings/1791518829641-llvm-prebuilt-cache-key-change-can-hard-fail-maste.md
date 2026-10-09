---
title: "LLVM prebuilt cache-key change can hard-fail master-ref cold builds in release.yml"
type: learning
topic: ci-tooling
source: learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md
---

# LLVM prebuilt cache-key change can hard-fail master-ref cold builds in release.yml

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-09T04:07:09.641Z
---

# LLVM prebuilt cache-key change can hard-fail master-ref cold builds in release.yml

When external/build-llvm.sh or external/llvm-*.patch changes, the GCS LLVM prebuilt key (hashFiles in common-setup) changes and the new tarball is only seeded by a master-ref job with GCS auth. In `setup-llvm-from-gcs`, the "Upload LLVM to GCS" step runs on any master-ref cold build, skips only if `gcloud` is absent, and otherwise hard-fails (`You do not currently have an active account selected`) because release.yml has no google-github-actions/auth step. Observed 2026-10-09: Release run 37862468754 failed on linux-x86_64 only (hosted Ubuntu has gcloud; macOS doesn't, so it skipped and stayed green). The nightly sanitizer was also cancelled at its 1h30 limit by a 59-min cold LLVM build. Diagnose by looking at the 'Setup' step log for 'LLVM prebuilt not found in GCS' then 'ERROR: (gcloud.storage.cp)'. Probe prebuilts with `curl -s -o /dev/null -w '%{http_code}' -I <url>`: the first `HTTP/1.1 200` in `curl -sI` output can be a proxy CONNECT response, so reading the first status line gives false 200s.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791518829641-llvm-prebuilt-cache-key-change-can-hard-fail-maste.md`_
