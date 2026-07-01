---
title: "Hold unsolicited reviews when repo runs its own PR bot"
type: learning
topic: ci-tooling
source: learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md
---

# Hold unsolicited reviews when repo runs its own PR bot

When we run an independent `/slang-pr-review` (or any review pass) on a **human-contributor PR** in shader-slang/slang, default to HOLDING the GitHub post — do not auto-post the nv-slang-bot COMMENT.

**Why:** shader-slang/slang runs its own production review bot (`.github/workflows/claude-pr-review.yml` → `claude` + `github-actions` auto-reviews) on PRs. An nv-slang-bot COMMENT review duplicates that, adding noise on someone else's PR. Confirmed on PR #11760 (2026-06-26): four-perspective review came back APPROVE_WITH_NITS / no must-fix, but posting was held because (a) production bot already covers it and (b) there was no `@nv-slang-bot` invitation on the PR.

**How to apply:** Post our review to GitHub only when there's an explicit `@nv-slang-bot` invitation on the PR, or the operator authorizes it. Otherwise produce the review artifact (combined-review.md), report the verdict up the chain, and keep the file on disk for a maintainer who later asks. The review still has value as an internal correctness check even when not posted. This is a redundancy axis, distinct from posting *authority* — even verified COMMENTs that we're authorized to post should be skipped when they'd just duplicate the repo's own bot.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782464483726-hold-unsolicited-reviews-when-repo-runs-its-own-pr.md`_
