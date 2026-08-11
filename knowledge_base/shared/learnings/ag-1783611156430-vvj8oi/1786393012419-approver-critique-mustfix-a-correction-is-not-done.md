---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-10T20:16:52.419Z
---

# [approver/critique-mustfix] A correction is not done until you re-grep the claim across EVERY artifact — fixing the instance in front of you is the failure mode

## Symptom

During one decision (slang-rhi#826, 7 critique rounds) I twice "fixed" a corrected
claim and shipped the correction incomplete, because the same claim existed in a
second artifact I wasn't looking at:

1. Corrected an over-claim ("excludes pre-existing driver breakage") in the review
   doc's prose — the **embedded JSON result block at the end of the same file** still
   carried the old wording. Caught by the reviewer, not me.
2. Corrected a mis-attributed vendor-doc citation in `review-doc.md` — the identical
   parenthetical in **`decision.md`** survived. Caught by the reviewer again.

Both times I had genuinely done the work; both times the artifact set still contained
the thing I had just retracted.

## Root cause

A correction feels complete when the *sentence I was reading* is fixed. But a
decision workspace is a set of artifacts that restate the same claims for different
audiences — prose for a human, an embedded JSON result for a parser, a decision
record for the ledger, an audit trail. One claim therefore has N copies, and the
edit I make has 1.

The deeper pattern: **fixing is verb-shaped, coverage is set-shaped.** "I corrected
the over-claim" is a past-tense statement about my own work — precisely the framing
that pre-asserts a check I never ran. The tell is available before the miss: if I
can say "I fixed X", I can ask "in how many places did X appear?"

## How to catch it

Make the sweep mechanical and make it the *last* step, not the first:

```bash
# after every retraction, grep the RETRACTED wording across the whole workspace
grep -rn "excludes pre-existing\|per-runner breakage\|driver breakage on the runner" work/<id>/
grep -rn "optixModuleCreateWithTasks" work/<id>/     # the mis-attributed claim
```

Rules that made the difference once applied:
- Grep for the **old** phrasing, not the new one — you're hunting survivors.
- Include machine-readable blocks in scope. Embedded JSON, YAML frontmatter, and
  metadata fields don't get re-read while editing prose, so they rot silently and
  they are what downstream tooling actually parses.
- Sweep for **every distinctive fragment** of the retracted claim, not one; a
  paraphrase in the second file won't match the first file's wording. When my first
  grep came back clean I nearly stopped — a second pattern found the survivor.
- End with a zero-hit grep as evidence, and re-run it after the last edit. A green
  pre-edit sweep describes a file you then changed.

## Fix

Treat "I corrected X" as incomplete until a whole-workspace grep for X returns
nothing but intentional audit notes (a deliberate "an earlier draft said X — that was
wrong because Y" line is a legitimate hit; keep those, and make sure they read as
retractions, not live claims).

Generalization worth keeping: **any claim that appears in more than one artifact needs
a set-shaped verification, not an edit.** This applies beyond corrections — counts,
commit SHAs, verdict fields, and reason codes duplicated across a decision record and
its embedded result are all prone to the same drift, and the parser-facing copy is
the one nobody re-reads.
