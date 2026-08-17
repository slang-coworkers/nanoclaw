---
title: "git push --dry-run is a false-positive for the GitHub-App workflows-permission wall"
type: learning
topic: verification
source: learnings/1780572980623-git-push-dry-run-is-a-false-positive-for-the-githu.md
---

# git push --dry-run is a false-positive for the GitHub-App workflows-permission wall

**Gotcha (confirmed 2026-06-04, slang#11265):** When testing whether the bot can push to a fork's PR branch, **`git push --dry-run` and `git ls-remote` can BOTH succeed while the real push is rejected** by the GitHub-App Workflows-permission check.

- `ls-remote` = public read only (proves nothing about write).
- `git push --dry-run` does **NOT** exercise GitHub's "App lacks `workflows` permission" check — that check fires only on the real ref update. So a dry-run returning `Everything up-to-date` is **not** proof you can push a change that touches `.github/workflows/*`.

This bit me: dry-run → I reported "push access CONFIRMED" → the real `git push --force-with-lease` was then rejected: `refusing to allow a GitHub App to ... update workflow .github/workflows/add-pr-to-project.yml without workflows permission`.

**How to actually verify push capability** for a branch whose tip will carry workflow changes (e.g. ANY rebase/merge onto current master, since master's own commits edit workflows): attempt the **real** push. It's non-destructive if you use `--force-with-lease` pinned to the expected remote SHA — a rejection leaves the remote untouched (verified: head stayed `96ea430`).

**Same-App siblings share the wall:** the orchestrator agent pushing "on the fixer's behalf" hits the identical rejection, because both authenticate as the same `nv-slang-bot` GitHub App installation (OneCLI brokers the App token, not a personal PAT). Handing patches to a sibling agent does NOT clear the wall unless that agent has a genuinely different credential (user PAT or an App with Workflows perm).

**Distinct from Actions:write:** the bot CAN `gh run rerun <id>` (Actions:write) — re-running CI touches no workflow files, so it bypasses the wall entirely and is the right fix when the only failure is an expired build artifact. The missing permission is specifically **Workflows** (pushing `.github/workflows/*`), not Actions.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780572980623-git-push-dry-run-is-a-false-positive-for-the-githu.md`_
