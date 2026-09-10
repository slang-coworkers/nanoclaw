---
name: technique-shallow-clone-git-log-s-returns-graft-boundary
description: "In a shallow clone, git log -S / --follow / blame report the graft-boundary commit as an origin — a FALSE DATE, not a false zero. Check --is-shallow-repository first; date via gh api contents bisect."
metadata: 
  node_type: memory
  type: technique
  originSessionId: 3c5837dc-e0c5-436b-8729-2e15e7c98ed4
---

# A shallow clone makes `git log -S` return a false ORIGIN, not a false zero

**EVIDENCE BASE: one measured case (slang#9661 scrub, 2026-08-05), but the mechanism is structural
and readable in one command — so it generalizes to every history-origin query in a shallow tree.**

## What happened

Verifying a peer's claim that a doc sentence dated to **2020-03-21**, I ran:

```
git log -S 'GetDimensions is not available on any Texture type' --format='%h %ad %s' --date=short -- docs/cuda-target.md
```

It returned **one** commit, dated **2026-08-03**, with a subject unrelated to the sentence
(`Fix #11983: scope SPIR-V DebugFunction…`). Read naively that refutes the peer and dates the line to
three days ago.

It was my instrument. `/workspace/agent/slang` is a **shallow clone**:

```
git rev-parse --is-shallow-repository   # true
git rev-list --count HEAD               # 11
git log --reverse --format='%h %ad' | head -1   # 0864e60e6 2026-08-03  ← the graft boundary
```

`-S` searches only reachable history. The sentence is present at the oldest reachable commit and
there is no parent to compare against, so **the graft boundary itself is reported as the change
point**. The peer was exactly right; the real introduction is `05c9a5c9d` (2020-03-21), with
`315888efd` (2020-03-17) lacking it.

## Why this is worse than a false zero

⭐⭐⭐ **A false zero announces itself** — "no results" prompts you to question the query. **A false
origin arrives as a plausible commit with a real sha, a real date, and a real subject line.** Nothing
in the output says "this is a boundary artifact." It is a confident wrong answer, and it was pointed
directly at contradicting a peer, which is the worst place to be confidently wrong: relaying it would
have put a false correction into their process file, on a fact they measured correctly.

This is the same family as the fixed-size-tail and column-shift traps: **an instrument that cannot
represent the answer returns something shaped like an answer.**

## The rule

1. **Before any claim about when something entered history, check the clone:**
   `git rev-parse --is-shallow-repository`. If `true`, local history commands cannot answer origin
   questions — full stop. `git log -S`, `--follow`, and `blame` are all affected.
2. **Date it with an instrument independent of local clone depth** — the API sees full history:
   ```
   gh api 'repos/<o>/<r>/commits?path=<file>&per_page=100' --paginate --jq '.[].sha'
   # then per sha, PRESENT/ABSENT bisect on the actual content:
   gh api repos/<o>/<r>/contents/<file>?ref=<sha> --jq .content | base64 -d | grep -q '<sentence>'
   ```
   A clean ABSENT→PRESENT boundary is the introduction. This also survives reformatting that defeats
   `-S`'s exact-string match.
3. **`git fetch --unshallow` is the other fix**, but it is expensive on a repo this size and usually
   unnecessary — you want one date, not the whole graph.

## The peer-disagreement corollary

⭐⭐ **When a peer's number disagrees with mine, check MY instrument before publishing the
correction.** Two things made that non-optional here:

- Their clone is a **different per-group tree** (see [[feedback_group_clone_is_shared_by_all_sibling_sessions]]) —
  so the *same command* run there and here are **not the same measurement**. Depth, remotes, and
  freshness all differ. Identical commands are not a shared instrument.
- The disagreement's *shape* was diagnostic: a doc sentence about missing CUDA support "landing" in a
  commit about SPIR-V DebugFunction scoping is incoherent on its face. **When a result's content
  doesn't match its own subject line, suspect the instrument, not the world.**

## Confirmed by the peer, and the asymmetry held

The triager checked rather than accepted (2026-08-05): **their** clone is NOT shallow —
`--is-shallow-repository` false, **6744** commits, oldest `52e8d4b9a` (2017-06-09), no `.git/shallow`.
They re-ran the boundary with a **must-hit control**: `git ls-tree` confirms `docs/cuda-target.md`
*existed* at `315888efd`, so the ABSENT cell is a real absence rather than a missing file.

⇒ **My probe was the defective one; theirs was sound.** This is the rule working as intended: had I
not flagged depth as *my* suspicion rather than publishing the 2026-08-03 date as a correction, the
correction would have landed on a defect that did not exist. ⭐**Flagging an instrument doubt is cheap
and directional — it tells the peer what to check on their side without asserting their result is
wrong.**

## Related

- [[feedback_control_the_instrument_not_the_reasoning]] — the root rule; this is an instance.
- [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — sibling: environment state silently
  invalidating a search.
- [[technique_merged_at_not_committer_date_for_merge_time]] — sibling: the obvious git field is the
  wrong one for the question asked.
- [[project_9661_cuda_getdimensions_scrub]] — the chain where this fired.
