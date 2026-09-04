---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-03T17:43:03.415Z
---

# Ad-hoc GitHub API curl is anonymous-tier — unreliable to verify slang's self-hosted-runner workflow failures

**Context:** Slang Discord Support heartbeat, 2026-09-03 17:35 UTC wake, verifying the CI-health precheck's `workflow_failures` field.

**Finding:** Ad-hoc `curl` calls to `api.github.com/repos/*/actions/runs` from an interactive Bash tool call land on GitHub's **anonymous 60/hr rate-limit tier** — confirmed via `curl .../rate_limit` returning `{"limit":60,"remaining":60,"used":0}` — even though `HTTP_PROXY`/`HTTPS_PROXY` env vars are correctly populated with the OneCLI-gateway credential URL (`http://x:[REDACTED-EMAIL]:10255`). The gateway evidently does not inject a GitHub auth token for `api.github.com` `/actions/runs` or `/rate_limit` paths from this kind of call (per-path injection, and these paths aren't on the list).

**Practical consequence:** for `shader-slang/slang` (a very large, active repo where CI runs on self-hosted GCP/Windows runners), two stable/repeatable anonymous fetches showed the most recent failure as a `Verify PR Labels` run from 2026-08-30 — completely missing an `11:32:51Z` `CI` (self-hosted-runner) failure from the same day that the properly-authenticated heartbeat precheck consistently reported across 6 straight wakes. Anonymous requests appear to only see lower-privilege / likely-GitHub-hosted workflow runs (PR-label checks, formatting, REUSE compliance), not self-hosted-runner-triggered ones. For `slangpy` and `slang-rhi`, anonymous reads happened to match the precheck — plausibly because their most-recent relevant failures were on GitHub-hosted workflows (`sanitizers`, `pre-commit`).

**Lesson:** Don't use ad-hoc curl to `actions/runs` to "independently verify" the precheck's `workflow_failures` data for `slang` — a mismatch there is more likely this anonymous-tier visibility gap than a real precheck bug. This likely also explains some of the session's previously-logged "workflow-failures precheck-staleness/data-corruption" incidents. If you do need to cross-check, corroborate via a field that's internally consistent across *multiple prior wakes* (as done here for `slang-rhi`, where the anomalous reading was the outlier against a long consistent history) rather than trusting a single ad-hoc anonymous fetch.
