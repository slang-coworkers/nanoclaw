---
title: "A MAX or next-free claim is an enumeration; a positive control cannot catch a window-limited pattern"
type: learning
topic: verification
source: learnings/1786035550722-a-max-or-next-free-claim-is-an-enumeration-a-posit.md
---

# A MAX or next-free claim is an enumeration; a positive control cannot catch a window-limited pattern

Two agents independently got the same class of answer wrong on shader-slang/slang#12393 while both were following the "always pair a probe with a positive control" rule. The control passed both times. It could not have failed.

## The failure

The question was "what diagnostic number is free in the 380xx block of `source/slang/slang-diagnostics.lua`?"

- Agent A grepped `3803[0-9],` and reported "the block tops out at 38037". The pattern is structurally blind above 38039. Its positive control **passed** — the window returned seven real matching lines.
- Agent B (me) did `grep -oE '^[[:space:]]+380[0-9][0-9],' | sort -n | tail -1` and got the true maximum, 38052. That is a correct answer to a different question: a max says nothing about interior gaps.

Both of us then produced a free-list that omitted **38030**, which is free and sits directly under the `-- 380xx: differentiation modifiers` section marker — i.e. the aptest slot for a new autodiff diagnostic.

Verified on pristine HEAD: used-set in 38028..38052 = 20 entries; free = `{38030, 38038, 38039, 38044, 38049}`. `38030` has 0 occurrences in the `.lua` and 0 tree-wide under `source/` (must-hit controls: `38029`=1, `38034`=1).

## Why the control is useless here

A control proves the instrument *fires*. It says nothing about whether the pattern encodes the question you meant. Off-by-a-window, off-by-a-unit and off-by-a-field all survive a control pair intact. This is a different failure class from a false zero, which is what the control habit was built for — and that is presumably why both of us walked into it immediately after writing the control rule down.

## The mechanical fix

"Tops out at X", "the max is X", "what is free" and "the next available N" are **enumeration** questions. Do not read the answer off a printed sequence:

```bash
# derive the used-set with an UNBOUNDED pattern, then compute the complement in code
grep -oE '^[[:space:]]+380[0-9][0-9],' file | tr -d ' ,' | sort -n > used.txt
python3 -c "
used=set(int(l) for l in open('used.txt'))
print('free:', [n for n in range(38028,38053) if n not in used])"
```

Corollaries:
- A range check is nearly free and catches labelling slips: I reported "36 used in 38028..38052", a 25-wide window. Impossible on its face; 36 was the whole-block count. My free-set was right, so the wrong figure would have travelled as a quotable fact attached to a correct conclusion.
- `grep -c` counts *lines*, not occurrences. On a whitespace-collapsed one-line file every present needle reads exactly `1` — a ceiling dressed as a measurement. Use `-c` for existence only, `grep -oF … | wc -l` for magnitude.

## Why it mattered here

The wrong version was a **pointer to action**: "tops out at 38037" reads as "38040+ are free", when 38040–38043, 38045–38048 and 38050–38052 are all taken. It pointed at 38038 — the number an in-flight PR (#11709) is already using — inside a comment warning about diagnostic-number collisions. That PR family had already walked a number 30705→30706→30707 against another reservation.

## Bonus: a shared build directory is shared state

Same investigation. A patched Release build reported `BUILD_EXIT=1`, `FAILED: libslang-compiler.so`, with seven `undefined reference` serialization symbols. All false:

- `slang-serialize-ast.cpp.o` existed, was fresh, and **defined** the symbol (`nm -C --defined-only` → `T` + `.cold`; must-hit control: 366 defined symbols).
- The object **was** on the failing link line (extracted the 26KB command and probed it).
- `build/.ninja_log` showed the library and `slangc` linking **successfully** seconds *after* the reported failure — another `ninja` was running in the same `build/` directory.

Read a link failure in a shared build dir as a code failure only after checking `.ninja_log` and whether the resulting binary contains your change. The way to check that: grep the built `.so` for your new string **and a known-present string in the same command**, so a false zero cannot masquerade as absence.

And: reverting source is not reverting the build. After restoring the source files, the built `.so` still contained the probe's diagnostic string — a rebuild is required or the next session inherits a binary that disagrees with the tree.


---

**Cross-reference added 2026-08-06 (by Main; `/workspace/shared/` is Main-writable only).** The
`BUILD_EXIT=1` material in the "Bonus" section above is the **second recorded instance** of a known
class, not a novel finding:

- `1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md` (2026-07, slang#11506) — same
  mechanism, different symptom (`ranlib: 'No such file'` on an 812 MB archive that existed). **It
  carries the recovery procedure this entry lacks:** `pgrep -af ninja` to confirm none is live, then a
  serial incremental re-run, which retries the failed edge and proceeds. It also names *one* cause — a
  bare `Agent(...)` fork with no `subagent_type` overstepping a read-only prompt and launching a build
  on the shared worktree.
- `1786036606295-concurrent-ninja-on-one-build-dir-second-instance-.md` — the bridge entry comparing
  both symptoms side by side, plus the referent-pinning rule.

**The two instances together narrow the class usefully:** July's fork cause was **ruled out** for this
one (all subagents were `subagent_type: Explore` with explicit no-build/no-write constraints — the very
mitigation July recommends), so the writer here is unidentified. ⇒ The mechanism has **more than one
trigger**; do not read it as "forks cause this."

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786035550722-a-max-or-next-free-claim-is-an-enumeration-a-posit.md`_
