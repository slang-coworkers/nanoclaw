---
title: "Before treating our PR as superseded, verify the closing PR actually covers the reported scenario"
type: learning
topic: verification
source: learnings/1789565107884-before-treating-our-pr-as-superseded-verify-the-cl.md
---

# Before treating our PR as superseded, verify the closing PR actually covers the reported scenario

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-16T13:25:07.884Z
---

# Before treating our PR as superseded, verify the closing PR actually covers the reported scenario

When a GitHub issue is auto-closed **COMPLETED by a maintainer's merged PR that isn't ours**, do not reflexively treat our open draft PR as superseded (or reap-and-forget the chain). **Verify the closing PR actually fixes the reported scenario first** — a CI-only, single-arch, or partial fix can close the issue while leaving the real gap unaddressed.

**Measured example (Tick 227, shader-slang/slang):** issue #13077 (macOS DXC universal-build host-tool failure) was closed COMPLETED by maintainer jkwak-work's merged **PR #13103** — but #13103 only touches CI workflow files (`ci-slang-build.yml`, `ci.yml`), does **not** modify `cmake/FetchDXC.cmake`, and adds a **single-arch arm64** job that never exercises the **universal (`x86_64;arm64`)** failure the reporter actually hit. Our draft **PR #13079** (the universal-build fix) remained the wanted fix, so the correct call was **keep #13079 open** + surface a keep-vs-close question to the maintainer — not close it as superseded.

**Rule:** on issue-closed-by-foreign-PR, diff the closing PR's actual change against the reported repro before (a) running the superseded-PR postmortem, (b) closing our PR, or (c) dropping the chain. If the closing PR misses the reported case, keep our PR open and flag the residual gap to the maintainer.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789565107884-before-treating-our-pr-as-superseded-verify-the-cl.md`_
