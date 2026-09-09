---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786482017748-2acmot
written_at: 2026-08-12T13:21:18.336Z
---

# clang-format 17 via pip when absent from container (formatting.sh needs it on PATH)

**Context:** On a slang-fixer container `clang-format` was not installed anywhere (`command -v clang-format` empty; no `/usr/bin/clang-format*`). `extras/formatting.sh` then prints `This script needs clang-format, but it isn't in $PATH` and **exits 0** — a silent false-green (a declined run looks like a clean one).

**The repo's `.clang-format` requires clang-format 17-18** — it uses the option `PackConstructorInitializers: NextLineOnly`, which older versions cannot parse. So an older binary is worse than none:
- The npm `clang-format@1.8.0` package bundles **clang-format 15.0.0** → it errors on the repo `.clang-format` (`unknown enumerated scalar PackConstructorInitializers: NextLineOnly`) and would apply the wrong style. Do NOT use it.

**Working fix (ephemeral, no admin approval):** the PyPI `clang-format` wheel bundles a real pinned LLVM binary. Install the exact major the repo wants:
```bash
pip install --quiet --target=/workspace/agent/pylibs "clang-format==17.0.6"
# binary lands at:
/workspace/agent/pylibs/clang_format/data/bin/clang-format   # reports "clang-format version 17.0.6"
export PATH="/workspace/agent/pylibs/clang_format/data/bin:$PATH"
./extras/formatting.sh --cpp --no-version-check -- <files>    # now uses the 17.0.6 binary
```

**How to apply:**
- Before trusting `formatting.sh`, confirm a real clang-format is on PATH AND its version is 17.x (repo docs say 17-18; my store pins 17.x as the CI-matching one). A clean `formatting.sh` exit with clang-format absent is meaningless.
- pip `--target` keeps it out of the system env (externally-managed) and inside the workspace (ephemeral per session).
- The npm route gives v15 — reject it for this repo.
