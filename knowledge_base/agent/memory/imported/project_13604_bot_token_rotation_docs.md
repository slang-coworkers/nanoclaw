---
type: project
name: project_13604_bot_token_rotation_docs
description: "slang#13604 (jkwak-work, 10-13 16:39Z, unassigned, milestone Q4 2026): document how the daily/weekly Slack/Discord automations are set up, because their tokens/cookies expire yearly. Maintainer process/infra-docs ask, nothing asked of the bot -> held: NO dispatch, NO bot post. Repo inventory of the Slack-webhook workflows below, offered operator-only."
---

# slang#13604: document the automated-bot token setup

**10-13 16:39Z, `issue_opened`.** Live read: open, human author `jkwak-work`, no assignee, no labels, milestone
"Q4 2026 (Fall)", 0 comments, `updated_at` 49 s after `created_at` (milestone edit), live body matches the payload.
Only my webhook session `sess-1791909590901-mzn5li` is on `gh-issue-shader-slang/slang-13604`.

**Disposition: held. Nothing dispatched or posted.** Same class as #13550 / #13591 batch
([[project_13550_intrinsic_annotation_application_policy]], [[project_13591_ai_contributor_standards_batch]]): a
maintainer filed process work and asked the bot for nothing. The content (who created each secret, which account
owns it, how it was minted) lives in repo-settings secrets and people's heads, not in code a triager can read, so a
triage pass would produce only a restatement. #13596 (R6) also says the bot waits on human-filed issues.

**Repo facts I checked** (slang master `5841033344`, 10-13). Scheduled workflows posting to Slack and their secrets:

| workflow | cron (UTC) | secrets |
|---|---|---|
| `nightly-slang-sanitizer-test.yml` | `0 2 * * *` | `SLACK_SANITIZER_NIGHTLY_WEBHOOK_URL` |
| `nightly-remix-test.yml` | `0 3 * * *` | `SLACK_WEBHOOK_RTX_REMIX` |
| `nightly-slang-sascha-test.yml` | `0 4 * * *` | `SLACK_WEBHOOK_SWILLEMS_VK` |
| `nightly-mdl-perf-test.yml` | `0 5 * * *` | `SLACK_WEBHOOK_COMPILE_PERF`, `SLANG_COMPILE_PERF_PAT` |
| `nightly-slang-vkglcts-test.yml` | `00 07 * * *` | `SLACK_WEBHOOK_URL` |
| `cmake-options.yml` | `0 8 * * 6` (weekly) | `SLACK_WEBHOOK_CMAKE_OPTIONS` |
| `nightly-falcor-test.yml` | no schedule line found | `SLACK_WEBHOOK_FALCOR_NIGHTLY` |
| `nightly-slang-test.yml` | no schedule line found | `SLACK_WEBHOOK_AGENTIC_TESTS` |

No file under `docs/` or `extras/` documents any of these secrets. Slack incoming-webhook URLs don't expire on a
timer; the yearly expiry the issue describes fits the PAT (`SLANG_COMPILE_PERF_PAT`) and the Discord/"cookie"
automations, which are not in this repo's workflows (could not verify where they live by grepping slang).

**Resume** on a comment that @-mentions @nv-slang-bot (e.g. asking for a `docs/` page from the inventory), or an
operator ask to post the inventory. A mention arrives as a webhook, so no re-chase timer.
