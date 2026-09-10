---
name: feedback_a_sentence_can_rot_without_becoming_false
description: "Every clause verifies, the implicature is now wrong — a decay mechanism that fact-checking structurally cannot catch, plus the inverse trap where the string is intact and the claim withdrawn"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**2026-08-05, slangpy#1054 / #1091.** PR #1054's body described a known native/fallback bounds divergence as *"pre-existing, out of scope."* Every clause was **true**: it predates the PR, the PR touches neither bound (verified — `torch_bridge.h` absent from the diff, `required_size` unchanged), and it is tracked separately.

And the sentence had become misleading, because #1091 had since been re-triaged **P2 and reachable from plain Python at rank ≥65**. "Pre-existing, out of scope" presents a live P2 as inert background, so a reviewer takes away *"harmless asymmetry, tracked elsewhere."* The fix (fixer's) adds **"not as a claim that it is harmless"** — no fact changes.

⭐⭐⭐**A sentence can become misleading without becoming false. Verification operates on clauses; the damage lives in what a reader infers from the arrangement.** Grepping for false statements structurally cannot find this class.

⭐⭐⭐**And it is a DECAY mechanism, not an authoring mistake.** The sentence was accurate when written; the surrounding facts moved under it. So the check is not *"was this true when written"* but **"does this still read correctly given what we now know"** — which nobody runs, because **the text hasn't changed**, and change is what normally triggers review. Any long-lived artifact (PR body, issue comment, README, memory row) accumulates these silently.

## The inverse trap, same chain: presence is not currency

The fixer verified a public issue still said what it believed by grepping the body for the elements it had written. It found them — **struck through**, under `[CORRECTED]` / `[REFUTED]` markers and a superseding comment. The check succeeded; the claim it certified had been withdrawn *in place*.

⭐⭐⭐**Searching for your own prior claim is structurally biased toward confirming it, because a correction QUOTES what it refutes** — so string counts are identical whether the artifact is untouched or fully retracted.

⇒ **Verification order for any public artifact you have a stake in:** newest comment first → grep `REFUTED|CORRECTED|Superseded|~~` → *only then* your own strings.

| | string state | claim state | what naive checking reports |
|---|---|---|---|
| rot (this file, above) | unchanged | drifted | ✅ verified — every clause true |
| presence-isn't-currency | present, struck | withdrawn | ✅ verified — the strings are there |

Both are members of the false-coverage family ([[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]): the check ran, the answer was right about the question asked, and the question was narrower than the risk.

## Companion: a tracked to-do feels verified BECAUSE it is tracked

Same turn, two parties independently: both slangpy-triager and I carried "file the bounds-divergence issue" as an outstanding gate — it had been **OPEN as #1091 for ~10 hours**. It sat in a durable task on each side and was re-raised across handoffs; neither of us ran a search. ⇒ **Before re-raising an item as outstanding, check whether it exists.** Each restatement adds false currency; the self-sealing shape is the same as "not agent-actionable," which cost three weeks on this chain.

⚠️**But the remedy over-constrains easily, and mine failed on first use:** `gh issue list --search "bounds divergence get_signature in:title" --state all` → **`[]`**, for an issue that exists, because `in:title` restricted the match to words absent from the title. Bare needles (`bounds`, `get_signature`, `native and fallback`) all find it; author-scoped `--search "author:app/nv-slang-bot sort:created-desc"` lists it first. ⇒ **An empty result from a too-narrow qualifier is indistinguishable from "not filed"** — the exact failure the search was meant to prevent. Use plain words or the author listing, never `in:title` unless the words are literally in the title.

Related: [[feedback_a_true_claim_that_widens_past_its_evidence]] · [[feedback_a_plausible_story_disarms_the_implausibility_alarm]] · [[project_slangpy_1052_autograd_cache_grad_bit]].
