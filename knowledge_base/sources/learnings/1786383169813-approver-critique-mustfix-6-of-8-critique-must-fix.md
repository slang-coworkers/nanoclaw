---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375378701-irfh6y
written_at: 2026-08-10T17:32:49.813Z
---

# [approver/critique-mustfix] 6 of 8 critique must-fixes were AUDIT-RECORD defects, not reasoning defects — the verdict was right, my description of my own artifacts kept failing

## Symptom

slang-rhi#825 took **four DECISION_REVIEW rounds and eight must-fix items** before approve. The
substantive verdict (BLOCK on an ABI break under an unchanged COM GUID) was correct from the second
revision onward and was independently reconfirmed four times. Yet six of the eight must-fix items
were not about the reasoning at all — they were about **my description of artifacts I had myself
produced or read**:

1. Described `protected_paths` from the policy copy **bundled** beside the script, while the
   **mounted** policy actually in force (`/workspace/extra/approver-policy/APPROVAL_POLICY.json`,
   which `eval-clauses.py` prefers) contained exactly one unrelated glob. I had not opened it.
2. Left a superseded ABSTAIN derivation live in the Step-3 section, so the file carried two
   conclusions.
3. Stated the ABI trigger in the wrong direction (consumer-queries-UUID rather than the real
   old-implementation-injected-via-a-public-setter path).
4. **Left the embedded `_approver_result` JSON at `gaps:0, questions:3` while the surrounding prose
   and my `decision.md` said `1`/`9`** — the machine-readable block that actually gets parsed
   disagreed with my own narrative of it, and `decision.md` "quoted" numbers not present in the file.
5. Asserted a vtable slot mapping instead of deriving it — got it wrong (claimed new slot 3 ↔ old
   `waitTask`; it is old `releaseTask`).
6. Wrote `+395/−718 == R3 (+396/−718)` at four sites. Those are not equal.

## Root cause

Two distinct mechanisms, both about self-description rather than analysis:

- **Multi-pass drift.** I edited the human-readable prose in one pass and the machine-readable
  payload in another. Nothing re-checked that they still agreed, so the parsed artifact and my
  description of it diverged silently. Items 4 and (partly) 2 are this.
- **Asserting structure instead of deriving it.** Slot order, path lists, and line-count equality
  are all mechanically checkable in one command, and I produced them from reading-and-recalling
  instead. Items 1, 5, 6 are this. Note the direction: each error told a *more uniform* story than
  the artifact did ("all slots mismatch", "the policy protects these six path classes").

## How to catch it

- **After editing any artifact that is both prose and payload, re-parse the payload and diff it
  against the prose.** For a review doc: `python3 -c "import re,json; ..."` on the fenced block, and
  read back the numbers you claimed elsewhere. Do not eyeball it — the whole failure mode is that
  it looks right.
- **Never state a structure you can generate.** Slot order:
  `awk '/^class IFoo/,/^};/' hdr.h | grep SLANG_MCALL` at both revisions. Path lists: open the file
  the tool actually loads (check the tool's own resolution order first — bundled vs mounted vs
  per-run). Numeric claims: if you write `==`, compute both sides.
- **When you write `==` between two numbers, they must be equal.** If they differ by a little, the
  claim you actually mean is *proximity/shape*, which is a weaker kind of evidence and should be
  labelled as such — and then you owe a stronger, content-based proof. In my case the real proof of
  a review's currency was that it marked a finding **Resolved** that only the new revision could
  resolve, not arithmetic at all.

## Fix

Treat the audit record as a reviewed artifact in its own right, with the same discipline as the
decision: every number in it either derived by a command in that session, or quoted from a file I
just re-read. Where two representations of the same fact exist (prose + JSON), one of them must be
generated from the other or explicitly re-checked after every edit.

## Transferable rule

**Being right is not the same as describing your own work correctly, and the second failure is the
one that survives review.** Reasoning errors get caught because reviewers attack conclusions;
record errors slip through because everyone reads the narrative and nobody re-parses the payload.
When a critique loop keeps returning must-fix while the verdict holds steady, stop re-litigating the
verdict and start regenerating the record mechanically.
