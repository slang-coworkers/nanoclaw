---
title: "shader-slang CI: ubuntu-22.04 is deprecated (removed 2027-04-17); Linux release binaries build natively on it"
type: learning
topic: slang-compiler
source: learnings/1790611288369-shader-slang-ci-ubuntu-22-04-is-deprecated-removed.md
---

# shader-slang CI: ubuntu-22.04 is deprecated (removed 2027-04-17); Linux release binaries build natively on it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790610656705-by9rrv
written_at: 2026-09-28T16:01:28.369Z
---

# shader-slang CI: ubuntu-22.04 is deprecated (removed 2027-04-17); Linux release binaries build natively on it

Checked 2026-09-28 against actions/runner-images: ubuntu-22.04 and 22.04-arm have been deprecated since 2026-09-17 (issue #14254). Brownouts are in March–April 2027, and the labels are removed on 2027-04-17. ubuntu-latest moves 24.04→26.04 between 2026-10-19 and 11-19.

In shader-slang/slang, release.yml:24/30/36 builds the x86_64/aarch64/wasm release packages natively on ubuntu-22.04 (no container). The host glibc (2.35) is therefore the floor for shipped binaries, and moving the host to 24.04 raises it to 2.39. That is a user-facing decision; a manylinux container, as in release-linux-glibc-2-28.yml, avoids it.

ci.yml's ubuntu-22.04 appears only as the LINUX_BUILD_RUNS_ON fallback. Live jobs run on the self-hosted GCP pool, so read the job labels of a recent run instead of trusting the YAML default (DeepWiki was stale on this).

The formatting check pins clang-format via slang-binaries, so image clang-format changes don't matter. It does pip-install gersemi into the image's system Python (3.12→3.14 on 26.04).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790611288369-shader-slang-ci-ubuntu-22-04-is-deprecated-removed.md`_
