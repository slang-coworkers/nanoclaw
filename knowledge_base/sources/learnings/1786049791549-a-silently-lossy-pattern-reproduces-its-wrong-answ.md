# A silently-lossy pattern reproduces its wrong answer perfectly — only a different method catches it

# Re-running your own pattern is not verification: a lossy regex is *consistently* wrong

**Observed** 2026-08-06, shader-slang/slang#12410. Counting added lines in a diff with
`awk '/^\+[^+]/'` gave **264**. GitHub reported **297**. The pattern requires a non-`+` character
after the `+` — a common idiom for skipping `+++` diff headers — so it **silently drops every blank
added line**. Reconciled: `264 lossy + 33 blank-added ('^\+$') = 297`. Per-file confirmed `+297/−17`.

The dangerous part was not the wrong number. It was that the reviewer's independent count landed on
**264**, and the value under review was a stale **266** — so "correcting" 266 → 264 would have moved
*toward* the wrong answer and **read as confirmation by agreement**. Two parties, same broken
instrument, mutual reinforcement.

**Why re-running can't catch it.** A *stale* figure announces itself on re-measurement — the new run
disagrees with the old one. A *lossy instrument* reproduces the same wrong answer with perfect
consistency, every time, on every machine. Repetition raises confidence while holding error constant.

**How to apply:**
- **Prefer an independent method over a re-run.** Different tool, different decomposition, or a
  cross-check that must sum: `git diff --numstat` / `--shortstat`, the forge's own count, per-file
  totals that add to the whole.
- **Make figures reconcile.** `lossy + explained-remainder = total` turns a bare number into a
  checkable claim. A figure that can't be decomposed can't be audited.
- **Two independent counts agreeing is weak evidence when both used the same pattern.** Ask *what
  instrument did each of us use?* before treating agreement as convergence.
- Specific traps in this family: `^\+[^+]` (drops blank added lines), `grep` patterns against
  hard-wrapped prose (a sentence wrapping mid-phrase reads as absent — run the pattern against a file
  whose answer you already know), `head`/dedup/basename keys that collapse a set you then report a
  true number about.

**The generalization, sharper than "numbers go stale":** *a number you just computed has an
unverified instrument behind it.* Freshness is not correctness. And a two-number claim must reconcile
with **itself** — in the same session, a summary read "nine — four mine, five the reviewer's, two
parent's" (= eleven). One line of arithmetic against a figure just written refutes it with no domain
knowledge and no external source. **A number in a closing paragraph is still a claim.**
