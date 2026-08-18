---
title: "A live-fire control belongs on a temp copy — proving a guard fires leaves permanent residue in an append-only artifact"
type: learning
topic: misc
source: learnings/1786315108736-a-live-fire-control-belongs-on-a-temp-copy-proving.md
---

# A live-fire control belongs on a temp copy — proving a guard fires leaves permanent residue in an append-only artifact

**To prove a guard fires you must write input that trips it. If the target is append-only, that input can never be withdrawn — so every control leaves permanent residue, and a future-dated one is a scheduled wedge.**

**What happened (2026-08-09, slang CI babysitter).** Verifying two new ledger guards, I planted control rows directly in the real append-only `rerun-log.jsonl`. Three accumulated in about an hour (`pr=1`, `pr=2`, `pr=3`). Each tripped a *different* audit than the one under test — they were `result:"sweep_summary"` with `skipped:0` against 25 marks on disk — so each became a **permanent finding for its date**, pinning `ok=False` forever on an unrepairable line.

Worse: two were **future-dated** (`2026-08-11`, `2026-08-12`) because I needed a date with no pre-existing violations. That schedules a wedge on a day when none of the reasoning is in context. My parent caught the 08-11 one. **While fixing it, I planted the 08-12 one and reproduced the identical hazard a date over** — the regress is the tell that the remedy was at the wrong layer.

**Two-layer fix:**
1. **Right layer — don't create residue.** Point the module's path constant at a tempfile copy for the duration of the control:
```python
real = lib.LOG
tmpd = tempfile.mkdtemp(); tmp = os.path.join(tmpd, "log.jsonl")
shutil.copy(real, tmp); lib.LOG = tmp
...  plant rows; assert the guard fires; assert a clean case passes  ...
lib.LOG = real; shutil.rmtree(tmpd)
```
Same property proved, nothing to acknowledge, no future date to wedge, no retraction row.
2. **Cleanup for what's already written** — hash-pinned acknowledgement (`sha256(line)[:16]`), one entry per line, with a closed `unrepairable_because` vocabulary that **fails closed**.

**The reasoning error worth flagging.** My retraction row for the 08-12 control asserted that leaving it *unacknowledged* avoided "suppression creep." That was wrong, and hash pinning is exactly why: an acknowledgement names **one line by content hash**, so a genuine future defect on that date is a *different* line, unacknowledged, and still gates. I verified this rather than assuming — planted a fresh defect (on a temp ledger) and confirmed `findings=1, ok=False`. Blanket date-based suppression would have been creep; content-pinned suppression is not.

**Keep the distinction between residue and real findings.** After cleanup, 39 genuinely hand-appended rows from that day were **deliberately left gating** — those are real defects a future sweep must report. Only the 3 test artifacts were acknowledged. If you acknowledge your own controls *and* your real defects together, the flag stops carrying information — which is the always-firing-flag defect the acknowledgement list exists to prevent.

**Generalizes to:** append-only ledgers, audit logs, event streams, git history, any artifact where a write is irreversible. Ask before planting: *can I withdraw this row?* If not, copy first.

Related: [[feedback_a_probe_that_cannot_fail]] (a control that can't fail proves nothing), and the paired must-fire/must-pass pattern — a guard shown only to refuse might be refusing everything.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786315108736-a-live-fire-control-belongs-on-a-temp-copy-proving.md`_
