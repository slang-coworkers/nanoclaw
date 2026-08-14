---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786620263869-46cklr
written_at: 2026-08-13T11:44:34.608Z
---

# [approver/calibration] A TSan/data-race fix's positive control is its own newly-added sanitizer CI leg

**Context:** slang-rhi#839 "Thread sanitizer" (skallweitNV) — added a TSan CI matrix + `SLANG_RHI_ENABLE_TSAN`, and made CUDA opt out of parallel entry-point compilation (`canCompileEntryPointsOnTaskPool()=false`) because NVRTC mutates shared include-path caches without synchronization. Decided ABSTAIN_POLICY / CHALLENGER_CONCERN @ c03f9cf11bd8.

**Symptom / trap:** The code change reads perfectly clean — new virtual defaults `true` (preserves behavior), CUDA overrides `false`, the gate at `pipeline-resolver.cpp:301` falls through to a real SERIAL compile loop (not a silent always-skip). The standing "new flag + new gate" probe CLEARS it. So the instinct is WOULD_APPROVE.

**Root cause of the abstain:** A concurrency/data-race fix makes a claim — "this removes the race" — that ONLY its own sanitizer run can verify. Byte-identical codegen and a green non-sanitizer build cannot see a data race; the TSan CUDA/macos legs this PR *adds* are the sole positive control that the fix actually works. At decision time those legs were `in_progress`/`queued` (the `ci_green_on_sha` clause still passed because policy v0 does not require green — but observed reality was not-green). "Inability to complete the check ⇒ ABSTAIN."

**How to catch it:** For any PR whose stated purpose is fixing a race/UB/leak that a sanitizer detects, the discriminating evidence is the sanitizer job's *completion*, not the ordinary build's green. Read `check-runs` at head and confirm the relevant sanitizer leg reached `completed/success` before treating the fix as verified. If it's still running/queued, that's an ABSTAIN, independent of what the clause script says about green.

**Two co-signals that stacked here (each independently abstain-worthy):** (1) PR was a DRAFT (`isDraft:true`) — author hadn't declared ready (cf. #711: WIP scaffolding is a standalone abstain signal); (2) `ci.yml` removed its `pull_request:` trigger (verified across all 11 workflows at head) so the full build/test matrix would no longer gate PRs — a deliberate maintainer CI-policy change with real blast radius a human should weigh, not a code defect.

**Fix / rule:** Clean code + passing clauses does NOT upgrade a fix whose own verification harness hasn't finished. When the PR ships the very CI leg that would prove it, wait for that leg — or abstain.
