---
title: "Control the instrument, not the reasoning — 10 measurement defects in one session, and the citation-tightening tell"
type: learning
topic: agent-ops
source: learnings/1785827764500-control-the-instrument-not-the-reasoning-10-measur.md
---

# Control the instrument, not the reasoning — 10 measurement defects in one session, and the citation-tightening tell

# Ten measurement defects in one exchange — none findable by re-reading the argument

**2026-08-04**, across four agents (triager, orchestrator, fixer, and one inherited from a prior
session) on shader-slang/slang#11616. Recorded because the *distribution* is the finding, not any
single defect.

## The core observation

Every one of the ten defects was in the **measurement**, never in the inference. Each argument was
re-read several times and read fine every time, because reasoning has no access to this defect class.

⇒ **"Check your work" and "run a control on your instrument" feel identical from the inside, and only
the second one works.** Ten for ten, every defect was found by returning to the artifact.

## ⭐ The citation-tightening tell (the least intuitive finding)

The recursion isn't merely *a fix shares the defect it fixes*. Specifically:

> **The instrument you reach for when tightening a citation is the one that drops the citation data.**

Rounds 7–10 were each produced by an argument built to secure the previous one, and **three of the four
were the same class**: reading source with a *range-printer* (`sed -n '336,372p'`, `git show`) whose
output carries **no line numbers**, then citing a line number counted by eye. Two agents each did it
twice — in the exchange where they were flagging it at each other.

**Rule: `grep -n` for anything you intend to cite. Never a range-printer.** Concrete misses this
produced: `:361` for `:363`, `:2785` for `:2787`, `:344-346` for `:345-351`, `:4139-4190` for
`:4296-4305` (off by ~125 lines).

## The instrument-defect checklist (execute with a positive control per item)

For a claim about *who may do what to which files*: path pattern · extension · **status (A/M/D)** ·
authorship · **resolved** committer identity · push-vs-server-side · **which App** · then:

- **7a — can the instrument return a non-zero answer at all?** Needs a positive control on the *same*
  filter. Real case: `gh api repos/X/commits?author=nv-slang-bot[bot]` → **0** for an author with 157
  commits. The **bracketed login silently matches nobody**; `author=jkwak-work` → 100 proves the param
  works. A zero without a non-zero control is not evidence.
- **7b — can the output carry the claim?** Wrong ref, wrong format, interleaved fields:
  - **`git log`/`git show` suppress diffs for merge commits by default — pass `-m`.** This inverted a
    finding: a search for "has our App ever pushed a commit *adding* a `.github/workflows/` file?"
    returned 0, when the true answer is **6 commits**. The blind spot (merge diffs) and the subject
    (whether merges can be pushed) were *the same object*.
  - **Free-text vs resolved identity.** `commit.committer.name` is arbitrary text; `committer.login` is
    the resolved GitHub identity. One commit read as `claude[bot]` by name was
    `committer.login=github-actions[bot]` — a different credential class entirely (Actions token, not
    an App installation). **Prefer the resolved field for any permission claim.**
  - Squash-merge means a bot's pushed commits **never enter master's first-parent history**;
    `repos/../commits` on master can only show squashed results. Branch refs are where that evidence
    lives.
  - `--format='%H %cn'` + `--name-only` interleaves so identity and filenames separate — a filename
    list can be misread as the answer.
  - `-g3` embeds source, so a test's own `CHECK`/`NOSCOPE` **comment lines** match a naive grep of the
    emitted output (16 raw mentions vs 14 actually emitted). Anchor on
    `OpExtInst %void %N DebugNoScope`.
  - Binary `-target spirv` output vs `spirv-asm` — grepping the binary yields null-byte artifacts.

## Two other rules earned here

- **A correct conclusion does not license its explanation.** Four instances rode conclusions that were
  right or harmless, which is exactly why none drew pushback from outcomes: a stale-by-5h binary cited
  for an assert line; a committer timestamp (04:18Z) quoted as a merge time (05:41:09Z); "the `.so` is
  dated today, fetched by this build" when mtimes were 8+ days old; "codegen drift" for a number that
  turned out to be a forced 1:1 identity.
- **Before asserting containment, enumerate the dimensions the claim needs *first*, then check each** —
  not the dimensions the investigation happened to surface. A precedent is scope-bound, and its scope
  is the set of dimensions you thought to compare. A superset claim verified on extension + path class
  + authorship + push-transited still failed, because **status (added vs modified)** was never on the
  ladder.

## Coordination note

Two tiers ruled to the same coworker within one minute (same verdict, different assertion shape — one
of which permitted a mistake). Standing rule adopted: **overlap on review, singleton on dispatch.**
Both tiers reason in the open where a second reader can find a premise-to-conclusion gap; exactly one
instructs the coworker.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785827764500-control-the-instrument-not-the-reasoning-10-measur.md`_
