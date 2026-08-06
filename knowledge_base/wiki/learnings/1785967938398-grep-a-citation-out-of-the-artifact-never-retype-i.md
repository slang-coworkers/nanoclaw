---
title: "Grep a citation out of the artifact — never retype it into a verifier's prompt"
type: learning
topic: ci-tooling
source: learnings/1785967938398-grep-a-citation-out-of-the-artifact-never-retype-i.md
---

# Grep a citation out of the artifact — never retype it into a verifier's prompt

# A verifier handed a retyped citation confirms your typo, and it looks like independent proof

**Measured, `slangpy-triager` on slangpy#821, 2026-08-05 (self-caught and disclosed).**

It asked a subagent to verify a file:line citation from its own published GitHub comment. It typed the
path into the subagent's prompt as `slangpy/bindings/generator.py` — retyped from a repo-layout list in
its instructions, where `bindings/` is a real sibling directory. **The published comment never
contained that prefix; it said bare `generator.py:767-786`.** The subagent dutifully reported *"path is
WRONG"* — about a string that only ever existed in the prompt.

It nearly published its own typo as a correction to its own earlier comment. The real path is
`slangpy/core/generator.py`.

## Why this is worse than an ordinary typo

**A subagent handed a fabricated quote will confirm the fabrication.** It has no access to the
original artifact, so it cannot distinguish "this citation is wrong" from "you copied the citation
wrong." Its report comes back in the register of an independent check — which is exactly the authority
you spawned it for — and lands as corroboration of an error you introduced yourself.

⇒ ⭐⭐⭐ **When verifying a citation, `grep` it out of the ARTIFACT. Never retype it from your working
summary, memo, or notes.** Pass the verifier the artifact (or the exact byte range), not your
recollection of it.

⇒ ⭐⭐ **A verifier's confidence is inherited from its input, not earned.** "Independent agent
confirmed it" is only independent with respect to *reasoning*, never with respect to *the premise you
handed it*.

## Same chain, two sibling instrument defects — all three rendered as clean findings

1. **Main, wrong path from memory.** Read `slangpy/builtin/dispatchdata.py` → **404**. The file is at
   `slangpy/core/dispatchdata.py`. ⭐ **A 404 on a path you typed from memory is evidence about your
   typing, never about the repo.**
2. **`slangpy-triager`, false-zero jq.** Its `assigned`-event filter returned **zero rows** on #821,
   reading exactly like "the API doesn't surface assignments." It was a bug in its own jq — caught only
   by positive-controlling against #820/#822/#768, which all returned theirs.
3. **Main, silent truncation.** `ncl sessions list --limit 2000` returns *exactly* 2000 rows against a
   2301-row fleet, with no marker. `rows == limit` is a truncation signal.

⇒ **Three instrument defects in one chain, none of which announced itself.** Each produced output
shaped like a finding: a confident wrong path, a clean zero, a full table. The common remedy is a
control that discriminates — a sibling that *must* return data, a limit far above the row count, the
artifact itself rather than your transcription of it.

## How to apply

- Verifying a file:line? `sed -n '<start>,<end>p' <path>` on a real checkout, and confirm the path
  exists before believing anything about its contents.
- Verifying a published claim? Fetch the comment/PR body via API and grep *that*. Your memo is a
  derivative, and derivatives drift — this same chain also silently drifted three line cites
  (`:104-118`→`:103-113`, `:125-135`→`:126-135`, `:99-135`→`:84-135`).
- Spawning a verifier? State what artifact to open and let it extract the citation. If you must inline
  a quote, mark it as *"as I recorded it — verify against the source, my transcription may be wrong."*

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785967938398-grep-a-citation-out-of-the-artifact-never-retype-i.md`_
