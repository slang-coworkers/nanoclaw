# All three PR-review reviewers can fail toward "clean" in one run — recover A from stream.jsonl, C from its Write payload, and never count a timed-out Devin as no-findings

On shader-slang/slang#12382 (2026-08-06) **every leg of the review pipeline degraded in a single run**, and each degradation renders downstream as "no findings":

| reviewer | failure | artifact on disk | recovery |
|---|---|---|---|
| A (correctness) | hit `--max-budget-usd 30` cap → `error_max_budget_usd` | **`final-review.md` absent**; guard printed `REVIEW-GUARD FAIL: final review is 0 bytes (<500)` and `zero Task/Agent subagent dispatches` | 19 KB recovered from `stream.jsonl` |
| C (clarity) | `API Error: Response stalled mid-stream` | **`clarity-review.md` = 78 bytes containing only that error string** | 11 candidates recovered from the `Write` tool payload |
| B (Devin) | `timeout: Devin did not reach a stable done state within 30m` | only `devin-error.txt`, no `devin-flags.md`/`devin-page.txt` | none — record as **no signal**, not clean |

**A's guard message is misleading.** It said "zero Task/Agent subagent dispatches — no reviewers ran". False: 7 subagents ran and 4 returned. Counting `subagent_type` keys in `stream.jsonl` showed `code-quality-reviewer` 220, `test-coverage-reviewer` 267, `security-code-reviewer` 128, `ir-correctness-reviewer` 129, `cross-backend-reviewer` 128, `general-purpose` 226 events. **Verify the guard's claim before believing it** — it is detecting its own missing output file, not the absence of work.

**Recovery recipes (both worked first try):**
- **A:** filter `stream.jsonl` for `type=="assistant"` with **no** `parent_tool_use_id` (excludes subagent turns), keep text blocks >500 chars, concatenate in order. A's *delivered* review plus its later amendments all live there, including the honest coverage table it wrote after the fact.
- **C:** scan `stream.jsonl` for `tool_use` where `name=="Write"` and the `file_path` ends in the candidates filename; take `input.content`. **Then check for later `Edit` calls on the same path and apply them** — otherwise you get the pre-consolidation draft. (Here: 2 Writes, 0 Edits, so the Write was complete.)

**Run dirs are NOT under the log path you passed.** A's real dir was announced in its own first lines: `>>> output → ~/.claude/skills/slang-pr-review-runner/transcripts/pr-<UTC>`; C's in `>>> clarity review: ~/.claude/skills/slang-clarity-review-runner/transcripts/pr-pr<N>-<sha>-<difhash>-<pid>-<UTC>/clarity-review.md`. Grep the log for `output →` / `clarity review:` rather than guessing.

**Drift checks still must run on recovered runs, and must carry a positive control.** Parse defensively — `message.content` is sometimes a plain string, so `for c in cont` over a str raises `AttributeError: 'str' object has no attribute 'get'`; guard with `isinstance(cont, list)` and `isinstance(c, dict)`. Gate on tool kind + command field, and assert a synthetic `gh api ... --method POST` would be detected. Results: A 0 writes / 382 tool calls, C 0 / 83, control fires. Set `reviewers_complete: false` whenever any leg degraded.

**Fresh `git worktree` needs submodules before configure** — `cmake --preset default` dies with `external/unordered_dense does not contain a CMakeLists.txt`. Run `git submodule update --init --recursive --depth 1` first. Also: the unit-test ninja target is **`slang-unit-test`**, not `slang-unit-test-tool` (that's the slang-test *invocation* path); the built library lands in `build/Release/lib/`, not `bin/`.

**Byte-verify the binary before trusting a test number.** An untracked scratch `.cpp` I had written into `tools/slang-unit-test/` was **globbed into the build** (`slang_add_target` → `slang_glob_sources`), so my first "clean" results came from a contaminated binary. Discard, remove, rebuild, then `strings <lib>.so | grep -c <test-symbol>` for the PR's test **and** for your own scratch symbol before reporting.
