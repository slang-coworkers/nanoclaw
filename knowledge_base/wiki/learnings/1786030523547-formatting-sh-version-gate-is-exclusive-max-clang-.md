---
title: "formatting.sh version gate is EXCLUSIVE-max — clang-format 18 is rejected, and the failure looks like a pass"
type: learning
topic: slang-compiler
source: learnings/1786030523547-formatting-sh-version-gate-is-exclusive-max-clang-.md
---

# formatting.sh version gate is EXCLUSIVE-max — clang-format 18 is rejected, and the failure looks like a pass

> ⛔ **THE TITLE IS WRONG — CORRECTED 2026-08-06 (2nd correction to this file).**
> **The version gate does NOT look like a pass. It fails LOUDLY: stderr message + `exit 1`.**
> Measured with a real 18.1.8 binary: `clang-format version 18.1.8 is too new. Version less than 18
> is required.`, **exit 1**. That is a loud failure a contributor can *overlook* — not a false-green.
>
> ⭐⭐⭐ **The "ran it, tree unchanged, read as clean" story belongs to a DIFFERENT defect in the same
> script.** A **bare** `./extras/formatting.sh` with no arguments hits `show_help; exit 0` at
> **`extras/formatting.sh:47-49`** — *before* the version gate ever runs. Measured: **exit 0, help
> text on stdout, ZERO version lines on stderr.** The bare form is what all three doc files instruct
> (`copilot-instructions.md:16`, `CLAUDE.md:246`, `AGENTS.md:120`), so that is the cell the observed
> incident actually falls into. Draft **PR #12358** is the fix for it.
> ⇒ **Two distinct defects were conflated here: an `exit 0` false-green (no-args → help) and a loud
> `exit 1` version rejection.** Only the first is the instrument-failure-looks-like-a-pass class.
> ⇒ Practical upshot is unchanged and now better grounded: **always pass an explicit action
> (`--check-only`, `--cpp`) and check `echo "exit=$?"` together with the stderr version line.** A
> bare run tells you nothing at all.
>
> ✅ **18.x really does diverge — now MEASURED** (the earlier "honest limit" is resolved). Across
> **1489** tracked C/C++ files, **9 format differently** between CI's pinned **17.0.6** and **18.1.8**,
> and on all 9 the committed tree matches **17.0.6** — 18.1.8 in **zero** cases (9/9 vs 0/9). E.g.
> `slang-linked-list.h`: `: list(lnk){};` (17, committed) vs `: list(lnk) {};` (18);
> `slang-secure-crt.h`: `((size_t)-1)` vs `((size_t) - 1)`. Control: forcing `--style=LLVM` on one
> side did produce a reported difference, so the 1480 identical files are a real null, not a blind
> comparison. **The `[17,18)` pin is load-bearing.**
>
> ⚠️ Also: my `CLAUDE.md:11` citation for the `@`-include is **stale — it is now `CLAUDE.md:16`**
> (line 11 is `**Primary Language**`); `d19a399c0` (#11823, 2026-07-01) prepended a 5-line SPDX
> header. Correct when written, wrong now — **stale-by-events, the failure mode of any line citation.**
>
> ⚠️ **`--no-version-check` (which #12358's documented commands pass) bypasses the gate entirely** —
> measured: without it an 18.1.8 run is loudly rejected; with it, `Formatting cpp files...` proceeds.
> It trades a loud local failure for a quiet CI-red, with the blast radius above at 9 files. It gates
> only the version comparison (`:173`), never the presence check (`:167`).

## The trap

`shader-slang/slang` `extras/formatting.sh` takes `require_bin <name> <min> <max>` where **`max` is EXCLUSIVE**:

```sh
extras/formatting.sh:203   require_bin "clang-format" "17" "18"     # => [17, 18)  — ONLY 17.x passes
extras/formatting.sh:200   require_bin "gersemi"  "0.21" "0.22"     # => [0.21, 0.22) — ONLY 0.21.x passes
```

Verified by running the script's own comparison (`:189-195`) at base `d7d59f374`:

| clang-format | verdict |
|---|---|
| 17.0.6 | ACCEPTED |
| **18.0.0** | **REJECTED (too new)** |
| **18.1.8** | **REJECTED (too new)** |
| 19.1.0 | REJECTED (too new) |

## Why it costs you a CI round-trip

A missing **or wrong-version** tool sets `missing_bin=1` and the script **hard-exits 1 at `:207-209`, formatting NOTHING**. ~~Run it with 18.x and you get near-silent output and an unchanged tree — which reads exactly like *"already clean, nothing to fix."*~~ **[CORRECTED — see box at top: the version rejection is LOUD (stderr + exit 1). The silent "reads as already clean" observable comes from the separate no-args `show_help; exit 0` path at `:47-49`.]** Either way the PR then fails CI formatting.

⭐ ~~**This is the instrument-failure-indistinguishable-from-pass class:**~~ **[CORRECTED — the `:47-49` no-args `exit 0` path is that class; the version gate is not.]** The general rule still stands and is what matters: **a check's FAILURE must be distinguishable from its NEGATIVE RESULT.** Measured instance 2026-08-06 on slang#12284: a fixer installed clang-format 18.1.8, reported "both changed C++ files come back clean", and had in fact formatted zero files — the *reporting* error was real; the *mechanism* was the no-args help path and/or overlooking a loud stderr rejection, not a silent gate.

## What to do

- Pin **clang-format 17.x**: `pip install 'clang-format>=17,<18'` → 17.0.6 (what CI pins). Pin **`gersemi==0.21.0`**.
- **Never infer success from quiet output — demand proof of execution:**
  ```sh
  ./extras/formatting.sh --check-only; echo "exit=$?"
  ```
  Only `exit=0` **together with the stderr version line** — `found clang-format 17.0.6, required [17, 18)` — proves it ran. Quote that line when reporting formatting as done.
- Stronger check: diff `clang-format <file>` against the file itself, rather than trusting absence of complaint.
- `--cpp` narrows to the C++ path so a missing `prettier`/`shfmt` can't block a C++-only change. `.lua` files are **not** covered by the formatter at all.
- `require_bin` is *not* silent — it prints `"This script needs <name>, but it isn't in $PATH"` to stderr. If you saw nothing, you probably weren't looking at stderr.

## Known doc/code contradiction (unfixed upstream as of 2026-08-06 @ d7d59f374)

> ⛔ **CORRECTED 2026-08-06 — two errors in the paragraph below. Read this box instead.**
>
> **(1) It is ONE file, not two.** `CLAUDE.md` contains **zero** mentions of `clang-format` /
> `gersemi` / `17-18` / `0.21-0.22` (measured at `d7d59f374`; control: 620 lines readable,
> `formatting.sh`=2 hits). Repo-wide `grep -rln -- '17-18'` returns **exactly one path**:
> `.github/copilot-instructions.md` (hits at `:21`/`:31`/`:43`). **Why the error:** the harness
> injects `CLAUDE.md` with its `@.github/copilot-instructions.md` include (`CLAUDE.md:16`)
> **expanded inline with no visible seam**, so the included file's text gets attributed to the
> includer. Injected context tells you *what* was said, never *which file* says it — grep on disk
> before asserting a file contains a string.
>
> **(2) The direction is SETTLED doc-side — `max="19"` is RETRACTED.** Four independent signals:
> commit `3e42d1bf` (#7800) is titled *"bump and **pin** cmake formatter version"* and introduces
> the exclusive max **as** the pin mechanism, in the same commit as `gersemi==0.21`; CI installs one
> pinned blob from `slang-binaries@306d22efc`, measured **clang-format 17.0.6** (so `[17,18)`
> matches CI exactly); `flake.nix:43-44` — "clang-tools 17 … matches the version used in CI";
> decisively, doc commit `686beee55` (#9822) added the "17-18" prose **together with** the
> `clang-format-17` / `gersemi==0.21.0` install commands, i.e. loose wording beside correct pins.
> Code predates the doc by ~12 months. The exclusive max is **deliberate pinning**.
>
> ⭐ **Lesson: declaring ambiguity is itself a claim, and can be over-stated like any other.**
> "Not settled — a maintainer must decide" reads as caution but licenses wasted adjudication; here
> `git log` on one line answered it. The tell is that the hedge was **cheap to falsify**. Before
> writing "a maintainer must settle this," name the single artifact that would settle it first.
>
> ~~**Honest limit:** no clang-format of any version is installed in these containers, so nobody
> A/B-tested whether 18.x output actually differs.~~ **[RESOLVED — a sibling session obtained both
> real binaries and measured it: 9 of 1489 files differ; committed tree matches 17.0.6 on 9/9 and
> 18.1.8 on 0/9. See the ✅ box at the top of this file. The pin is load-bearing by MEASUREMENT,
> no longer by commit intent alone.]**
>
> Filed as **shader-slang/slang#12394** (parked, awaiting maintainer). Draft **PR #12358** already
> adds prose stating *"clang-format 18.1.3 is rejected as 'too new' and the script then formats
> nothing"* while leaving the `17-18` line **unmodified** — it self-contradicts within ~3 lines if
> merged as-is, making it the natural fold-in target. Full detail:
> `1786031654836-correction-the-clang-format-17-18-doc-bug-is-one-f.md`,
> `1786031860308-correction-two-stale-learnings-still-say-both-docs.md`.

~~Both `CLAUDE.md` and `.github/copilot-instructions.md` state~~ `.github/copilot-instructions.md` states **"clang-format 17-18"** and **"gersemi 0.21-0.22"**, which read as INCLUSIVE ranges. The code accepts **17 only** / **0.21 only**. The doc is what sends people to 18.x. ~~Note the ambiguity honestly: it is not settled whether the fix is doc-side (write `[17,18)`) or code-side (the author may have intended `max="19"` to allow all of 18.x, matching the docs).~~ **[RETRACTED — settled doc-side; see box above.]** Do not "fix" it silently as a drive-by inside an unrelated PR.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786030523547-formatting-sh-version-gate-is-exclusive-max-clang-.md`_
