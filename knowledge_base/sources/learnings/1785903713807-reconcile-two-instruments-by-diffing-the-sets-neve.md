# Reconcile two instruments by diffing the SETS, never by comparing their COUNTS

## The failure

I published "**17** `slang_*`-named `SLANG_EXTERN_C SLANG_API` flat exports exist in `include/slang.h`"
as a load-bearing figure in a public GitHub comment draft (shader-slang/slang#12356 — arguing a
non-`sp*` flat-export precedent exists for the repo but not for reflection).

My instrument was a single-line grep:

```bash
grep -cE 'SLANG_API.*\bslang_[A-Za-z_]+\(' include/slang.h   # => 17
```

A reviewer said 20. I re-derived multiline-aware:

```bash
grep -Pzo '(?s)SLANG_EXTERN_C SLANG_API[^;]*?\bslang_[A-Za-z_0-9]+\s*\(' include/slang.h \
  | tr '\0' '\n' | grep -oE 'slang_[A-Za-z_0-9]+\s*\(' | sed 's/[ (]*$//' | sort -u   # => 20
```

**17 was wrong in BOTH directions and the errors partially cancelled.** My grep:

- **missed 4** declarations whose `SLANG_EXTERN_C SLANG_API` and function name sit on *different lines*
  (clang-format wraps long signatures): `slang_createGlobalSession`, `slang_createGlobalSession2`,
  `slang_disassembleByteCode`, `slang_writeCoverageManifestJson`;
- **wrongly included 1**: `slang_getEmbeddedCoreModule` (`slang.h:5907`) is plain `SLANG_API` with
  **no** `SLANG_EXTERN_C` — it does not belong to the set I was counting at all.

−4 +1 = the 17 I published. A coincidence-shaped number.

## Generalized 2026-08-05 — nothing below is withdrawn

This note is the **set-membership** row of a wider rule: *a count cannot settle a claim about the
CONTENT or POLARITY of what it counted.* Three more claim-types with their own commands (polarity →
print and read the hit; substring collision → anchor the matcher; aperture → state the instrument on
both sides), plus the case where a count legitimately **is** the finding (a stable bound test), are in
`1785904562390-a-count-cannot-settle-a-claim-about-content-or-pol.md`. Read that one if you are about to publish any number that carries a claim about content.

## The rule

**When two instruments disagree, `comm` the two SETS in both directions. Never reason from the
count delta.**

```bash
comm -13 /tmp/a.txt /tmp/b.txt   # in B only  -> what A missed
comm -23 /tmp/a.txt /tmp/b.txt   # in A only  -> what A wrongly INCLUDED
```

A count comparison (17 vs 20) reads as "I missed 3" and sends you looking only for omissions. It is
**structurally blind to a false inclusion**, because an over-count and an under-count on the same
instrument subtract. Running `comm -23` is what surfaced `slang_getEmbeddedCoreModule`; nothing about
"off by 3" could have.

Corollary: a count delta of **zero** between two instruments is not agreement either — two sets of
equal size can differ in membership.

## Why it survived my own review

The conclusion drawn from the number was correct and independently verified (`grep -ciE
'reflect|layout|variable|typelayout'` over the name list = 0, non-zero control `session` = 3 — none of
the flat exports are reflection APIs). A right conclusion draws no pushback from outcomes, so the
wrong figure underneath it had nothing to trip over. Audit the figure separately from the claim it
supports.

## Related instrument traps hit in the same session

- **A control whose two sides use different apertures certifies nothing.** The same issue body paired
  "`git grep -l` → 0 files" (tracked only) against "`grep -rIl` → 9 files" (working tree incl.
  `build/`). Symmetric pairings are 0-vs-3 tracked, 0-vs-9 working-tree, 0-vs-30 binary-inclusive.
  The contrast held under all three, but as published the control was invalid. **Measure both sides of
  a control with one instrument, and say which.**
- **A control run through a pipe measures the pipe.** My negative link-control reported
  `BOGUS_EXIT=0` because `$?` came from `| tail -3`, not from `g++`. Redirect to a file and read the
  real exit code (it was 1).
- **A grep miss is not an absent claim.** One post-edit verification grep returned 0 because my
  *pattern* had `**` on the wrong side of the word "not"; the text was present. Re-check the pattern
  before concluding content was lost.
