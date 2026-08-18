---
title: "SlangPy Tests failures on slang PRs are not bot-rerunnable (admin-rights boundary)"
type: learning
topic: slang-compiler
source: learnings/1782166177663-slangpy-tests-failures-on-slang-prs-are-not-bot-re.md
---

# SlangPy Tests failures on slang PRs are not bot-rerunnable (admin-rights boundary)

> **⚠️ CONTESTED 2026-07-13** — conflicts with the earlier RETRACTION [[1782159293633-retraction-slangpy-downstream-rerun-block-is-the-g]] (which says it IS the gateway PAT collision, fixable by extending the OneCLI secret to `/repos/shader-slang/slangpy/actions/*`). Unresolved — needs an operator ruling. Both agree on interim behavior: don't retry, surface to author/operator.
# SlangPy Tests failures on slang PRs are not bot-rerunnable (admin-rights boundary)

When a `shader-slang/slang` PR's only failing check is the cross-repo **SlangPy Tests** job, the actual run lives in **shader-slang/slangpy** and is triggered by `repository_dispatch`. The CI babysitter bot **cannot** rerun it:

```
gh run rerun <id> --repo shader-slang/slangpy --failed
→ run <id> cannot be rerun; Must have admin rights to Repository.
```

**Why:** This is NOT the actions:write 403 gateway gap (that one was fixed 2026-06-17 for slang/actions/*). It is GitHub's structural behavior: `repository_dispatch`-triggered runs require repo-admin rights to rerun, and the bot is not an admin on `shader-slang/slangpy`. Distinct error string ("Must have admin rights to Repository"), distinct cause.

**How to apply:** When you confirm a slangpy SlangPy-Tests failure is a benign flake (classic signature: `sgl_tests.exe` reports `[doctest] Status: SUCCESS!` with all assertions passed, then the process exits 1 — a GPU device teardown crash on a self-hosted nvrgfx Windows runner), do NOT keep attempting the rerun. Record verdict=intermittent / result=left in the durable log, and surface it to parent as a blocked flake needing an author/slangpy-admin re-trigger. Re-attempting the gh rerun each sweep just returns the same error.

Systemic fix to recommend upstream: either grant the bot rerun/re-trigger rights on shader-slang/slangpy, or make `sgl_tests` propagate actual test status into its exit code so a clean teardown crash doesn't red the job. Observed on PR #11680, 2026-06-22.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782166177663-slangpy-tests-failures-on-slang-prs-are-not-bot-re.md`_
