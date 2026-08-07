---
title: "Formatter availability in slang containers: the accurate, narrow statement (supersedes two earlier over-broad notes)"
type: learning
topic: slang-compiler
source: learnings/1785996289665-formatter-availability-in-slang-containers-the-acc.md
---

# Formatter availability in slang containers: the accurate, narrow statement (supersedes two earlier over-broad notes)

Two of my earlier notes on this are each wrong in opposite directions. This is the narrow, accurate version — prefer it.

**What is true:**
1. A **userspace install of clang-format IS possible** — no apt, no admin approval. Extract the PyPI wheel; it ships a prebuilt native binary:
   ```bash
   pip download clang-format==17.0.6 -d /tmp/cf17 --no-deps -q
   cd /tmp/cf17 && python3 -m zipfile -e clang_format-17.0.6-*.whl /workspace/agent/tools-cf17/
   chmod +x /workspace/agent/tools-cf17/clang_format/data/bin/clang-format
   export PATH="/workspace/agent/tools-cf17/clang_format/data/bin:$PATH"
   ```
2. **It must be 17.x.** `extras/formatting.sh:203` runs `require_bin "clang-format" "17" "18"` and that range is **`[17, 18)` — exclusive upper bound**. 18.1.8 is *rejected*: `clang-format version 18.1.8 is too new. Version less than 18 is required.` → exit 1.

**The two wrong lessons to avoid:**
- ❌ *"Formatters are absent in this container, so the PR author must run `formatting.sh`."* Too broad — you can install one and you are expected to.
- ❌ *"The wheel solves it, 18.1.8 is inside the required 17–18 window."* Also wrong — that was my note, and 18.x fails the gate. The repo's `.github/copilot-instructions.md` says "clang-format 17-18", which **reads inclusive while the script's check is exclusive**; the prose is looser than the enforcement.

**Root cause of my error, which generalises:** I installed 18.x, ran `clang-format --version`, saw a version inside what the *docs* said, and never ran the consumer. **Verify a tool version against the script that gates it, not against the tool's own `--version` or a README range.** Running the real consumer once costs three seconds and is the only thing that actually decides.

**Two related gotchas, measured:**
- **`--modified` only covers git-TRACKED files.** A brand-new untracked source file is silently skipped — exit 0, which reads as "formatted." Run `clang-format -i <newfile>` directly (it did reflow a line in mine) or `git add -N` first.
- **Type flags NARROW the run.** `--modified --cpp` skips the requirement checks for gersemi/shfmt, so a C++-only change formats fine with those absent. Don't conclude "formatting is impossible" from a missing tool your change doesn't need. Conversely, **markdown needs two passes** — see the separate `formatting.sh` flag-semantics note.

Measured 2026-08-06 in the slang-fixer container, on `extras/formatting.sh` at master `9cd92bb3a1`. `prettier` was already on PATH; `gersemi` and `shfmt` were absent and not needed for a `.cpp`/`.h` change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785996289665-formatter-availability-in-slang-containers-the-acc.md`_
