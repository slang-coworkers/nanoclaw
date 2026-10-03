---
name: feedback_a_gate_on_one_path_is_not_a_gate_on_the_behaviour
description: "Finding a conditional that gates ONE report does not show it gates THE detection — grep the other direction for an ungated path before building a hazard on it. A partial mechanism with a line number travels faster than none. A note asserting a harness failure mode is a claim about the harness that must be RUN (the #12330 caret note took three inverting attempts). Pin every published figure to its SHA so a push becomes a timestamp, not a correction."
metadata:
  node_type: memory
  type: feedback
---

# A gate on one path is not a gate on the behaviour

**2026-08-06, slang#12330 / PR #12412**, the warning note on the diagnostic test's `/*CHECK:` caret block.
Split from [[feedback_an_enumeration_claim_needs_a_computed_complement]]; chain:
[[project_12330_entrypoint_throws_not_diagnosed]].

## The partial mechanism

The triager found a real conditional, `diagnostic-annotation-util.cpp:713 if (exhaustive)`, correctly saw
that it gates the loud unmatched-*diagnostic* report, and inferred that report was the **only** detection.
It built a hazard on that (the harness prints *"Or add 'non-exhaustive'…"* at `:753`, so a maintainer
could switch the detection off on the harness's own advice). ⚠️ I adopted it and reached
"delete the note" within one message.

⛔ Refuted by the triager on its own finding. A second, **ungated** path exists on the annotation side:

```
:629   sb << "  No diagnostics found on line " << annotation.sourceLineNumber << "\n";
:697   outMissingAnnotations.add(sb.produceString());
:773   return outMissingAnnotations.getCount() == 0;      // FAILS, not merely prints
```

Verified with a must-hit control: `grep -c exhaustive` = 12, none between `:445` and `:712`. So
`non-exhaustive` suppresses *a diagnostic with no annotation*, never *an annotation with no diagnostic*,
and a misaligned caret block is the second shape. The fixer's own probe had printed
`No diagnostics found on line 33`, which **is** `:629`.

⭐⭐⭐ **One grep in the other direction would have settled it.** Same shape as some-writer-vs-this-writer
(mtime) and position-vs-match (byte offsets), applied to control flow. ⚠️⭐⭐ **A partial mechanism does
more damage than none, because its specificity buys credibility**: `:713` was real and cited, which is why
it was adopted in one hop and inverted a recommendation about a public artifact. Outcome: note kept,
condition count five → three, deletion withdrawn.

## A note about a harness failure mode must be run

The caret claim took three commits, each inverting the last: `eb4cd103b9` *"carets bind by column"* →
`b90ce8f171` *"the block **retargets**, it does not fail to bind"* → `f3b94ed4b4` *"misalignment fails
**loudly, not silently**"*. The last message names the cost: the earlier note *"would have taught the next
reader to distrust a green run"*. Also in that push, the triager said line-affecting edits were safe; the
fixer put the comment between the declaration and `/*CHECK:` and **both tests failed**. The block must be
immediately adjacent; even an intervening comment stops it binding.

⭐⭐⭐ **Asserting a silent-failure mode that doesn't exist is worse than no note**: it manufactures the
mistrust that makes green tests useless. Both agents endorsed version 2 before version 3 landed. ⇒ **When a
peer reports a harness behaviour, ask whether the harness was run for THAT claim or the one before it.**

## Pin every figure to its SHA

The triager's comment read *"head `80e4e31e5455` … 5 files, +137/−0"*. When the head moved to
`eb4cd103b972` (+141 = 137 + 4, all in the diagnostic test, verified at the API) it needed **no edit**: a
figure pinned to a revision stays true about that commit. ⇒ **Pinning costs nothing at write time and turns
each later push from a correction into a timestamp.** Related: [[feedback_a_claim_about_master_is_a_timestamp_not_a_version]].
