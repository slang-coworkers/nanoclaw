---
title: "slangpy-samples CI runs pre-commit --all-files — inherited black failure is not your PR's fault"
type: learning
topic: slang-compiler
source: learnings/1783525328477-slangpy-samples-ci-runs-pre-commit-all-files-inher.md
---

# slangpy-samples CI runs pre-commit --all-files — inherited black failure is not your PR's fault

**Repo:** shader-slang/slangpy-samples. **Observed:** 2026-07-08 on draft PR #50 (coop-vec LinearLayer.slang migration, issue #45).

The `pre-commit` CI job runs `pre-commit run --all-files`, so **every PR's CI status reflects the formatting state of the whole repo, not just your diff.** As of main @ df2a1da, `black` (pinned rev 24.4.2 in `.pre-commit-config.yaml`) reformats ~8 pre-existing unformatted `.py` files (examples/*/main.py, experiments/*/main.py, tests/examples/test_examples.py, neuralnetwork/.../components/LinearLayer.py). Result: **main's own CI is red**, and any new PR inherits that red `pre-commit` check even when the PR touches zero Python.

**How to triage a `github.ci_failed` on a slangpy-samples PR before assuming it's your bug:**
1. `gh api repos/shader-slang/slangpy-samples/check-suites/<id>/check-runs` → find which check failed.
2. `gh run view <run-id> --repo shader-slang/slangpy-samples --log-failed | grep -iE "Failed|reformatted|\.py"` → see which hook + files.
3. `git diff --name-only origin/main` → if the reformatted files are NOT in your diff, it's inherited debt.
4. Confirm main is already red: `gh run list --repo shader-slang/slangpy-samples --branch main --limit 5 --json conclusion`.

**Do NOT** pull those 8 files' black reformatting into a focused/unrelated PR — that's scope creep a reviewer will flag. Document the pre-existing failure in a PR comment and move on. The black debt belongs in its own cleanup PR.

**Also:** local black may differ from CI's pinned version (I had black 26.5.1 locally; config pins 24.4.2), so `black --check` passing locally does NOT mean CI passes. `.slang` files are never processed by black; only trailing-whitespace/end-of-file-fixer/local hooks apply to them, so a pure-.slang change passes pre-commit even when the black stage fails on unrelated .py files.

Related: [[gpu-less-front-end-validation-of-slangpy-tensor-api-migrations-with-slangc]], [[slangpy-0-41-tensor-migration-coop-vec-reference-gap]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783525328477-slangpy-samples-ci-runs-pre-commit-all-files-inher.md`_
