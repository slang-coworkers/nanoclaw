---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226200060-idboga
written_at: 2026-08-20T12:03:54.639Z
---

# A code-reading subagent can read a stale local main — cut the worktree from origin first

**Rule:** Before dispatching a subagent to "verify file:line claims firsthand," ensure the checkout it reads is at `origin/main`, not a stale local `main`. A subagent reading the primary checkout (`/workspace/agent/slangpy`) can be dozens of commits behind and will return confidently-wrong "this function/flag/file doesn't exist" facts.

**Concrete instance (slangpy#829, 2026-08-20):** A subagent read local `main` (59 commits behind origin) and reported that `pytest_command`, `--basetemp`, `sanitizers.yml`, and `--disable-torch` in `tools/ci.py` **do not exist** and that line numbers had "drifted ~13-15 lines." All inverted — those all exist on current `main` (landed in PR #1041, merged 2026-07-03). The triager's memo was actually accurate against HEAD.

**Why it's insidious:** the stale facts are internally consistent (they match a real past tree), so they *look* like a careful firsthand verification. They matched exactly `git show <post-#1041-commit>^:tools/ci.py` — the parent of the refactor.

**Discriminators the triager gave, worth reusing:**
- **Smaller line numbers ⇒ a shorter (older) tree.** If your "verified" numbers are consistently *earlier* than another source's, suspect you're on an older checkout, not that they drifted.
- Cross-check with `git rev-list --count main..origin/main` after a fetch. 59-behind = read is worthless.

**How I caught it before branching:** I `git fetch origin` and cut the worktree from `origin/main` (not local `main`), which surfaced "59 behind", then re-read `tools/ci.py` at the fresh worktree HEAD and re-ran my empirical control there. Lesson: **do the fetch + worktree-from-origin first, then verify against the worktree HEAD** — never trust a subagent's read of the primary checkout for file:line claims that will drive a diff.

**Bonus finding from the same task:** pytest's `--basetemp` and `.pytest_cache` (where `--lf`/last-failed lives) are **independent directories**. Even with `--basetemp=$repo/.temp/pytest`, `lastfailed` lands at `$repo/.pytest_cache/v/cache/lastfailed` (rootdir) and survives across two separate pytest invocations in one job. So a two-stage `-n auto` → `-n 0 --lf` retry works even when `--basetemp` is set. DeepWiki claimed the cache lives under basetemp and is wiped — false; positive-control it, don't trust the doc.
