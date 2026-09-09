---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787297633987-simi2i
written_at: 2026-08-21T12:02:00.844Z
---

# [approver/human-disagreement] #12679 conservative/false ABSTAIN — human approved a documented generated-file hand-edit without requiring regenerate-from-source

## Outcome
shader-slang/slang PR #12679 (drop a stale `// CHECK-DAG: [public]` from a GENERATED test bundle).
My decision at both heads was **ABSTAIN_POLICY / OPEN_GAP** — correctness clean, but I handed the
generated-file maintenance question (accept the documented pragmatic hand-edit vs. require the
documented regenerate-from-source remedy) to a human. **Human outcome: MERGED as-is at my exact
decided head `f5e680e281b5`** (merge commit 6a009a7f97dd, interval identical — 0 commits between my
decided head and the merged head), with an **explicit human APPROVE from maintainer jkiviluoto-nv at
that same commit**. reviewDecision=APPROVED. ⇒ APPROVED-equivalent.

## Calibration
DISAGREEMENT, CONSERVATIVE/FALSE ABSTAIN (scored against the falsifiable reading "material enough not
to merge as-is"). A maintainer looked at the exact hand-edit I flagged, judged the documented
pragmatic exception acceptable, and shipped it unchanged — no prompt/manifest regeneration was ever
performed. So the deviation was mergeable-as-documented; the material bar for "hand this to a human
before merge" was not actually met. NOT a false-safe: I never approved a defect (correctness was a
clean YES throughout, and both a false-reversal to WOULD_APPROVE was caught by my own critique gate).

## The transferable lesson (sharpens Step-0 recall for generated-artifact PRs)
When a trusted MEMBER author (a) makes a correctness-clean edit to a generated artifact, (b) EXPLICITLY
documents the hand-edit as a deliberate acknowledged exception with rationale, and (c) the bot review
is clean — that constellation is, in practice, MERGEABLE in this repo without forcing the
regenerate-from-source remedy. The `regenerate.md` "no hand-edits" rule is enforced by NOTHING
mechanical (the lint hashes doc-digests, not the .slang), and maintainers here treat a documented
pragmatic exception as acceptable rather than blocking. So for this shape, "the documented remedy
wasn't performed" is a real-but-ADVISORY observation, not an OPEN_GAP that clears the conservative
bar. Reserve OPEN_GAP/abstain on a generated-file hand-edit for cases with an actual blast radius:
the edit is WRONG, or a regeneration would plausibly OVERWRITE a correctness-load-bearing change (i.e.
the prompt/source-doc DO direct the property being edited — check them; here they did not).

## What would have changed my call
Had I weighted (author=trusted MEMBER) + (deviation explicitly documented) + (clean bot review) +
(prompt & source-doc both silent on the edited property, so no overwrite risk) as clearing the
conservative bar to ADVISORY rather than OPEN_GAP, I'd have reached WOULD_APPROVE — which matches the
human outcome. The durability worry was legitimately unprovable, but "unprovable AND no plausible
overwrite mechanism (inputs silent)" is a low-blast-radius advisory, not a merge-blocking gap.

## Also confirmed
The two-questions rule (correctness vs. hand-edit-acceptability) still holds — but the second question
resolves ADVISORY, not abstain, for a documented exception by a trusted author absent a concrete
overwrite/incorrectness mechanism. This tightens the earlier [approver/critique-mustfix] learning.
