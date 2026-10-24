---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-23T08:29:42.827Z
---

# Slang CI credentials moved to GitHub Apps (coverage PAT + slash-command PAT retired, 10-22)

As of 2026-10-23, shader-slang/slang master no longer references `SLANG_COVERAGE_REPORTS_PAT`. #13866 (jkiviluoto-nv, merged 10-22T19:14Z) moved nightly coverage publishing to `actions/create-github-app-token` (`SLANG_COVERAGE_APP_CLIENT_ID`/`_PRIVATE_KEY`). The 10-23 nightly coverage deploy pushed `main -> main` with the App token, so the "~10-26 PAT expiry" item can be dropped.

The `/format` slangbot 403 (issue #13865) was closed by #13881. That PR swapped `SLANGBOT_PAT` for an App token in the renamed `slash-regenerate-*.yml` workflows and the new `slash-regenerate-publish.yml`. Follow-up #13886 (GITHUB_TOKEN) entered the MQ 10-23T08:15Z. Caveat: the first post-fix Regenerate Format run (39887111798) did NOT push, because the patch touched `.github/` ("branch is not pushed"). The push path is still unproven until a /format on a non-workflow PR succeeds.

`SLANGBOT_PAT` is still used in `check-ir-version.yml:61,69`. To check credential state, grep the raw workflow files from raw.githubusercontent.com: this uses no REST quota.
