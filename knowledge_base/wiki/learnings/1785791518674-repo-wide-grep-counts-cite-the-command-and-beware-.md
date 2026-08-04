---
title: "Repo-wide grep counts: cite the command, and beware the stale slang-r0 snapshot"
type: learning
topic: slang-compiler
source: learnings/1785791518674-repo-wide-grep-counts-cite-the-command-and-beware-.md
---

# Repo-wide grep counts: cite the command, and beware the stale slang-r0 snapshot

Two related traps hit while reconciling a repo-wide occurrence count in a Slang PR review (shader-slang/slang#12334, Gap 1: "the generator prompt still mandates `-o /dev/null`, N occurrences under `docs/`").

**1. `/workspace/agent/slang-r0/` is a stale NON-GIT snapshot, not a checkout.** No `.git` (so `git log`/`git status` error out), and its content predates current master. It ships its own `CLAUDE.md`, so it's loaded into context and reads like a peer clone. A repo-wide `grep -r` that lands there returns inflated pre-current numbers with **no error and no staleness signal**. Measured 2026-08-03 vs `/workspace/agent/slang` at master `5b3f7a24`:

| measure | `slang` (git) | `slang-r0` (stale) |
|---|---|---|
| files under `docs/generated/tests` | 3323 | 3274 |
| `/dev/null` occurrence-lines under `docs/` | 833 | 893 |
| `/dev/null` files under `docs/` | 788 | 848 |
| `dump-ir` occurrence-lines under `docs/` | 951 | 993 |

Search and cite from `/workspace/agent/slang` only; run `git log -1` first — if it errors, you're in the wrong tree.

**2. A bare count is an unverifiable claim; cite the command + scope + commit.** "833 occurrences under `docs/`" is ambiguous between `grep -rl` (files) and `grep -r` (matching lines), and between `docs/` and `docs/generated/tests`. At master `5b3f7a24` those four combinations give 788 / 833 / 786 / 828 — all defensible, all different. A maintainer re-running a bare number and getting a third figure undercuts an otherwise sound finding. This generalizes the "a file:line authenticates the location, never the scope of the claim built on it" lesson: a *count* authenticates a command over a scope, and omitting either leaves the same gap.

**3. Sanity check before reconciling two counts — occurrence-lines can never be FEWER than the files containing them.** When one agent reported 833 occurrences and another 932 files, "different denominators, same order of magnitude" looked reasonable but is arithmetically impossible: 932 files each containing ≥1 match forces ≥932 occurrence-lines. That impossibility is the tell that the two measurements came from different trees or scopes, and it's worth surfacing rather than bridging. Prefer flagging an unreproducible number over manufacturing a reconciliation — the underlying finding usually survives on facts the count doesn't affect (here: the prompt text at `_common.md:881-885` and the nightly job at `nightly-slang-test.yml:137`, both independent of magnitude).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785791518674-repo-wide-grep-counts-cite-the-command-and-beware-.md`_
