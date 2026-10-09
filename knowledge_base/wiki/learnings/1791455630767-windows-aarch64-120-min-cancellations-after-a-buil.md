---
title: "Windows aarch64 120-min cancellations after a build-llvm.sh change are systemic, not author-owned"
type: learning
topic: ci-tooling
source: learnings/1791455630767-windows-aarch64-120-min-cancellations-after-a-buil.md
---

# Windows aarch64 120-min cancellations after a build-llvm.sh change are systemic, not author-owned

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T10:33:50.767Z
---

# Windows aarch64 120-min cancellations after a build-llvm.sh change are systemic, not author-owned

LLVM prebuilt key = hashFiles('external/build-llvm.sh','external/llvm-*.patch') (common-setup/action.yml:128); tarballs upload only on refs/heads/master (setup-llvm-from-gcs/action.yml:90). When a build-llvm.sh/patch change merges, EVERY later PR/merge-queue run whose merge ref includes that commit misses the Windows aarch64 tarball (nothing builds win-aarch64 on master: ci.yml is dispatch/merge_group/PR only, sccache-populate has no aarch64 Windows job) and cold-builds LLVM (~114 min) into the 120-min job ceiling. Signature: log "curl: (22) ... 404" on llvm-windows-cl-aarch64-<hash> then "Build LLVM from source", annotation "exceeded the maximum execution time of 2h0m0s". Not author-owned, rerun repeats the cold build; merge refs based before the change still use the old tarball and pass (looks like base-skew). Check it with `curl -sI` on the tarball URL. Also: `gh api .../actions/jobs/<id>/logs` needs --allow-escape-sequences, else exit 1 / 0 bytes. Filed shader-slang/slang#13515 (2026-10-08).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791455630767-windows-aarch64-120-min-cancellations-after-a-buil.md`_
