---
title: "[approver/false-safe] Re-derived all 4 fallback-pinned decisions: 1 genuine FALSE-NEGATIVE (#918 = WOULD_APPROVE recorded as abstain), and 3 of 4 failed on clauses unrelated to protected_paths — a fallback pin reverts the ENTIRE policy, not one widening"
type: learning
topic: review-approval
source: learnings/1785944951948-approver-false-safe-re-derived-all-4-fallback-pinn.md
---

# [approver/false-safe] Re-derived all 4 fallback-pinned decisions: 1 genuine FALSE-NEGATIVE (#918 = WOULD_APPROVE recorded as abstain), and 3 of 4 failed on clauses unrelated to protected_paths — a fallback pin reverts the ENTIRE policy, not one widening

# [approver/false-safe] The fallback pin reverts every relaxation at once; which clause fires is incidental

## Symptom

Four approver runs were found to have loaded a per-PR policy snapshot that was a
byte-identical copy of the **skill-bundled default** (`v0-shadow`) instead of the
policy in force. Re-derived each individually, era-relative:

| run | recorded | failing clause | Step-2 verdict | correct outcome |
|---|---|---|---|---|
| `925-4743d90ff367` | ABSTAIN_POLICY | `no_protected_paths` (`.github/**`) | `REQUEST_CHANGES`, 2 gaps | ABSTAIN_POLICY:OPEN_GAP / BLOCK — same outcome, sound reason |
| `1078-b76c8065612d` | ABSTAIN_POLICY | `author_trust` (CONTRIBUTOR) | `null`, `reviewers_complete:false` | ABSTAIN_INFRA:NO_REVIEW_SIGNAL |
| `1078-06e7ddad232a` | ABSTAIN_POLICY | `author_trust` (CONTRIBUTOR) | `APPROVE_WITH_NITS`, 2 gaps | pending Step-3 severity |
| `918-57259b457b4c` | ABSTAIN_POLICY | `head_provenance` (fork) | **`APPROVE`, 0 bugs, 0 gaps** | **WOULD_APPROVE** ← false-negative |

**#918 is a genuine false-negative.** It failed `head_provenance` on
`allow_fork_head: false` (bundled default), but ran **2026-07-22**, when
`v0-shadow-relaxed` was in force — and that policy already had
`allow_fork_head: true`. So the fallback reverted a relaxation that had been live
**twelve days**, on a PR whose review was clean (`APPROVE`, zero bugs, zero gaps).
A decision that should have been WOULD_APPROVE was recorded as an abstain.

## Root cause — the framing was wrong, not just the count

I had been describing this defect as *"the `.github/**` widening isn't taking
effect,"* because #925 was the case in hand. **Three of the four failed on clauses
that have nothing to do with `protected_paths`.** Diffing bundled vs signed:

```
trusted_associations  3 entries (OWNER,MEMBER,COLLABORATOR) → 7 (adds CONTRIBUTOR, FIRST_TIMER, NONE…)
allow_fork_head       false → true
protected_paths       8 patterns → ["**/slang-tag-version.h"]
max_total_lines       400 → 8000        max_files  30 → 150
require_ci_green      true → false
```

The bundled default is **uniformly stricter on every axis**, so a fallback pin
reverts *all* relaxations simultaneously. Which clause fires is just whichever the
PR happened to touch — fork head, author association, path, size, or CI. Reasoning
from the one instance in front of me produced a defect description that was true of
that instance and wrong about the class.

Second, and it's why #918 matters more than #925: the failure direction is not
uniform. A spurious abstain on a PR with real gaps (#925) is harmless in outcome —
the abstain was right for the wrong reason. A spurious abstain on a **clean** review
(#918) destroys a decision the procedure would have gotten right, and it lands in
the calibration set as a disagreement with the human verdict. **Same bug; only some
instances are recoverable by luck.**

## How to catch it

Re-derive per run, never per class, and always era-relative:

```bash
# Step-2 verdict from the run's own doc
python3 -c "
import re,json;s=open('work/<ws>/review/review-doc.md').read()
[print(d['verdict'],d['bugs'],d['gaps'],d['reviewers_complete']) for m in
 re.finditer(r'\`\`\`json\s*(\{.*?\})\s*\`\`\`',s,re.S)
 for d in [json.loads(m.group(1))] if d.get('_approver_result')]"
# the era policy actually in force — read it from an era-correct sibling workspace
python3 -c "import json;print(json.load(open('work/1082-c4ae89058c6e/policy/APPROVAL_POLICY.json')))"
```

Falsifiers: (1) the failing clause's parameter is identical in both policies ⇒ the
staleness is irrelevant to that decision; (2) the failing clause differs **and** the
Step-2 verdict is `APPROVE`/`APPROVE_WITH_NITS` with 0 gaps ⇒ **false-negative**,
the highest-severity class; (3) `reviewers_complete: false` ⇒ correct outcome is
ABSTAIN_INFRA regardless of policy.

## Fix

- Staging must copy the **live mount** and never fall back to bundled when a mount
  exists; record the loaded policy's absolute path in `clauses.json`.
- Re-record #918 as WOULD_APPROVE for calibration, and flag it as the set's only
  verdict change. #925 and `1078-b76c` keep their outcomes with corrected reason
  codes; `1078-06e7` needs Step 3.
- **Generalize the description, not the instance:** when a shared upstream artifact
  is wrong, enumerate *every* parameter it controls before naming the defect. "The
  widening isn't taking effect" invites a one-clause fix; "the fallback reverts the
  whole policy" is what's true and drives the right fix.

**Method note:** the only reason this got measured per-run is that I'd just been
caught twice reporting an outcome I hadn't read (an eligibility claim as a verdict,
and an inflated blast radius). The discipline that worked was mechanical — open each
artifact, print the value, compare to the era policy — not more careful reasoning.

Siblings: the 21→4 correction; "clause-eligible is not approvable"; a spurious
abstain fails in the socially invisible direction.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785944951948-approver-false-safe-re-derived-all-4-fallback-pinn.md`_
