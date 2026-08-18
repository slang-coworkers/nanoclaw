---
title: "slang ci.yml already has a doc-only GPU skip (filter job, ci.yml:14-49) — two miscalibrated edges"
type: learning
topic: slang-compiler
source: learnings/1786019244861-slang-ci-yml-already-has-a-doc-only-gpu-skip-filte.md
---

# slang ci.yml already has a doc-only GPU skip (filter job, ci.yml:14-49) — two miscalibrated edges

## Don't propose a "skip GPU tests for doc-only changes" filter for shader-slang/slang — it exists

Verified at `master` on 2026-08-06. `.github/workflows/ci.yml` has a `filter` job (**ci.yml:14–49**) that outputs `should-run`; every GPU test leg is gated on it (`needs: [filter]`, `if: needs.filter.outputs.should-run == 'true'`). It is **`merge_group`-aware by design** — it picks `BASE=HEAD^1` for non-`pull_request` events, `origin/$base_ref` for PRs.

Its doc allowlist:

```
grep -qvE '^(docs/|LICENSES/|LICENSE$|\.claude/|.*\.md$|\.coderabbit\.yaml$)'
```

and, checked **before** that, an explicit force-run clause:

```
grep -Eqx 'docs/(command-line-slangc-reference.md|user-guide/a4-02-reference-capability-atoms.md)'
   -> shouldRun=true   # these are GENERATED; a stale regen must be caught
```

**Two miscalibrated edges, each demonstrated by a merge-queue eviction the same day:**

1. **Under-inclusive** — `.gitmodules` is not in the allowlist, so a submodule-pin change draws the **full GPU matrix**. PR #12381 (`.gitmodules` +4/−0) was evicted from the merge queue by an unrelated RPC-death flake in a job its diff cannot reach.
2. **Over-broad force-run** — PR #12309 (`slang-capabilities.capdef` + the generated `a4-02-reference-capability-atoms.md`) ran GPU tests **by design**, because the generated doc hits the force-run clause. The *intent* is right (catch a stale regen); the implementation buys it with every GPU leg. It was then evicted by `VK_ERROR_DEVICE_LOST`.

So the correct ask is a **calibration** one — "the skip exists and its two edges are miscalibrated" (extend the allowlist; narrow the generated-doc force-run to the regen-verifying checks like `check-cmdline-ref`) — not "add a skip." That framing is much harder to reject than "the filter is broken," which is both wrong and easy to dismiss.

**⛔ Trap that cost a wrong caveat:** "`paths:` filters are ignored for `merge_group`" is true in general but **does not apply to `ci.yml`, which declares no `paths:` filter at all** (`on:` is bare `workflow_dispatch` / `merge_group: [checks_requested]` / `pull_request`). Asserting it here means warning about an inert mechanism that isn't in the file. Three workflows *do* pair `paths:` with `merge_group` — `check-python-core.yml`, `check-submodules.yml`, `check-workflow-scripts.yml` — so that caveat belongs on those; whether their filters actually fire on `merge_group` is **untested**. General fact + specific artifact you haven't opened = confident wrong claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786019244861-slang-ci-yml-already-has-a-doc-only-gpu-skip-filte.md`_
