---
name: feedback_an_enumeration_claim_needs_a_computed_complement
description: "MAX / 'tops out at' / 'what is free' are ENUMERATION claims: a positive control passes on a window-limited pattern, and `sort -n | tail` gives the true max while staying silent about interior gaps. Derive the used-set unbounded, then compute the complement IN CODE. Also: range-check a count against its window width."
metadata:
  node_type: memory
  type: feedback
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

# An enumeration claim needs a computed complement, not a control and not a tail

**2026-08-06, slang #12393.** I got the *same* enumeration wrong **twice in one hour**, publicly, and a
peer caught both.

1. **A ceiling read from a window.** I claimed "master's 380xx tops out at 38037" from
   `grep "3803[0-9],"`. The block runs to 38052. I reported a ten-number window as a property of the
   file. ([[feedback_a_bounded_grep_pattern_cannot_report_a_ceiling]])
2. **An incomplete free-list in the comment correcting the first error.** I published
   free = `{38038, 38039, 38044, 38049}`, read off a printed sorted list. The actual free set in
   38028–38052 is `{38030, 38038, 38039, 38044, 38049}`. I missed an interior gap while writing the
   correction whose whole point was interior gaps.

## Why neither instrument could catch it

⭐⭐⭐ **A positive control shows the instrument READS; it cannot show the instrument's SCOPE matches the
claim's scope.** The window-limited grep returned seven real lines, so the control passed while the
pattern was blind above 38039. ([[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]])

⭐⭐⭐ **`sort -n | tail` answers "what is the max", a different question from "what is free".** A tail is
right about the maximum and silent about every interior gap. The triager's own first pass did the same and
would have missed 38030 too: two people, two instruments, one blind spot, because both answer an adjacent
question.

## The mechanical fix

```python
used = sorted({int(m) for m in re.findall(r'\b(38\d{3})\b', src)})   # UNBOUNDED pattern
free = sorted(set(range(lo, hi+1)) - set(used))                      # complement IN CODE
```

Never eyeball a tail; never read a free-list off a printed sequence. The complement is three lines and
does not depend on attention.

## Range-check a count against its container

The peer reported "used in 38028..38052: **36** entries". That window is **25 wide**, so 36 is impossible,
and one division shows it. (It was the whole-380xx count mislabeled as the window count; the free set it
derived was right, so the slip was in reporting, not computation.) ⭐⭐ **Absurdity beats agreement as a
detector.** I accepted the *conclusion* (38030 free, verified independently) while rejecting the *figure*;
the two are separable and both need checking.

## Why I amended a comment whose conclusion was unaffected

The peer had already routed the correct set into its own verdict. I amended anyway (in-place PATCH on
comment 5207531076, marked *(edited)*) because **the wrong item pointed at an action**: recommending 38038
steers the next contributor onto the number #11709 is already taking, in a family that had already walked
30705→30706→30707. ⭐⭐ **"Conclusion unaffected" is not grounds to leave a detail wrong; ask what a reader
would DO with it.** 38030 was also the better slot: the `-- 380xx: differentiation modifiers` marker sits
between 38029 and 38031. Edit-vs-supersede mechanics: [[feedback_github_comment_hygiene]].

## Same family, split out

- A correct, complete enumeration can still be published with the wrong **quantifier** ("unreachable",
  "proof"): [[feedback_an_enumeration_is_not_a_proof_audit_the_quantifier]] (#12330).
- A conditional that gates *one* report is not proof it gates *the detection*:
  [[feedback_a_gate_on_one_path_is_not_a_gate_on_the_behaviour]] (#12330 harness note).

See [[project_12393_bwddiff_ref_param_abort]].
