---
type: chain
title: slang#13865 — /format slash command fails (slangbot push + comment 403)
description: Maintainer-owned CI-credential issue; slangbot account unrecoverable (10-22). Held, no dispatch, no bot post. Maintainers are designing an org GitHub App replacement for SLANGBOT_PAT themselves.
tags: [slang, ci-infra, held, maintainer-owned]
---

# slang#13865 — `/format` fails: slangbot push and comment return 403

- **Filed** 2026-10-22 12:07Z by jkwak-work (admin), self-assigned. jkwak-work also ran the failing
  `/format` on #13630 (run 39566509663). First failure seen 10-19 on #13751 (run 39307320428);
  last green run 36647963561 (09-29).
- **Cause (maintainer's, matches my 10-19 check):** the `slangbot` account has no verified
  email address, or `SLANGBOT_PAT` changed. A push to `slangbot/slang` returns 403, and the
  comment fails with "At least one email address must be verified". No coworker can fix the
  account or the secret.
- **10-22 12:22Z** jkwak-work asked whether the App-token approach from #13623 applies here. They
  suspect the App token can't open a PR against the author's fork. I checked
  `regenerate-format.yml` locally: it pushes to `slangbot/slang` and opens the PR on the
  contributor's fork (e.g. duckdoom5/slang#1), so their suspicion holds. The comment and reaction
  steps target `shader-slang/slang` only.
- **10-22 12:43Z** jkiviluoto-nv (admin) posted a 6-step fork-aware GitHub App plan:
  a dedicated App, a patch-artifact fallback for forks without the App installed, a credential-free
  format job plus a trusted publisher, `GITHUB_TOKEN` reporting, scoped permissions and signing,
  and a validation matrix. The plan says "not a deployed fix".
- **10-22 12:45Z** jkwak-work: **nobody can log in to the slangbot account any more** (the
  person with the password left the company), so the email can't be verified and the PAT can't be
  regenerated. That rules out fixing the account. Their design: no automatic PR; the App token
  pushes `format/pr-<N>` to `shader-slang/slang` with plain git, unsigned, and the bot posts a
  compare link that a maintainer clicks to open the PR. Follow-up covers TOC, cmdline-ref,
  slash-command-dispatch and check-ir-version, then deletes both SLANGBOT secrets. Not yet tested;
  org-owner permission checks pending. Posted 2 min after jkiviluoto-nv's plan, which differs:
  patch-artifact fallback and a separate credential-free format job.
- **10-22 12:49Z** jkwak-work (the assignee) **decided: go with the App-token approach.**
  Maintainers open the PR by hand from a compare link that the workflow posts, because the App
  token can't create PRs outside the repo it is installed on. No bot ask; no linked PR yet.
- **10-22 12:51Z** jkiviluoto-nv accepted the branch + compare-link delivery but raised a
  **security blocker**. The upstream `format/pr-<N>` branch carries the contributor's commits,
  including `.github/workflows/*` edits. A push made with an App token does trigger workflows, and
  a `push` run uses the workflow definitions in the pushed commit. A contributor who widens a
  push filter could therefore run their own code in the upstream Actions context. They ask for this
  boundary to be tested with a fork PR that changes a push filter, and fall back to a patch artifact
  if it can't be enforced. They also asked for: a credential-free format job split from the
  publisher, `GITHUB_TOKEN` failure reporting, and a head-SHA re-check plus `--force-with-lease`
  with per-PR serialization. The design is open again on that one point.
- **Impact on our fleet:** `check-ir-version.yml` (the IR-version reminder comment on our
  fixers' PRs) uses the same PAT, so expect it to stop posting until it is migrated. Not yet
  observed: the 8 runs from 10-19 to 10-22 all finished green and never reached the comment step
  (no IR-op changes, so no artifact).
- **Disposition:** HELD. This is the maintainers' work item and their design discussion. None of
  the comments mentions @nv-slang-bot. Resume only on a bot mention or an operator GO. No timer:
  webhooks deliver new comments.
