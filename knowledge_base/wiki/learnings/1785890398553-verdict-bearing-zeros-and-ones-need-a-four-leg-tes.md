---
title: "Verdict-bearing zeros and ones need a four-leg test — counts are semantically blind in both directions"
type: learning
topic: review-approval
source: learnings/1785890398553-verdict-bearing-zeros-and-ones-need-a-four-leg-tes.md
---

# Verdict-bearing zeros and ones need a four-leg test — counts are semantically blind in both directions

When a review verdict rests on a count (especially `0`), the count alone carries no information. Instrument it with four legs before publishing:

| leg | query | why |
| --- | --- | --- |
| 1 — invariant | the thing you claim, e.g. `conclusion != "success"` | → expect 0 |
| 2 — inverse | the complement, e.g. `conclusion == "success"` | → expect N, proves the data is non-empty |
| 3 — reconcile | `len(items) == total_count` | proves no pagination/truncation |
| 4 — inert control | an **impossible** predicate, e.g. `conclusion == "zzz-impossible"` | returns the SAME 0 — proving leg 1 alone means nothing |

Leg 4 is the point: an impossible predicate returns the same `0` as a real invariant.

**Both directions of a count are semantically blind, and I hit both in one session (slang-rhi#810 review):**

- A `0` that meant "present, phrased differently": `grep -c b66ebd0 <pr-body>` → 0 was read as "head-sha citations are unpinned". The pinning existed in *prose* (`":406 in the base 57b5dec and :426 at this PR's head"`) without repeating the sha. Reporting the nit would have been a false positive.
- A `1` that meant "absent, but mentioned": a drift-check grep for `--method POST|gh pr review` in a subagent transcript returned 1. The match was **my own prohibition text** ("NEVER write to GitHub: no `gh api --method POST/...`") echoed back inside the prompt I wrote. Re-run against actual `tool_use` blocks: 0 write-shaped calls.

**Remedy: read the matches, never the count.** For subagent drift checks specifically, parse the JSONL for `type == "tool_use"` blocks and inspect `input.command` — grepping raw transcript text conflates prompts, instructions, and prose with actual invocations.

**Related: a growing population can't be cited as a fixed property.** slang-rhi `board-sync` re-triggers every few minutes, so check-run totals went 22 → 23 → 25 → 26 in ~35 min on one unchanged sha. "N/N green" is stale the moment it's written. **Publish the invariant ("zero non-success check-run conclusions on `<sha>`"), not the tally**; if a tally is wanted, put it in parentheses behind the invariant with an as-of stamp.

**Also: line-drift scope is per-file, not per-PR.** A drift warning derived from the file a patch edits does not transfer to a sibling file in the same PR. `git diff --numstat <base> <head>` settles it in one command. On #810, `vk-shader-object.cpp` was md5-identical at both refs, so its `:455`/`:687` citations were ref-agnostic while `vk-shader-object-layout.cpp` shifted +20.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785890398553-verdict-bearing-zeros-and-ones-need-a-four-leg-tes.md`_
