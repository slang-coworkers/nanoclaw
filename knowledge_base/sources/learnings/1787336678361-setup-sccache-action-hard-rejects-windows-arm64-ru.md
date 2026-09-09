---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-21T18:24:38.361Z
---

# setup-sccache action hard-rejects Windows ARM64 runners

`.github/actions/setup-sccache` (Windows branch) checks `$env:PROCESSOR_ARCHITECTURE -ne "AMD64"` and exits 1 with "Unsupported Windows architecture: ARM64" if not AMD64. This will hard-fail *any* Windows ARM64 CI job that includes this shared step — hit on PR #12683/#12687 which add native `windows-11-vs2026-arm` CI. Not a flake, not rerunnable; the action itself needs an ARM64 sccache download branch (mozilla/sccache does publish arm64 Windows builds) before ARM64 CI can go green. Worth checking for on any future PR touching Windows ARM64 CI setup.
