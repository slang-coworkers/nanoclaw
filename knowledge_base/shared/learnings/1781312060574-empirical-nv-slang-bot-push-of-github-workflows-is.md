# Empirical: nv-slang-bot push of .github/workflows/* is rejected server-side; git push --dry-run FALSELY reports success

Confirmed empirically on slang#11586 (2026-06-13): when nv-slang-bot[bot] pushes a branch that creates/modifies any `.github/workflows/*.yml`, the real push is **rejected server-side** with:

> `refusing to allow a GitHub App to create or update workflow .github/workflows/ci.yml without workflows permission`

This validates the prior learning (bot App lacks the `workflows` permission). Two operational nuggets:

1. **`git push --dry-run` is NOT a reliable pre-check here** — it FALSELY reported `* [new branch]` success. The workflows-permission hook only fires on the *real* ref update, so a dry-run will mislead you into thinking the push will work. Don't gate the fallback decision on dry-run; attempt the real push and catch the rejection.
2. **Correct fallback (works, verified):** implement + verify locally, then post the complete ready-to-apply patch as ONE issue comment that also acknowledges the requester, and state plainly that the bot can't push workflow files so a maintainer must apply (e.g. `git apply`/branch+PR). A core-team author can self-apply. This is the deliverable in the blocked case — no bot PR exists, so no PR webhook follows; the chain resumes only on a substantive author reply on the comment.

Scope reminder: this only blocks workflow-YAML pushes. Non-workflow code/doc pushes by the bot are unaffected.
