---
title: "A green check that depends on an external mutable input is not a durable green"
type: learning
topic: misc
source: learnings/1786005179247-a-green-check-that-depends-on-an-external-mutable-.md
---

# A green check that depends on an external mutable input is not a durable green

## The trap

A CI check can flip from pass to fail with **no change to your repo, your pin, or the check script** — because it resolves something a *third party* controls and that party moved it.

**Concrete case (shader-slang/slang, 2026-08-06):** `extras/check-submodule-commits.sh` verifies each submodule pin is reachable from its tracked ref. With no `branch =` in `.gitmodules`, it resolves the **remote default branch** (`git ls-remote --symref <url> HEAD`). `external/mimalloc` was pinned at `8c532c32…` (= `refs/tags/v2.1.7^{}`) with no `branch =` line, and the check passed. Then microsoft/mimalloc moved its default branch from `main` to **`main3`** (the v3 line). The pin is an ancestor of `main` but **not** of `main3` ⇒ the check started failing. Nothing on our side changed.

Worse: the PR that introduced the gap recorded in its own notes *"no `branch=` — pin reachable from `refs/tags/v2.1.7`, pin-check passes."* That was **true when measured**. Nothing in the repo, the git history, or the original verification would ever have flagged it later.

## The rule

When a check's outcome depends on an **external mutable input** — a remote default branch, `latest`, a floating tag, "newest release", an unpinned action `@v1`, a package dist-tag — the *absence* of an explicit override is a latent failure, not a durable pass. **Pin the ref explicitly even when the check currently passes.**

Corollary for verification notes: "verified passing" on such a check is only a point-in-time observation. Record *what it resolved to* (e.g. "resolved default = `main`"), so a later reader can tell whether the input moved rather than re-deriving the whole diagnosis.

## Two adjacent facts worth knowing (measured, not inferred)

- That script accepts a **tag** name in `branch =`: it tries `refs/heads/<name>` then `refs/tags/<name>`. So `branch = v2.1.7` is legal and is the **stronger** fix than `branch = main` — a tag is immutable, a branch moves. In-repo precedent: `external/fast_float` has `branch = v8.2.7` (tag), `external/lua` has `branch = v5.4` (branch).
- Cross-org authenticated REST reads can 401/403 from a bot token (`gh api repos/microsoft/mimalloc` fails). **Unauthenticated `git ls-remote` / `git fetch` is the working path** for checking an upstream default branch and testing reachability.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786005179247-a-green-check-that-depends-on-an-external-mutable-.md`_
