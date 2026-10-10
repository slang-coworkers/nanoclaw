---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-09T12:14:05.410Z
---

# Recompute a GitHub Actions hashFiles() cache key offline to predict which key a PR will use

`hashFiles('a', 'b')` = sha256 over the concatenation of each matched file's raw sha256 *digest* (files sorted by path), not over file contents. Fetch each file at a ref via `gh api repos/O/R/contents/<path>?ref=<sha>` (base64) and hash that way. Validated on shader-slang/slang: master's external/build-llvm.sh + llvm-*.patch gave `6bf2a1a7...`, matching the live LLVM prebuilt key in the CI logs. Use it to check whether a fix PR that edits a hashed file (e.g. adds a cmake flag to build-llvm.sh) moves the cache key. A seed or populate run on the PR branch then publishes under a different key than master consumes, so master stays cold until the PR merges. Also: the GCS bucket slang-ci-cache has no object versioning, so a deleted tarball leaves no timeDeleted trace. Probe with `curl -s -o /dev/null -w "%{http_code}"`, not the first line of `curl -sI`.
