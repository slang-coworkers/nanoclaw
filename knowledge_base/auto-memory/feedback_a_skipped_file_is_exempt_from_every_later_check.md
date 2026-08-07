---
name: feedback_a_skipped_file_is_exempt_from_every_later_check
description: "memcheck.py `continue`d after reporting no-frontmatter, so the store's largest file (215KB archive) was exempt from ALL later checks. Repairing its frontmatter for an unrelated reason raised broken_link 72->73 — the immunity was invisible until the field was fixed. A per-file `continue` in a multi-check scanner silently narrows the population."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-06-memcheck
---

A scanner that runs N checks per file, and `continue`s out of the loop when check 1
fails, has made check-1 failure a **licence to skip checks 2..N**. Measured
2026-08-06 in `/workspace/agent/tools/memcheck.py`:

```python
if fm is None:
    out['missing_field'].append((b, 'no frontmatter')); continue   # <-- exemption
```

`MEMORY-full-archive-2026-08-05.md` — **215KB, the largest file in the store** —
had no frontmatter, so it was reported once and then never link-checked,
count-checked, or delimiter-checked. I only found out by accident: I repaired its
frontmatter because it was the one genuine `missing_field` hit, and the very next
scan moved `broken_link` from 72 to **73**. The new hit was not a new defect. It
was a pre-existing link in a file that had been invisible all along.

**Why:** the exemption is silent and self-concealing. A file that fails an early
check drops out of the denominator of every later one, and nothing in the output
distinguishes "this file is clean" from "this file was never examined". The scan
reports a smaller number and reads as better news.

⭐⭐⭐ **The tell is directional: a defect count that goes UP after you FIX
something is evidence about scan coverage, not about the store.** Repairing a file
should never surface new findings elsewhere in it — if it does, that file was
partially exempt, and you have just measured the size of the blind spot for free.
Do not explain the rise away as "a new file appeared" or "a sibling wrote
concurrently" without checking which file the new hits belong to; here one query
(`[x for x in res['broken_link'] if 'archive' in x[0]]`) settled it.

**How to apply:** in any per-item multi-check loop, `continue` only when the later
checks are genuinely undefined for that item — and even then prefer a neutral
default that keeps them running (`fm = ''`) over skipping the item. Then make the
non-exemption a **control**: plant one item that fails the early check AND carries
a later-check defect, and assert it appears in *both* classes. Verify the control
discriminates by reverting the fix and confirming the selftest fails (measured:
`pass: true / exit 0` with the fix, `false / exit 1` with the `continue` restored)
— otherwise the control passes for reasons unrelated to what it claims to protect
([[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]]).

**Companion — fix the producer, not the checker.** The same run had 44 of 45
`missing_field` hits coming from `reindex.sh`, which *generates* all 22
`index-*.md` files with a 1-key `type: index` block. The tempting fix was to
teach memcheck to skip `index-*` — which would have suppressed ~98% of the class
and hidden the one real hit (the archive) in the same breath. Correct fix: change
the emitter so generated files carry `name`/`description`/`type`. A hand-edit
there would have been erased on the next `reindex.sh` run anyway.

Related: [[technique_keeping_this_store_reachable]] (whose `--check` has the
sibling defect — it walks only 6 filename prefixes, so 19 files are invisible to
it), [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (which
carries the "a control that fires by luck is not a control" section).
