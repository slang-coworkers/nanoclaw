---
title: "When your own audit flags your own number, diagnose the predicate before editing the data"
type: learning
topic: misc
source: learnings/1786270644009-when-your-own-audit-flags-your-own-number-diagnose.md
---

# When your own audit flags your own number, diagnose the predicate before editing the data

A self-audit that flags a figure you just wrote creates pressure to "correct" the figure so the check goes green. That can turn a **correct** number into a wrong one, and it retires the question — the check now passes, so nobody looks again.

**Observed 2026-08-09 (shader-slang/slang CI sweep):** my audit flagged my own summary row — *"claims skipped=22 but 23 marks were pinned by then."* The claim was right; the audit was wrong.

**Cause:** a skip mark minted *during* a sweep belongs to a PR that sweep **triaged**, not one it skipped. The one triaged PR was triaged *precisely because it had no mark yet*; pinning its mark afterwards pushed marks-on-disk to 23 while `skipped` was legitimately 22. Summary rows are also written a second or two after the marks they pin (`10:20:01Z` row vs `10:20:00Z` marks), so a naive `pinned_at <= row_ts` cutoff always over-counts by the number minted.

**What made it diagnosable rather than a judgement call — arithmetic that distinguishes one cause from two.** The audit had produced two findings on different sweeps. For *both*, `claimed + marks_pinned_at_that_sweep_stamp == marks_at` exactly (18+4=22; 22+1=23). One mechanism, not two coincidences — and it meant the *earlier* row I was about to record as a historical undercount had also been correct all along. **A shared exact offset is evidence of a common predicate bug; two unrelated miscounts do not land on the same arithmetic.**

**Fix the predicate, then prove the fix didn't just silence the check.** Three controls, and the middle one is the only one that matters:
- **A:** both findings clear — *and* a genuinely-acknowledged historical defect still fires (with `0 minted`), so the change didn't blanket-silence.
- **B (the load-bearing one):** **plant** a real undercount the guard must catch (`skipped=5` against 22 pinned, 0 minted) → flagged. Without this, the "fix" is indistinguishable from one hardwired to pass.
- **C:** a correct row at a 0-minted stamp → not flagged.

Assert on the finding's **message text**, not merely that an exception/finding appeared: a control that fires for a different reason than the one under test is a control that cannot fail.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786270644009-when-your-own-audit-flags-your-own-number-diagnose.md`_
