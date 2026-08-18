---
title: "CORRECTION — slang-rhi bot CLA is a commit-email mismatch, fixable by you, and not necessarily a merge gate"
type: learning
topic: slang-compiler
source: learnings/1785883512924-correction-slang-rhi-bot-cla-is-a-commit-email-mis.md
---

# CORRECTION — slang-rhi bot CLA is a commit-email mismatch, fixable by you, and not necessarily a merge gate

**This supersedes my earlier learning "slang-rhi bot PRs are blocked by an unsigned license/cla check", which was wrong on both of its load-bearing claims.** I wrote that resolving it was "an admin/legal action, not something a coworker can do", and that `gh pr list --state merged --author nv-slang-bot` returning `[]` meant "no bot PR has ever merged there, so don't assume it's routine." Both false, and the second is the more instructive error.

## The real cause: commit author email, not PR author

Two identities exist and only one has the CLA on file:

| | |
|---|---|
| **Covered** (app) | `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>` — account id `274397474` |
| **Not covered** (bare) | `nv-slang-bot <nv-slang-bot@users.noreply.github.com>` — resolves to a *different* account, id `286953280` |

The **PR-level author is the app in both cases**, so it is not the discriminator. Hand-passing
`-c user.email="nv-slang-bot@users.noreply.github.com"` produces the uncovered identity → `license/cla` pending.

Fix:
```bash
git -c user.name="nv-slang-bot[bot]" \
    -c user.email="274397474+nv-slang-bot[bot]@users.noreply.github.com" commit ...
# to repair existing commits (tree unchanged):
git ... commit --amend --no-edit --reset-author
```

**Verified causally:** slang-rhi#809 at `8d46f6a` had CLA pending; identity-only rewrite to `24400540`, tree byte-identical → *"All CLA requirements met."* Caveat: author and committer changed together, so which field the checker reads is unestablished — only that commit metadata is the discriminator.

## It does not necessarily block merge

slang-rhi#808 was merged by a maintainer with `license/cla` **still pending**. Report it; don't present it as blocking. And never suggest a maintainer merge past a compliance check — that is repo policy, not a bot's call.

## The methodology error worth copying down

`--author nv-slang-bot` returns `[]` because the author is `nv-slang-bot[bot]`, a different string. **An empty result from a filter whose value you guessed is a fact about your filter, not about the world** — and I turned it into a published negative claim ("no precedent either way"), which then argued *against* trying the cheap fix. Same family as: a bounded grep returning zero is a fact about the boundary; positive-control any zero before citing it. The control here was one command: list merged PRs unfiltered and grep. Bot PRs **have** merged in slang-rhi — #806, #782, #808.

## Bonus: squash-merge rewrites the author

#808's merge commit landed as `nv-slang-bot[bot] <274397474+...>`, committer `GitHub <noreply@github.com>`, despite the branch commit carrying the bare identity. So *merged* bot commits always look correct — surveying `main` tells you nothing about what a branch commit looked like, and this is why the mismatch is invisible until a CLA check flags it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785883512924-correction-slang-rhi-bot-cla-is-a-commit-email-mis.md`_
