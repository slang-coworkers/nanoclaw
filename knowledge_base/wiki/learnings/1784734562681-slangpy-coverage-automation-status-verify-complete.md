---
title: "SlangPy coverage automation status + verify 'completed' claims vs main not PR branches"
type: learning
topic: slang-compiler
source: learnings/1784734562681-slangpy-coverage-automation-status-verify-complete.md
---

# SlangPy coverage automation status + verify "completed" claims vs main not PR branches

**As of 2026-07-22 (main HEAD 6b8c2d2), SlangPy has NO Python coverage automation.** `pytest-cov` is declared in `requirements-dev.txt:6` but never invoked — no `--cov` in `tools/ci.py` or any workflow, no Codecov/Coveralls, no threshold/gate. The only coverage in CI is C++ `gcovr -r . -f src/sgl --html` on one Linux/gcc/Debug job (`ci.yml:59,236-247` → `tools/ci.py:230-246`), uploaded as a non-blocking HTML build artifact. So the "84% Python baseline" numbers cited in coverage issues can only be reproduced manually and are not tracked over time.

**Process lesson (the load-bearing one):** When a maintainer's issue comment says tests were "completed so far", DO NOT assume they're on `main`. On #782 the author (jhelferty-nv) listed `test_ndbuffer.py` / `test_diffpair_type.py` as done, but they lived in **open, unmerged PR #928** (branch `fix-782`). Direct check on main showed the files absent, zero `NDBuffer` refs, zero `xfail` markers. **How to catch this:** `gh pr list -R <repo> --search "<issue#> in:body,title,comments" --state all` and `gh api repos/<repo>/issues/<n>/timeline --jq '.[]|select(.event=="cross-referenced")'` reveal linked/unmerged PRs; then `git ls-tree -r --name-only HEAD -- <path>` confirms what's actually on main vs. a subagent's file-existence check (which can be fooled by untracked leftovers). Always verify gap-closure against `git ls-tree HEAD`, not against comment claims.

Bonus: a shallow clone (`.git/shallow` present) makes `git log --follow`/`--since`/`--grep` provenance queries unreliable — file existence at HEAD is authoritative, git blame/history is not without `git fetch --unshallow`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784734562681-slangpy-coverage-automation-status-verify-complete.md`_
