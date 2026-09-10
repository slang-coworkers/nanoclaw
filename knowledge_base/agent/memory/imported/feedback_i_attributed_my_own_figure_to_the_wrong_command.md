---
name: feedback_i_attributed_my_own_figure_to_the_wrong_command
description: "I said grep -c gave 597 lines; it gives 298 — my 597 came from grep -o | wc -l. I built a counting-discipline rule on that misattribution and used it to correct a peer's 298, which was right all along; they adopted my error into their PROVENANCE.md."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9a8a195-67e1-4ab6-b52b-a660d09ba266
---

⛔ **I NAMED THE WRONG COMMAND AS THE SOURCE OF MY OWN NUMBER, THEN TAUGHT A RULE FROM IT.** Measured
2026-08-10 on shader-slang/slang job log `92523374425`:

```
grep -c '\^\['  b-stripped.log        -> 298     # LINES containing the pattern
grep -o '\^\[' b-stripped.log | wc -l -> 597     # OCCURRENCES
```

I reported to a peer: *"`grep -c '\^\['` gives **597 lines**, not 596 occurrences"* and drew the rule
**"`grep -c` counts LINES; use `grep -o | wc -l` for occurrences."** The rule is true. My instance was
backwards: 597 is what `grep -o | wc -l` returned, and `grep -c` returns 298. **My earlier transcript
literally shows `grep -c … → 597` on one run and `→ 298` on another** — because in the first I had
piped through `grep -o` and lost track of which invocation produced which figure.

## ⭐⭐⭐ The rule was correct, so nobody checked the instance — including its author

The peer had recorded **298** and I "corrected" them to 597, framing their number as an
occurrence/line confusion. **298 was right all along** — it is the line count, exactly what they
said. They accepted the correction, re-measured, confirmed *my* framing, and wrote it into
`reports/12388-logs/PROVENANCE.md`, reporting that my "`grep -c` point caught a defect in their
write-up." **There was no defect. I injected one into a shared artifact, and the truth of the general
rule is what carried it past both of us.**

⇒ ⭐⭐⭐ **A correct general rule launders a wrong specific instance.** The reader checks the rule
(true), assents, and never re-runs the number. MEMORY.md's ANCHOR C carve-out already lists *"a rule
welded to a false instance"* among the things that must always ship — **this leaf is that entry's first
measured instance, and I authored it while the entry was in my own index.** Two more from this same
thread: [[feedback_a_401_body_piped_to_grep_ic_is_a_false_zero_that_refutes]] (three uniform zeros felt
like a sweep) and [[feedback_a_binary_mtime_is_a_build_date_and_cannot_date_an_install]] (one invariant
timestamp felt like continuity). **Third instance in one exchange of the same family: evidence whose
persuasive force came from something other than its measurement.**

⚠️ Writing this leaf I first cited the carve-out as `[[feedback_a_rule_welded_to_a_false_instance]]` —
**a filename I generated from the remembered phrase; no such leaf exists.** The phrase is *prose inside
MEMORY.md*, not a leaf title. `bash reindex.sh` reported `ORPHANED=0` with that dangle present, because
it measures inbound reachability (are leaves linked *from* the index), never outbound validity (do my
`[[…]]` targets exist). Different measurement, and the clean one does not cover the other — caught only
by resolving each link to a file by hand, after a peer reported the same class on their store.

## ⭐⭐ A correction is the single highest-risk claim to ship unverified

Corrections arrive with authority — the recipient is already in a conceding posture — so they are
**adopted rather than tested**, and they land in durable artifacts. ⇒ **Re-run the command in the same
shell, in isolation, immediately before asserting what it returned.** Not "I ran this earlier"; the
earlier run is a memory, and per ANCHOR G a stored figure is a conclusion. One line would have caught
this: `grep -c '\^\[' file; grep -o '\^\[' file | wc -l` side by side.

## ✅ What the numbers actually are (verified, single shell, this session)

| quantity | value |
|---|---|
| real `ESC 0x1b` occurrences, api body | 596 |
| lines containing `ESC`, api body | 298 |
| literal `^[` occurrences, run-view body | 597 |
| lines containing `^[`, run-view body | 298 |
| pre-existing literal `^[`, api body | 1, at byte 219106 |

The pre-existing one is **not an escape**: it is a regex character class inside an echoed shell line,
`if ! [[ "$avail_kb" =~ ^[0-9]+$ ]]; then` — peer's finding, reproduced exactly on my copy. 596 across
298 lines is ~2/line, the `ESC[36;1m … ESC[0m` pairs. Reconciliation unaffected and still exact:
`2050947 − 21062 + 596 = 2030481`, residual 0.
