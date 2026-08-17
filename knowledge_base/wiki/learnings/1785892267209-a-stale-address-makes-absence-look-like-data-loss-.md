---
title: "A stale ADDRESS makes absence look like data loss — resolve the path before trusting a zero"
type: learning
topic: misc
source: learnings/1785892267209-a-stale-address-makes-absence-look-like-data-loss-.md
---

# A stale ADDRESS makes absence look like data loss — resolve the path before trusting a zero

Seventh distinct instrument failure in one evening's work on slang-rhi#810, and a **new mechanism** —
distinct enough from the other six that its remedy is different.

## What happened

I grepped the shared memory index for my own entry (`fix-rhi-12349`) to confirm it was still reachable
after a concurrent write by a sibling session. It returned **0**. My next action would have been to report
a dropped index line — i.e. a data-loss bug — which would have sent someone hunting a fault that did not
exist.

The entry was intact. A sibling had performed a planned structural compaction, relocating the fix log out
of `MEMORY.md` into a new `active-fixlog.md`, where my line sat unharmed at `:17`. **My grep was correctly
reporting absence at an address that had moved.**

## Why this one is different from the other false zeros

The familiar false-zero mechanisms are about the *query* or the *text*: a line-based grep can't see a
wrapped phrase; an empty fetch greps clean; markdown emphasis defeats a literal pattern; normalizing one
side of a comparison desynchronizes needle from haystack. Each is fixed by repairing the query or adding a
positive control.

This one has a working query, a correct answer, and a control would not have helped — a positive control
run against the same stale path would *also* have come back empty. The defect is in the **address**, one
layer beneath the query.

## The remedy

**Resolve the address before trusting the absence.** Concretely, when a zero would license a claim about
missing data:

- `ls` the file you are grepping, or list the containing directory, and confirm the *container* is what you
  think it is.
- Grep the **directory**, not the remembered path: `grep -rl <slug> <store>/` finds the entry wherever it
  now lives.
- Grep for a **stable identifier** (the issue number, the slug) rather than assuming the file layout.

**In any store multiple agents write to, a path is a moving target the same way a line number is.** I had
already learned that about line numbers on this same task — one anchor moved four times across three
commits (`:406`→`:426`→`:441`→`:445`) and I falsified a citation once by rewriting half of a ref-pinned
pair. The path version of the lesson arrived four hours later and I nearly failed it.

## The generalizable form

A zero has at least three failure modes stacked, and they need different fixes:

| the zero is wrong because… | remedy |
|---|---|
| the **query** can't match (wrap, markup, asymmetric normalization) | fix the pattern; positive control |
| the **haystack** is empty or unfetched | assert the input is non-empty |
| the **address** moved | resolve the container; grep the directory, not the path |

Before reporting missing data, ask which of the three you have ruled out. A control only covers the first.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785892267209-a-stale-address-makes-absence-look-like-data-loss-.md`_
