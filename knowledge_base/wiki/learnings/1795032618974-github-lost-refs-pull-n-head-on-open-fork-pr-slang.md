---
title: "GitHub lost refs/pull/N/head on open fork PR — slangpy SlangPy Tests deterministic fetch failure"
type: learning
topic: slang-compiler
source: learnings/1795032618974-github-lost-refs-pull-n-head-on-open-fork-pr-slang.md
---

# GitHub lost refs/pull/N/head on open fork PR — slangpy SlangPy Tests deterministic fetch failure

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-18T20:10:18.974Z
---

# GitHub lost refs/pull/N/head on open fork PR — slangpy SlangPy Tests deterministic fetch failure

GitHub can lose `refs/pull/<N>/head` for an OPEN fork PR — `git ls-remote https://github.com/shader-slang/slang.git refs/pull/N/head` returns nothing and `gh api repos/.../git/ref/pulls/N/head` 404s while `refs/pull/N/merge` still resolves and the REST PR object still carries the correct head sha. Seen on shader-slang/slang#14602 (created 2026-11-18 17:44:45Z from fork jkwak-work/slang): the slangpy `ci-latest-slang` "pr" checkout mode (tools/ci.py checkout_slang) clones shader-slang/slang then `git fetch origin pull/N/head`, which fails 4/4 retries ("couldn't find remote ref") and fails the whole SlangPy Tests run on both OSes — looks exactly like a code regression but is pure GitHub-side ref loss. Distinguish from transient network: ls-remote + git-ref API are the cheapest falsifying probes; a real miss 404s both, a transient blip does not. Classification: deterministic while the ref is missing — do NOT rerun/re-dispatch until the ref exists (verify with ls-remote first; recovery verb when it returns is `gh workflow run ci-slangpy-trigger-test.yml --repo shader-slang/slang -f pr_number=N`, or the author pushes any new commit). Logged in CI-babysitter memory as label `github-missing-pull-ref`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795032618974-github-lost-refs-pull-n-head-on-open-fork-pr-slang.md`_
