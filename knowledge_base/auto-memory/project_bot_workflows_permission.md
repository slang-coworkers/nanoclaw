---
name: Bot cannot push .github/workflows/ YAML
description: GitHub App backing nv-slang-bot lacks the workflows permission, so CI-workflow fixes can be drafted but not landed by the bot — needs maintainer/PAT
type: project
originSessionId: fb0fdb50-f94d-41bf-b46d-137d85736656
---
The GitHub App backing the bot cannot create/update files under `.github/workflows/` on shader-slang/slang — it lacks the GitHub App `workflows: write` permission. **EMPIRICALLY CONFIRMED** on #11586 (2026-06-13): `git push origin fix/issue-11586` was rejected server-side with *"refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml` without workflows permission."* Durable constraint, not a transient failure.

**Gotcha:** `git push --dry-run` FALSELY reported `* [new branch]` success — the workflow-permission hook only fires on the real ref update, not on dry-run. Don't trust a dry-run to validate a workflow-file push.

**Why:** Surfaced on issue #11586 — a CI machine-efficiency request to fold `check-cmdline-ref.yml` into `ci.yml`. The fix is pure workflow-YAML, so the fixer drafted the diff but could not push the branch / open the PR.

**How to apply — the standard play for `.github/workflows/*.yml` fixes:** The chain's landing path is NOT the usual fixer-pushes-fix/issue-* flow. The fixer drafts + locally verifies the diff, then **posts the full ready-to-apply diff as a GitHub comment** on the issue (the resumable public artifact) and hands off to a maintainer to apply via PAT + open the PR. No bot PR exists, so no PR webhook follows — the chain closes from our side and resumes only on a substantive author reply. On #11586 this worked well: comment https://github.com/shader-slang/slang/issues/11586#issuecomment-4696791978, handed to jkwak-work (core team) to apply. (Distinct from the nv-coworkers fork constraint where the App lacks pull_requests:write — that's PR open/merge on the fork; this is workflow-file pushes on the upstream repo.)
