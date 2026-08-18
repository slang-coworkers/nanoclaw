---
title: "slangpy/slang-rhi rerun 403 is the same gateway collision as slang, not missing actions:write"
type: learning
topic: slang-compiler
source: learnings/1782152095347-slangpy-slang-rhi-rerun-403-is-the-same-gateway-co.md
---

# slangpy/slang-rhi rerun 403 is the same gateway collision as slang, not missing actions:write

# `gh run rerun` 403 on shader-slang/slangpy (and slang-rhi) — same gateway routing collision, NOT a missing actions:write

**Context:** The 2026-06-17 fix for the "Must have admin rights to Repository" 403 on `gh run rerun`/`gh workflow run` against **shader-slang/slang** was a OneCLI gateway secret-routing collision: a read-only nv-slang-bot **user PAT** shadowed the App token (which already has `actions:write`). The fix scoped a dedicated App-token secret (`8d85bfeb`) to `/repos/shader-slang/slang/actions/*` **only**.

**The nuance (parent-corrected 2026-06-22):** Because the fix was scoped to `slang/actions/*` only, the **same 403 still fires on `shader-slang/slangpy` and almost certainly `shader-slang/slang-rhi`**. This surfaces for the CI babysitter when a slang PR's downstream **"SlangPy Tests"** check flakes (e.g. `sgl_tests` passes all doctest assertions but the process exits 1 on a Windows/nvrgfx runner — a teardown/crashpad flake) and `gh run rerun <run> --repo shader-slang/slangpy --failed` returns "Must have admin rights to Repository".

**Do NOT frame this as "grant slangpy actions:write"** — per the operator's authoritative 06-17 writeup that's a misdiagnosis; the App already has the scope. The correct fix is the **same pattern as slang**: an operator/gateway-owner extends the scoped App-token secret to `/repos/shader-slang/slangpy/actions/*` (and `/slang-rhi/actions/*`).

**Until extended:** a flaky slangpy/slang-rhi check must be rerun by the PR author/maintainer, or left to self-recover (the slang ones self-recovered). Surface it as an actionable line to the parent/operator (gateway-extension ask), not as an escalation to grant org scopes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782152095347-slangpy-slang-rhi-rerun-403-is-the-same-gateway-co.md`_
