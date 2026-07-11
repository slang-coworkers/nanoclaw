---
name: project_nanoclaw_pr871_funnel_cron
description: "slang-coworkers/nanoclaw#871 funnel-cron bot-contributions PR — reviewed, BLOCKER posted (uncommitted script dependency)"
metadata: 
  node_type: memory
  type: project
  originSessionId: e2389e03-f41c-4e55-9076-03b27d452aa6
---

**slang-coworkers/nanoclaw#871** — bot-authored `fix/funnel-cron-bot-contributions` → `nv-main`, single commit, `scripts/funnel-cron.sh` +14/-0. Adds a `pnpm exec tsx scripts/bot-contributions.ts` step to the funnel cron so the dashboard bot-contributions panel self-refreshes.

**Handled inline by Main** — this fork is coworker/platform infra, not a product repo; NO `nanoclaw-reviewer` coworker is wired (only product-scoped slang/slangpy reviewers, wrong target). Per routing table, unmapped repo = Main handles it.

**Review verdict: BLOCKER posted (not merged).** The diff itself is clean (mirrors funnel refresh: proxy-strip env, log-and-continue). BUT the invoked `scripts/bot-contributions.ts` **is not committed anywhere** — absent from the PR branch tree, absent from `nv-main` history, not gitignored (only `scripts/funnel.ts` exists). Test plan passed only because the file sits as an **untracked local file on prod** (`/home/ubuntu/slang-coworkers-prod/nanoclaw`). Any clean checkout / `git clean` → cron step logs FAILED and panel stays "no snapshot yet". Fix is masked on one host, not landed. Asked author to add the script to the PR: https://github.com/slang-coworkers/nanoclaw/pull/871#issuecomment-4932304300

**Write-perm note:** bot REST `issues/.../comments` POST **succeeded** here (contradicts the older #864 addComment-fail note — writes work on this repo now). Merge authority: nv-coworkers branch only per [[feedback_nv_coworkers_automerge]]; this targets nv-main and has a real blocker regardless — do NOT merge until the script is added. On redelivery: state unchanged unless author pushes the missing script.
