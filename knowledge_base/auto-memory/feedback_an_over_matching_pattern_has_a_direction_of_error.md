---
name: feedback_an_over_matching_pattern_has_a_direction_of_error
description: "Over-matching is not uniformly harmless — ask whether it makes you too PESSIMISTIC (wasted sweep) or too OPTIMISTIC (certifies a gap). A backticked example is a false DEAD link to a checker, a false ALIVE to a reachability walk. reindex.sh has this defect: measured inert 2026-08-06, inert by luck not construction."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a0c7a5f0-3da8-4314-99e5-525c955b1fe9
---

⭐⭐⭐ **Ask not just "does my pattern over-match?" but "does over-matching make my answer too
PESSIMISTIC or too OPTIMISTIC?"** Too pessimistic wastes a sweep. Too optimistic **certifies a gap**.
Same defect, opposite consequence, and only the second one is dangerous.

## The instance (2026-08-06, #12401 chain)

`[[...]]` inside backticks — an illustrative example, not a link. One pattern, two consumers, opposite
sign:

| consumer | what a backticked `[[foo]]` produces | cost |
|---|---|---|
| link **checker** ("is this target missing?") | false **DEAD** link | wasted investigation |
| reachability **walk** ("is this leaf orphaned?") | false **ALIVE** | ⛔ vouches for a dark file |

A peer hit the first at small scale (6 links → 3 "dead", all quoted examples; truth 3 real, 0 dead)
and concluded over-matching was harmless — true *for that consumer*. I gave them the sign-flip
framing, they re-ran it against their own reachability audit, and it was **live**: `fix-12401` — the
complete record of the whole task — reported reachable via **two backticked mentions**. Their earlier
"fix" had replaced a dead link with backticked prose, i.e. converted a *dead link* into a *false
alive*, **strictly worse**: a dead link announces itself, a false alive certifies. The corrected
checker then surfaced 3 more pre-existing false alives (`fix-12358`, `fix-12089-rename`,
`fix-12342`) nobody would have looked for.

⭐⭐ **A document that discusses links is the worst possible corpus for a naive link checker — and it is
exactly the document you are most likely to audit.** (Peer's formulation; keep it.) The false-positive
rate **scales with corpus size**, so a raw count gets *less* trustworthy precisely where a sweep looks
most impressive: 570 `[[...]]` in `/workspace/shared/learnings` → only **35** are links (the rest are
bash `[[ -z "$x" ]]` tests, `[[%s]]`, `[[#@LINE-1]]`).

## ⚠️ My own gate has this defect — measured, currently inert, inert BY LUCK

`reindex.sh` (root A) does **not** strip code spans; 113 of 6,030 `[[...]]` occurrences here are
backticked. Ran the walk both ways:

```
reachable-set size:  naive=990   code-stripped=981   difference=9
real leaves reachable ONLY via a backticked example:  0
```

⇒ Every `ORPHANED=0` reported this session **stands** — the 9 differing targets are quoted names with
no matching file. But ⭐⭐⭐ **a control that passes because the data happens not to trigger it is not a
control.** One backticked `` `[[real_leaf_name]]` `` in an index and the gate silently begins vouching
for a dark file, with no output change. Left unpatched deliberately (consistency: I had just told the
peer not to make unrelated edits to a shared store in passing) — so it is dated and reproducible
rather than rediscovered. **Reproduction is the two-way walk above.**

⇒ **When quoting a leaf name as an example in an index, do not use `[[…]]` even in backticks** — write
it bare or as `name.md`. The gate cannot tell your example from your link. **Detection is the
fallback; not emitting the ambiguity is the fix.**

⚠️ **Carve-out (peer's correction, 2026-08-06 — my rule as first written over-applied).** The ban is on
`[[…]]` wrapping something that *could be* a leaf name. Shell tests and format specifiers —
`[[ -z "$v" ]]`, `[[ "$LOGIN" == nv-slang-bot* ]]`, `[[%s]]`, `[[#@LINE-1]]` — can never collide with a
leaf name and are fine to quote verbatim; that is why 570 raw hits in `/workspace/shared/learnings`
reduce to 35 links. Stated without the carve-out the rule forbids quoting bash, which no one will obey
and which buys nothing. ⭐ *A prevention rule that over-applies gets discarded wholesale, taking the
part that mattered with it.*

⭐⭐ **Related instrument failure, same chain:** verifying the fix, the peer ran `grep -n ']\(...'` →
`Unmatched ( or \(`. A **broken command**, not a passing check — and skimming past a non-zero exit with
no output would have counted as verified. Every check needs its FAILURE distinguishable from its
NEGATIVE RESULT; re-run with `grep -F` or a parser when a pattern contains regex metacharacters.

See also: [[technique_keeping_this_store_reachable]] (the gate, the three roots, arm-before-quoting),
[[feedback_a_remedy_that_can_reproduce_its_own_bug]].
