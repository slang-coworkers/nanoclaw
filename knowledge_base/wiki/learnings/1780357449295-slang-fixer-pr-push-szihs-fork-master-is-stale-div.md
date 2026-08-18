---
title: "slang fixer PR push: szihs fork master is stale/divergent (lacks docs/generated framework) → GitHub-App 'workflows permission' rejection; jkwak fork auth fails"
type: learning
topic: agent-ops
source: learnings/1780357449295-slang-fixer-pr-push-szihs-fork-master-is-stale-div.md
---

# slang fixer PR push: szihs fork master is stale/divergent (lacks docs/generated framework) → GitHub-App "workflows permission" rejection; jkwak fork auth fails

> **[prod-adaptation]** This learning was ported from the dev instance. PROD has **no szihs PAT and no szihs fork**. Prod pushes `fix/issue-<n>` **direct to `origin = shader-slang/slang`** as `nv-slang-bot[bot]` (see `slang-fixer-can-push-fix-branches-direct-to-origin`). Ignore any szihs-fork / personal-token push path below; treat it as historical dev context.

# slang fixer PR push: szihs fork master is stale/divergent (lacks docs/generated framework) → GitHub-App "workflows permission" rejection; jkwak fork auth fails

When opening a draft PR as nv-slang-bot[bot] for shader-slang/slang, fork-push has two traps (hit 2026-06-02 on #11410, a docs/generated tooling fix):

1. **szihs fork** (`github.com/szihs/slang`) — the bot CAN authenticate here (host proxy has creds), and prior `fix/issue-<n>` branches live here. BUT its **`master` has diverged and is far behind** origin/master — at the time of writing it predated the entire `docs/generated/tests/` agentic-test framework (regenerate.py + catalog dir absent on szihs/master; `git merge-base --is-ancestor szihs/master origin/master` → false). Pushing a branch based on current `origin/master` therefore carries the full multi-commit delta, which includes new `.github/workflows/*.yml` files. A GitHub **App** token without `workflows` scope is then rejected: `! [remote rejected] ... refusing to allow a GitHub App to create or update workflow '.github/workflows/ci-agentic-tests-nightly.yml' without 'workflows' permission`. You can't rebase your commit onto szihs/master either, because the files you edited don't exist there.

2. **jkwak fork** (`github.com/jkwak-work/slang`) — its master IS in sync with origin/master (no workflow delta), but `git push jkwak` → `fatal: Authentication failed` (the host proxy injects creds only for origin + szihs, not jkwak).

3. **Upstream** (`shader-slang/slang`) — a branch push would succeed (delta vs origin = just your commit, no workflow files), and bot `claude/issue-*` branches do exist on origin. BUT the fixer mode rule says "MAY NOT push to upstream." Don't do it without explicit operator authorization.

**Practical fallback:** when the writable fork (szihs) is blocked by the workflow-permission delta, use the patch fallback — `git format-patch origin/master --stdout > /workspace/agent/patches/fix-<n>.patch` (preserves bot author + message, applies via `git am`), attach it to the parent, and escalate the publish decision (authorize upstream branch push / grant bot `workflows` scope or sync szihs master / human applies patch). The diagnostic that distinguishes the two failure modes: `git diff --name-only szihs/master..HEAD | grep '^.github/workflows/'` (non-empty ⇒ you'll hit the workflows block).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780357449295-slang-fixer-pr-push-szihs-fork-master-is-stale-div.md`_
