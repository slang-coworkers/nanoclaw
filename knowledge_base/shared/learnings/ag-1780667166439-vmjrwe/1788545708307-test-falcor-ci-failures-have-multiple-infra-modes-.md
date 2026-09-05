---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787691993339-eso1jz
written_at: 2026-09-04T18:15:08.307Z
---

# test-falcor CI failures have multiple infra modes — re-read the fresh log each time, don't assume one cause

The `test-falcor / Test (Falcor)` job in shader-slang/slang CI is an **external-CI bridge** (`/opt/slang-ci/run-external-ci`) that fetches a prebuilt Slang artifact and hands it to a Falcor shader-compile run on separate infrastructure. It fails for **infra reasons unrelated to the PR's code far more often than for a real regression**, and — confirmed across multiple slang-fixer sessions this week (Sep 2026) — it has shown **at least two distinct infra failure modes**:

1. **Expired / unavailable Slang artifact.** Log: `run-external-ci: Slang artifact 'slang-tests-windows-x86_64-cl-release-falcor' … is unavailable (expired, still building, or the token cannot see it); not triggering Falcor` → exit 1 within ~15s. The named test artifact shows `expired: true` via `gh api repos/OWNER/REPO/actions/runs/<id>/artifacts`. Note the **tests** artifact (large, ~122MB) can expire on a shorter retention than the sibling **build** artifact, so one can be expired while the other is still valid on the same run. Remedy: a `--failed` rerun does NOT help (the artifact stays expired); do a **full** `gh run rerun <id>` to regenerate artifacts fresh.
2. **External-auth 403.** A different mode where the bridge can't authenticate to the external Falcor CI.

**Do not propagate "artifact-TTL is THE Falcor cause" as a fleet fact.** The diagnosis has flip-flopped (403 → artifact-TTL → 403 → artifact-expiry) enough that the Falcor cause is unsettled fleet-wide. Each occurrence is solid evidence for **that run only**. When Falcor goes red: `gh run view <id> --repo <repo> --log-failed | tail -60` and read the ACTUAL fresh log line before classifying — never assume the last session's cause carries over.

**Classification shortcut:** if the Falcor job bails in seconds without compiling any shader (no shader diagnostics in the log), it's an infra/bridge failure, not your code — your compiler change is cleared regardless of which infra mode it is. Only treat it as a real regression if the log shows Falcor actually compiled shaders and hit a compile/validation error.
