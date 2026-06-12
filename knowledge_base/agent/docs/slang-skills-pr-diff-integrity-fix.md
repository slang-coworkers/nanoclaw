# slang-skills fix — pr-review-runner stale-diff integrity (ready to open as PR)

**Repo:** `shader-slang/slang-skills` · **File:** `skills/slang-pr-review-runner/scripts/compose-and-run.sh`
**Origin:** slang-reviewer found Reviewer A silently reviewed PR #11443's stale `tmp/pr-diff.patch` while reviewing #11455 (sandbox-denied write → fell back to stale file → wrong PR, no error).
**Lane:** review-infra, NOT compiler code → outside slang-fixer's lane. Main owns this PR.
**Priority:** P2 — nothing on #11454 blocked (PR draft, can't merge). Safety net (coordinator-verifies-diff) already in shared learnings.

**Scope note:** the poison filename `tmp/pr-diff.patch` is hard-baked into upstream production `REVIEW.md` (lines 36-41, 71) + ir-correctness/security subagents, read live for byte-equivalence. CANNOT relocate to a per-run `run_dir` without an upstream slang PR that changes production behavior. So the fix is: clear stale cache at run start + post-run integrity guard, both in the wrapper we own.

## Patch (tested-by-eye by slang-reviewer against this run's real diff)

### (1) Root-cause fix — right after `cd "$REPO_ROOT"` (line 76), covers all modes
```bash
rm -f "$REPO_ROOT/tmp/pr-diff.patch" "$REPO_ROOT/tmp/pr-files.txt"
```
Strictly safer: worst case the model's write is denied, it reads nothing, falls back to live `gh pr diff` (works) — can never read a WRONG diff again.

### (2) Defense-in-depth — after `bash "$HERE/repro.sh"; RC=$?` (line 123), before patch-mode cleanup
```bash
# Integrity guard: the model reviews $REPO_ROOT/tmp/pr-diff.patch (per REVIEW.md).
# Assert it actually matches PR $PR_NUMBER, so a stale/wrong diff fails LOUD, not silent.
if [ "$MODE" = "pr" ] && [ -f "$REPO_ROOT/tmp/pr-diff.patch" ]; then
  used=$(grep -oE '^\+\+\+ b/.+' "$REPO_ROOT/tmp/pr-diff.patch" | sed 's#^+++ b/##' | sort -u)
  real=$(gh pr view "$PR_NUMBER" -R "$REPO" --json files -q '.files[].path' 2>/dev/null | sort -u)
  if [ -n "$real" ] && [ "$used" != "$real" ]; then
    echo "!!! INTEGRITY-FAIL: reviewed diff != PR $PR_NUMBER files — review targeted the WRONG diff" >&2
    printf 'reviewed:\n%s\n\nactual PR files:\n%s\n' "$used" "$real" > "$RUN_DIR/INTEGRITY-FAIL.txt"
  fi
fi
```
Then have `summarize.py` surface `INTEGRITY-FAIL.txt` next to its existing drift signal so the workflow's run summary shows it. If `tmp/pr-diff.patch` is absent (model fell back to bare `gh pr diff`), that's the safe path — skip the check, don't fail.

**Primary = the `rm`** (kills cross-run stale artifact). **Guard = the net** (catches ANY stale/wrong diff). The model does the fetch inside `claude --print`, not the wrapper — hence the check is post-run, not pre-subagent.

## #11455 going-ready gate (unchanged)
clean correctness re-pass (post-rm) + jkwak-work's 3 scope answers + C001 generic-static `CoopMat::Load` test.
