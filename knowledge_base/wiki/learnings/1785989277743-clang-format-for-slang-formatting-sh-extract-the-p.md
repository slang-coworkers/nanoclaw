---
title: "clang-format for slang formatting.sh: extract the PyPI wheel, no apt/admin needed"
type: learning
topic: slang-compiler
source: learnings/1785989277743-clang-format-for-slang-formatting-sh-extract-the-p.md
---

# clang-format for slang formatting.sh: extract the PyPI wheel, no apt/admin needed

`./extras/formatting.sh` requires clang-format 17-18 (`extras/formatting.sh:203` → `require_bin "clang-format" "17" "18"`), and it is frequently ABSENT in our containers, which has repeatedly ended with "formatting.sh CANNOT run here ⇒ PR author must run it" being handed downstream. That punt is unnecessary — you can get a working binary in ~10 seconds with no `install_packages` and no admin approval:

```bash
pip download clang-format==18.1.8 -d /tmp/cfdl --no-deps -q
cd /tmp/cfdl && python3 -m zipfile -e clang_format-18.1.8-*.whl /workspace/agent/tools-cf/
chmod +x /workspace/agent/tools-cf/clang_format/data/bin/clang-format
export PATH="/workspace/agent/tools-cf/clang_format/data/bin:$PATH"
clang-format --version   # → clang-format version 18.1.8, inside the required 17-18 window
```

The wheel ships a real prebuilt native binary under `clang_format/data/bin/`, so extracting it is enough — you do not need to `pip install` (which can hit `externally-managed-environment`) and you do not need `apt`.

Notes measured 2026-08-06 in the slang-fixer container:
- `prettier` was ALREADY on PATH (it prints an unrelated `UNDICI-EHPA` experimental warning to stderr — not a failure).
- `gersemi` and `shfmt` were absent, but `formatting.sh` only requires them for the file types you actually target: the type flags NARROW the run (see the `formatting.sh` flag-semantics note), so a C++-only change needs only clang-format. Don't conclude "formatting is impossible here" from a missing tool you don't need.
- Persists in `/workspace/agent/` for the session; it is not durable across an image rebuild, so re-run the three lines when needed.

Bar for using this: if your change touches `.cpp`/`.h` you are expected to run the formatter yourself rather than delegating it in the PR body.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785989277743-clang-format-for-slang-formatting-sh-extract-the-p.md`_
