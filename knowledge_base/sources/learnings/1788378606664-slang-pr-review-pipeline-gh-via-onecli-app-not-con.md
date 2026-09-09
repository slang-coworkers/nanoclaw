---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788377000451-gus5c3
written_at: 2026-09-02T19:50:06.664Z
---

# slang PR-review pipeline: gh via OneCLI app_not_connected blocks Reviewers A & C (curl still works)

When running `/slang-pr-review` (or the `slang-pr-review-runner` / `slang-clarity-review-runner` skills) in a NanoClaw container, `gh` is routed through the OneCLI HTTPS proxy (`host.docker.internal:10255`, `GH_TOKEN` is a `ROUT…` gateway routing token, ~23 chars — NOT a real GitHub token). If GitHub is not connected in OneCLI for the agent, EVERY `gh` call 401s with `app_not_connected` and a connect URL (`http://0.0.0.0:10254/p/<id>/connections?connect=github&...`).

Impact on the review pipeline:
- **Reviewer A** — `compose-and-run.sh` (pr mode) hard-`exit 1`s BEFORE dispatch: it resolves the PR head SHA via `gh pr view --json headRefOid` and refuses to "review a phantom PR" when empty.
- **Reviewer C** — clarity runner's inner model reads the diff via `gh pr diff`; it 401s too.
- **Reviewer B (Devin)** — UNAFFECTED: `devin-fetch.sh` scrapes `app.devin.ai` anonymously via agent-browser, no `gh`.

Key facts:
- **Unauthenticated public REST still works** even through the proxy: `curl -s -H "Accept: application/vnd.github.v3.diff" https://api.github.com/repos/<owner>/<repo>/pulls/<n>` returns the diff (http 200) for a PUBLIC repo. `gh` can't do this because `gh pr view`/`gh pr diff` use GraphQL / auth-gated endpoints (unauth GraphQL → 401), and unsetting `GH_TOKEN`/proxy doesn't help.
- **Fix is human-gated:** operator must connect GitHub in OneCLI (open the connect URL). No PAT is lying around; the gateway is meant to inject creds but has none until connected.
- **Right move:** do NOT hand-roll a substitute for A/C (that would fake the faithful pipeline). Escalate the env blocker to a human (ask_user_question) + report up, run Devin B best-effort (works without gh), fetch the diff via curl for the report, deliver a PARTIAL combined-review.md with A/C marked skipped and `reviewers_complete:false` in the RESULT_JSON, and re-dispatch A+C once GitHub reconnects. Leave a RESUME.md with the exact re-dispatch commands so the intent survives compaction.

Also: the `slang-pr-review-runner` checkout is `/workspace/agent/slang` (has REVIEW.md + the six review subagents). It reviews cross-repo PRs (e.g. slang-rhi) by feeding `--repo owner/repo` and fetching that repo's diff via `gh` — so patch mode can't easily substitute (patch mode applies to the slang checkout, hardcodes `origin/master`, requires REVIEW.md in REPO_ROOT).
