---
title: "formatting.sh version gates are half-open — clang-format 18 is REJECTED, and the rejection looks identical to 'nothing to fix'"
type: learning
topic: slang-compiler
source: learnings/1786029991163-formatting-sh-version-gates-are-half-open-clang-fo.md
---

# formatting.sh version gates are half-open — clang-format 18 is REJECTED, and the rejection looks identical to "nothing to fix"

## The trap

`extras/formatting.sh` gates tool versions with `require_bin <name> <min> <max>` where **max is
EXCLUSIVE**. Measured against slang `d7d59f374`:

- `require_bin "clang-format" "17" "18"` → **only 17.x passes.** 18.0.0, 18.1.8, 19.x are all
  "too new".
- `require_bin "gersemi" "0.21" "0.22"` → pin **`gersemi==0.21.0`**.

Verify the comparison yourself instead of reading the code:
```bash
for v in 17.0.6 18.1.8; do
  printf '%s\n%s\n' "$v" "18" | sort -V -C && echo "$v ok" || echo "$v too new"
done
```

## Why it's dangerous, not merely annoying

A missing **or** wrong-version tool sets `missing_bin=1` and the script **hard-exits 1 before
formatting a single file**. So the output of a *declined* run is indistinguishable from a *clean*
run: no diff, no file changes, nothing printed about your code. I installed `clang-format==18.1.8`,
ran `--check-only`, saw no complaints, and reported "both files come back clean." That was the
script refusing to start — and it would have surfaced as a **CI formatting failure right after the
PR opened**.

This is the general instrument-validity tell: *the output is formatted identically whether or not
it measured the thing.*

## How to know it actually ran

Check the exit code explicitly AND look for the version line on stderr:
```bash
./extras/formatting.sh --cpp --check-only; echo "exit=$?"
```
A real run prints:
```
found clang-format 17.0.6, required [17, 18)
Formatting cpp files...
exit=0
```
`exit=0` *with* the `found <tool> <version>, required [min, max)` line is the proof. `exit=1` with
`"This script needs X, but it isn't in $PATH"` or `"version X is too new"` means zero files were
touched.

## Practical notes

- Install the right version: `pip install --user --break-system-packages 'clang-format>=17,<18'`
  (needs `--break-system-packages` on this image, PEP 668), then `export PATH="$HOME/.local/bin:$PATH"`.
- **Narrow with type flags so unrelated missing tools can't block you** — `--cpp` only gates on
  `xargs` + `clang-format`, so absent `prettier`/`shfmt`/`gersemi` stop mattering. (Type flags
  NARROW, they don't add.)
- **`.lua` is not covered by the formatter at all** — `slang-diagnostics.lua` edits need no
  formatting pass.

## Doc bug (upstream, unfixed)

> ⛔ **CORRECTED 2026-08-06 — the paragraph below was WRONG about scope. It is ONE file, not two.**
> `CLAUDE.md` contains **zero** mentions of `clang-format` / `gersemi` / `17-18` / `0.21-0.22`
> (measured at `d7d59f374`; control: 620 lines readable, `formatting.sh`=2 hits). Repo-wide
> `grep -rln -- '17-18'` returns **exactly one path**: `.github/copilot-instructions.md`.
> **Why the error:** the harness injects `CLAUDE.md` with its `@.github/copilot-instructions.md`
> include (`CLAUDE.md:16`) **expanded inline with no visible seam**, so the included file's text
> gets attributed to the includer. Injected context tells you *what* was said, never *which file*
> says it — grep on disk before asserting a file contains a string.
> **Also:** the fix direction is **settled doc-side**, not open. Commit `3e42d1bf` (#7800),
> *"bump and **pin** cmake formatter version"*, adds the exclusive max **as** the pin mechanism
> alongside `gersemi==0.21`; CI's pinned blob measures clang-format **17.0.6**; `flake.nix:43-44`
> says "clang-tools 17 … matches CI"; and doc commit `686beee55` (#9822) added the "17-18" prose
> *together with* `clang-format-17` install commands. Filed as **shader-slang/slang#12394**;
> draft **PR #12358** already adds contradicting prose and is the fold-in target.
> Full detail: `1786031654836-correction-the-clang-format-17-18-doc-bug-is-one-f.md` and
> `1786031860308-correction-two-stale-learnings-still-say-both-docs.md`.

~~Both `CLAUDE.md` and~~ `.github/copilot-instructions.md` says clang-format **"17-18"**, which reads
inclusive, but the code accepts **17 only**. The doc is what misleads you into installing 18.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786029991163-formatting-sh-version-gates-are-half-open-clang-fo.md`_
