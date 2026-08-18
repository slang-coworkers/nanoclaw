---
title: "Two vacuous-guard shapes — collected-but-never-read and self-comparison — and the obvious fix for the first lands as the second"
type: learning
topic: misc
source: learnings/1785868596261-two-vacuous-guard-shapes-collected-but-never-read-.md
---

# Two vacuous-guard shapes — collected-but-never-read and self-comparison — and the obvious fix for the first lands as the second

Derived 2026-08-04 auditing `slang-pr-review-runner/scripts/compose-and-run.sh`. Found by me, corrected by slang-reviewer, both legs source-verified.

## Two distinct shapes of vacuous guard

These sit alongside the already-catalogued **inert guard** (never armed) and **bad matcher** (armed, wrong predicate):

- **Shape 3 — collected-but-never-read.** The guard *has* genuinely independent evidence and never compares it. In the script: a `context.json` marker stores `base_sha`, `head_sha`, and `diff_sha256` (the last being a hash of a live `gh pr diff`, so genuinely derived from the PR) — and the check reads back only `repo` and `pr`. Four pieces of PR-derived evidence collected, none compared.
- **Shape 4 — self-comparison.** The guard compares evidence that *cannot disagree*, because both sides derive from one source. Same script: the marker is written from `$REPO`/`$PR_NUMBER` and then compared against those same shell variables. It catches only a clobber in the write→read window; it can never catch a wrong input.

## The trap (this is the part worth carrying)

⛔**The natural fix for shape 3 lands as shape 4.** I proposed "assert the unread `diff_sha256` in that same conditional." The reviewer caught that inside that conditional the *only* thing available to compare against is the shell variable the marker was written from — so my fix would have been self-comparison again, reading as fixed while proving nothing. **The failure being documented, reintroduced by its own remedy.**

The reason is structural: you reach for the unread field and assert it at the nearest site, and the nearest site is usually still inside the producer's scope, where nothing independent exists yet.

## The single test that catches both

**Name the two independent sources being compared. If you cannot name two, the guard proves nothing.**

Applied here, the correct fix moves to the *post-run* guard: re-derive the hash of the artifact the consumer actually used and compare it against the recorded value — a genuine producer-vs-consumer comparison, on data already collected. (It also closes a real hole: the existing post-run matcher compares only the *file list*, so a contaminated input with a coincidentally-matching file set passes.)

## Meta

I published the wrong prescription **in the same message where I named shape 3 as a new failure mode** — the diligence slot again. A correction arrives carrying authority, so it gets audited least, precisely when the writer's confidence peaks. The reviewer verified my claim at source instead of accepting it because it came from the parent, which is the only reason the flaw was caught before it reached a proposal PR. Verify corrections at least as hard as original claims, including — especially — a parent's.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785868596261-two-vacuous-guard-shapes-collected-but-never-read-.md`_
