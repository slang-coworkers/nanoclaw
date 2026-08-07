---
name: feedback-annotating-a-defect-is-not-fixing-it
description: "I documented my parser's undercount in a header comment and left the broken rule running — it still printed std::=1 where the truth was 127. A comment does not stop a number being read."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9bb4e9b6-5724-4379-9c3f-6b873fd0a26e
---

On #12380 ([[project_12380_macos_glslang_export_bound]]) I found that my Mach-O export parser
classified `std::` ownership with a mangled-prefix regex that misses `_ZTISt`/`_ZTSSt`/`_ZTVSt`
(typeinfo/vtable carry the `St` substitution *after* the tag). I wrote the lesson up
([[feedback_a_mangled_name_prefix_regex_undercounts_std_exports]]), copied the parser into
`/workspace/agent/tools/`, and **added a header comment saying the bucket counts undercount `std::`
by ~45%.**

Then I left the broken rule in place and called it handled.

**Measured one turn later: `tools/macho-exports.py` reported `std:: = 1` on x86_64 where the truth is
127 — off by 126.** The warning sat twelve lines above the code that produced the wrong number.

⇒ ⭐⭐⭐ **A comment describing a defect does not stop the defect's output being read as a
measurement.** Whoever runs the tool gets a figure; nothing forces them past the header, and the
figure looks exactly as authoritative as a correct one. Annotation documents my *awareness*, not the
artifact's *behaviour* — and only behaviour reaches the reader.

**The fix that was actually available, and took minutes:** replace the predicate
(`^__Z(T[ISV])?(N[KVr]*)?St`), add a residual bucket, and `assert sum(buckets)==TOTAL` so the tool
**cannot print a breakdown that does not close**. Both arches now reproduce their known-good cells
(arm64 1 / x86_64 127; totals 3860 / 4130) and the guilty controls still raise on garbage. The
header now documents *fixed* traps plus known-good cells to regress against — a header's job is to
carry what code can't assert, not to excuse what code gets wrong.

⇒ **Precedence rule: fix in code > assert in code > document in a header.** Only drop to the next
level when the one above is genuinely impossible (e.g. "do not generalize across architectures" is
judgement, not a computation — that belongs in a comment, sitting next to the number it governs).

## ⭐⭐ Two agents, same failure, one layer apart — the shape is what generalizes

- **Me:** wrote the lesson down, then **reused the broken pattern in a fresh script the same session**,
  and separately shipped the annotated-but-unfixed copy.
- **The peer, applying my own "annotate the tool" framing to their tools:** had codex catch a
  classifier defect, fixed the **scratch** copy, and never re-copied — so the *pre-fix* script sat in
  the directory named `tools/`. Running both on identical input: `2 / 128` vs the correct `1 / 127`.
  Their published numbers were right and their working copy was correct; **only diffing the two
  locations surfaced it.**

Common generator: **the fix existed and the shipped artifact predated it.** Knowing about a defect,
having fixed it elsewhere, and having written it down all feel like completion while the defective
copy keeps running.

⇒ ⭐⭐⭐ **A shared `tools/` directory is a PUBLICATION SURFACE.** Copying a script there asserts it
implements the current method. **Re-copy after every fix and prove it by running both copies on the
same input** — a newer mtime is not evidence of a fixed file (compare
[[feedback_a_remedy_that_can_reproduce_its_own_bug]]).

⚠️ **Detector, cheaper than review:** keep known-good cells in the tool's header and re-run them after
any edit or copy. A defect that survives a copy is invisible to reading and obvious to one execution.
An instrument's *claims* about itself are not evidence; its *output on known input* is.

## ⭐⭐⭐ Applied the ladder to myself one notch further — and a FAILED sabotage taught the most

The peer pointed out they were one notch above me (printing invariants instead of asserting them). I
was one notch above *that*: my known-good cells were **a prose list in the header** — the bottom tier
of my own precedence rule. Now enforced as `--selftest`, exit 1 on any failure, with a missing data
file counted as a **FAILURE not a skip**.

Refactor that mattered: the report loop had the trie walk inlined, so a selftest would have exercised
**a copy** of the logic. Factored out `read_exports()` so report and selftest share ONE code path.
⭐⭐ **A selftest against a duplicate of the logic can pass while the shipped path is broken** — the
same predates-the-fix generator, one layer in.

**Sabotage results (an assert that has never failed is a hypothesis):**
- strip RTTI tags from `OWNED_STD` → selftest exit 1, `owned std:: 1 != 127`.
  ⭐⭐⭐ **arm64 PASSES under this sabotage (1 == its correct value); ONLY x86_64 catches it.** So the
  multi-arch cell set is not thoroughness, it is *the discriminator for the defect I actually shipped*.
  A single-arch suite would have been blind to it. (Peer found this first; I reproduced it on my tool.)
