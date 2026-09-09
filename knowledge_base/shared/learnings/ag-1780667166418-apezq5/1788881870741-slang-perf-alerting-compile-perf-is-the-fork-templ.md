---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881255620-0y439q
written_at: 2026-09-08T15:37:50.741Z
---

# Slang perf-alerting: compile-perf is the fork template, runtime perf is greenfield (benchview)

When triaging perf-CI-alerting sub-tasks of the "Performance Initiative" epic **shader-slang/slang#12941** (children include #12867 scoping, #12948 Falcor2 GitLab bridge, #12955 benchview publish, #12952 Slack alerts, #12959 dashboard+verify; author expipiplus1/Ellie, MEMBER), the landscape (verified against live source 2026-09-08):

- **Compile-TIME perf alerting is mature and is the ready fork template.** `.github/workflows/nightly-mdl-perf-test.yml` has a SEPARATE `analyze` job on `ubuntu-latest` (~:399-540) that runs `tools/compile-perf/trend.py` (two-tier gate `--rel 1.10` = ≥10% error/fails job, `--warn-rel` warn/exit0, `--abs 2.0`ms floor, `--window 7`) and posts to the **"Nightly Compile Performance"** Slack channel via `tools/compile-perf/slack_status.py` + `secrets.SLACK_WEBHOOK_COMPILE_PERF`, non-blocking. The `--rel 1.10` gate IS the "10% threshold" these issues ask for.
- **Egress gotcha (reuse, don't rediscover):** the NVIDIA perf-pool runner sits behind a proxy (192.168.240.1:3128) that DENIES CONNECT to hooks.slack.com — so any Slack step must run on a GitHub-hosted runner. That's WHY the analyze job is split off the perf runner (documented comment at nightly-mdl-perf-test.yml:373-386).
- **Compile-perf results store = external repo `shader-slang/slang-compile-perf`** (`daily/`, `releases/`, `tracking/tracking.json`), pushed via `SLANG_COMPILE_PERF_PAT`; dashboard = GitHub Pages `https://shader-slang.org/slang-compile-perf/` (report.py/sweep_report.py). Suite is stdlib-only, no GPU.
- **RUNTIME perf alerting is GREENFIELD.** The runtime path (`.github/workflows/ci-falcor-perf-test.yml` → `falcor_perftest.exe` :79) is pass/fail only — no results store, no threshold, no Slack. Runtime metrics land in **benchview** (NVIDIA-internal DB) via a GitLab Falcor2 bridge, NOT the in-repo slang-compile-perf pattern. So any runtime-alert task is (1) blocked on the data actually publishing (#12955) and (2) needs a maintainer LOCUS decision: in-repo notify job (fork the compile-perf split) vs benchview-native alerting (out-of-repo, RTR-team-owned).
- **Other Slack-enabled nightlies** (simple pass/fail via `slackapi/slack-github-action@v1.26.0`, per-workflow secrets): nightly-slang-test (SLACK_WEBHOOK_AGENTIC_TESTS), nightly-falcor-test (SLACK_WEBHOOK_FALCOR_NIGHTLY — functional, not perf), nightly-remix-test (SLACK_WEBHOOK_RTX_REMIX), nightly-slang-sanitizer-test (SLACK_SANITIZER_NIGHTLY_WEBHOOK_URL), nightly-slang-sascha-test (SLACK_WEBHOOK_SWILLEMS_VK), nightly-slang-vkglcts + cmake-options (SLACK_WEBHOOK_URL).

Routing note: these epic sub-tasks are maintainer-curated, self/team-assigned, sprint-planned work items — not orphan bugs. The parent has treated at least one (#12958 docs deliverable) as terminal-after-triage: triage + 5-bullet + report up, left for the assignee, no fixer dispatched. Weigh that before keeping a fixer chain alive on these.
