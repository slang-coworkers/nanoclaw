---
name: feedback_ask_what_the_removed_mechanism_uniquely_covered
description: "Two instances in two days: a correct split of conflated facts, or removal of a provably-wrong mechanism, REGRESSES for the one input class the blunt instrument uniquely covered. Ask what it uniquely covered before removing it — being right that it was the wrong shape does not tell you its coverage."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22dab901-33f9-4caf-a3c9-95a4bdd8da20
---

# Being right that a mechanism is the wrong shape does not tell you what it was covering

**Two instances, two days, both found by differential execution and neither visible in the diff.**

**#1162 (08-10)** — `build_measured()` correctly stopped conflating "never measured" with
"measured as 0". Right in isolation. But the documented producer emitted `%.1f` of GB, which
quantizes at 102.4 MiB, so a real 40 MiB build printed `0.0` — byte-identical to absent. For the
one input class where `reclaim_gb` genuinely understates, head reported it fully accounted, and a
working operator warning was silently retired. [[project_nanoclaw_1114_gc_build_size_accounting]],
[[project_nanoclaw_1162_gc_full_candidate_list]].

**#1164 (08-10)** — the MCP allow-list genuinely was the wrong instrument for NanoClaw's own
built-in tools (it added no authority; a coworker type that granted the tool still granted it). The
PR removed them from scope and argued *"loses no protection that existed"*, verifiably true for
manifest-inherited groups. Differential on `allowed_mcp_tools='[]'`:

| permitted under `explicit []` | base | head |
|---|---|---|
| `report_pr_created` | **false** | **true** |
| `append_learning` | **false** | **true** |

The explicit-`[]` group is the containment configuration an operator reaches for on a suspect group
— and those two are exactly the pair the PR documents as *needing argument-level authorization that
does not exist yet*. The blunt instrument's only load-bearing case was the gap it was covering for.
[[project_nanoclaw_1164_mcp_allowlist_external_scope]].

## The rule

⭐⭐⭐ **Before removing a mechanism you have proved is the wrong shape, ask what it was UNIQUELY
covering.** The proof that it is the wrong shape is an argument about its *design*; coverage is a
question about its *inputs*. They are independent, and the first one feels conclusive enough to stop
the inquiry.

⭐⭐ **The remedy is almost never "keep it."** In both cases keeping it would have been security
theatre (#1164) or premature (#1162). The remedy is: name the uncovered class in the rollout notes,
or land the real fix in the same change. The finding is about honesty of the caveats, not about
reversing the decision — and saying so in the review is what keeps it actionable instead of
adversarial.

## Detector

Both instances were invisible reading the diff and both fell out of **the same probe file run
against both trees**. The pattern to run:

```
git worktree add --detach /tmp/base <base-sha>
ln -s <headclone>/node_modules /tmp/base/node_modules     # ~0 install cost
cp probe.test.ts   → both trees, run, diff the printed table
```

⭐⭐ **Enumerate the INPUT CLASSES the old mechanism accepted, then run each one on both trees.**
For #1164 the classes were `explicit []` / `inherited ∅` / `unresolved` / `unrestricted` / partial —
and only ONE of the five regressed. A single representative input would have missed it; so would
reading the tests, which covered the other four.

⚠️ **`git stash` cannot produce this** — it reverts the tests along with the source, so a
"pre-fix" run measures the OLD suite against the OLD code and passes for the wrong reason. The
author of #1162 hit exactly this and recorded it in the commit message. A second worktree is the
only clean way.

## See also

[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] — the sibling failure in
the same review: a canary designed to detect the new gap, whose completeness check closed over its
own literal so it could never fire.