- point a cell at a missing file → exit 1, `DATA CELL ABSENT (a skip is NOT a pass)`.
- legitimate inputs → exit 0, 2/2.

⛔ **The instructive one FAILED to fire, and that is the finding.** I broke a *middle* bucket rule
expecting the partition assert to trip. **Exit 0** — the terminal catch-all `else` absorbed the
rejects and the sum still closed. Only conditioning the terminal `else` let symbols escape
(`3845 vs 3860`, exit 1).

⇒ ⭐⭐⭐ **The closing assert guards the partition's COMPLETENESS, never any individual rule's
CORRECTNESS. A misclassification is silent by design.** I had been treating "buckets close" as
evidence the buckets were *right*; it is only evidence that nothing vanished. Rule-level correctness
is covered exclusively by the selftest cells. **A guard whose scope you have not probed will be
over-trusted at exactly the boundary you never tested** — and a sabotage that fails to trip a guard is
worth more than one that trips it, because it maps the guard's real edge. Both facts are now in the
tool's header next to the assert, so the next reader cannot make my inference.

## ⭐⭐⭐ The scope gap was REAL on my tool too — and closing it caught me writing cells from memory

Peer checked my assert-scope finding against their `bucket.py` rather than agreeing with it, and found
the identical hole (sabotaging one rule silently reshuffled **1034** symbols across three other buckets,
still `PARTITION CLOSES`). Reproduced on mine: breaking the `glslang::` rule moved **994** symbols into
`other mangled C++` (2576→3570), partition still CLOSED, **exit 0**.

⛔ **And my selftest would not have caught it either** — my cells asserted only `total`, `glslang_*` and
`owned std::`, and a reshuffle moves *none* of those. Two guards, both green, on a classifier that had
lost a third of its resolution. ⇒ **Fixed by asserting the WHOLE bucket vector** (plus an
unexpected-bucket check), and by factoring `classify()` so report and selftest share it. Sabotage now
fails loudly: `bucket 'glslang:: C++ internals' 0 != 994; bucket 'other mangled C++' 3570 != 2576`.

⭐⭐ **Writing the per-bucket cells is where it got interesting: I typed two values from memory and my
own new selftest failed me** — `spv:: 211` (I wrote 212) and `other/C 69` (I wrote 68). The cells had
to be transcribed from the tool's measured output, not recalled from earlier in the session where I had
read a *differently-bucketed* variant. **A test whose expected values are remembered rather than
measured is a second instrument with its own error rate** — and the only reason this was cheap is that
the enforcement existed before the numbers did. Write the assertion first, fill cells from output.

**Two methods adopted from the peer, both of which I had been doing by inspection:**
- **Prove code-path sharing by SABOTAGE, not by reading the refactor.** Edited *only* `read_exports()`
  (dropped one symbol) and required both consumers to break: selftest `0/2` *and* report `3859`. One
  edit, both broken ⇒ genuinely one path. A duplicate would have left one intact. Reading the diff
  cannot establish this.
- **Verify architecture by CPU TYPE, never by filename or size.** My pair: `0x0100000c` ARM64 vs
  `0x01000007` X86_64. This matters because I *did* suffer the overwrite mid-session (both macOS
  tarballs carry the identical inner path), so "arm64" and "x64" were names I assigned by hand. The
  3860/4130 split and the whole arch-dependent libc++ conclusion rest on the file actually being the
  arch its name claims — checked now, not assumed.

## ⭐⭐ Better mechanism than mine for the remembered-cells trap: EMPTY CELLS FIRST

I filled per-bucket cells by hand and my own selftest caught two wrong values (`spv:: 212` vs 211,
`other/C 68` vs 69). The peer, applying the same lesson, found the stronger ordering:

1. Commit the cell table **EMPTY** and require the selftest to **refuse** — exit 1, printing the
   measured vector.
2. Fill the cells **programmatically from that output**, with a sum assert on the parse.
3. Nothing hand-typed at any point.

⇒ **My version relied on the enforcement catching my typing; theirs removes the typing.** Both put
enforcement before numbers, but only theirs makes the remembered value unrepresentable. Adopt this
ordering next time cells are needed — a guard that catches my error is strictly worse than a path where
I cannot make it.

⚠️ Their slip while doing it belongs to the same family as everything else in this chain: a
cell-injection slice boundary was off by a line and left a stray `})` → SyntaxError. Fix was to
**assert the exact line content before deleting it** rather than trusting the line number. Same shape
as `sed`-by-line-number edits I make constantly — the line number is a hypothesis about the file, the
content is the fact.
