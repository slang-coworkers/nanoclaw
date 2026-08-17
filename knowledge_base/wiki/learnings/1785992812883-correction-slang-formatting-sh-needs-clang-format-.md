---
title: "CORRECTION: slang formatting.sh needs clang-format 17.x — 18.x is REJECTED as too new"
type: learning
topic: slang-compiler
source: learnings/1785992812883-correction-slang-formatting-sh-needs-clang-format-.md
---

# CORRECTION: slang formatting.sh needs clang-format 17.x — 18.x is REJECTED as too new

**Corrects my earlier note "clang-format for slang formatting.sh: extract the PyPI wheel" (2026-08-06), which said 18.1.8 is inside the required window. It is NOT.** `append_learning` is immutable, so this is the correction; prefer this one.

`extras/formatting.sh:203` calls `require_bin "clang-format" "17" "18"`, and that range is **[17, 18) — exclusive upper bound**. With clang-format 18.1.8 on PATH the script fails:

```
found clang-format 18.1.8, required [17, 18)
clang-format version 18.1.8 is too new. Version less than 18 is required.
FMT_EXIT=1
```

**Use 17.x:**
```bash
pip download clang-format==17.0.6 -d /tmp/cf17 --no-deps -q
cd /tmp/cf17 && python3 -m zipfile -e clang_format-17.0.6-*.whl /workspace/agent/tools-cf17/
chmod +x /workspace/agent/tools-cf17/clang_format/data/bin/clang-format
export PATH="/workspace/agent/tools-cf17/clang_format/data/bin:$PATH"
./extras/formatting.sh --modified --cpp    # → found clang-format 17.0.6, required [17, 18) ✓ exit 0
```

**How I got it wrong:** I extracted the 18.x wheel, ran `clang-format --version`, saw `18.1.8`, and reasoned "the docs say 17-18, so 18 qualifies." I never ran the consumer. The repo's own `.github/copilot-instructions.md` says "clang-format 17-18", which reads as inclusive — **the prose is looser than the check**; `require_bin`'s upper bound is exclusive. Classic case of trusting a documented range over the executable that enforces it, and of validating a tool by its own `--version` rather than by the script that consumes it.

**Two further gotchas measured the same session:**
- **`--modified` only covers git-TRACKED files.** A brand-new untracked source file is silently skipped — no error, exit 0, which reads as "formatted." Run `clang-format -i <newfile>` directly (it did reflow a line in mine), or `git add -N` first.
- **Type flags NARROW the run.** `--modified --cpp` skips the gersemi/shfmt requirement checks for tools you don't need, so a C++-only change formats fine with gersemi and shfmt absent. Don't conclude "formatting is impossible here" from an unrelated missing tool.

**Rule generalised: verify a tool version against the script that gates it, not against the tool's own `--version` or the prose in a README.** Run the real consumer once and read its exit code — three seconds, and it is the only thing that actually decides.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785992812883-correction-slang-formatting-sh-needs-clang-format-.md`_
