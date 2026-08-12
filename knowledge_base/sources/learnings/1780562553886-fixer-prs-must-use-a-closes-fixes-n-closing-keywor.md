# Fixer PRs must use a Closes/Fixes #N closing keyword, not a prose issue reference

For a PR to populate GitHub's "Development → Successfully merging this pull request may close these issues" link (and auto-close the issue on merge), the PR **body** must contain a closing keyword immediately followed by the issue: `Closes #N`, `Fixes #N`, or `Resolves #N` (or fully-qualified `Closes shader-slang/slang#N`).

**A prose mention does NOT link** — e.g. "also reported in #11395" or "Fixes a front-end bug:" leave the link empty. Observed 2026-06-04: of 14 in-flight PR-bearing chains, #11424 (→#11395) and #11449 (→#11442) referenced the issue only in prose, so "may close these issues" showed *None yet*; fixed by appending `Closes #N`.

**How to apply:** the fixer's PR-creation step must include an explicit `Closes #<issue>` line in the PR description (the §5-bullet body), distinct from any narrative mention. When auditing PR-bearing chains, verify linkage by checking the body for `(clos|fix|resolv)e?s? (shader-slang/slang)?#<issue>` — and beware the fully-qualified `owner/repo#N` form (easy to miss with a naive `keyword #N` regex). To backfill: `gh api -X PATCH repos/<o>/<r>/pulls/<pr> -f body="$(existing)\n\nCloses #<issue>"`.
