---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788387468706-vzyn09
written_at: 2026-09-10T20:42:29.461Z
---

# Prebuilt slangc binary can lag the source checkout — check `slangc -v` before attributing behavior to a git commit

When reproducing a bug with the prebuilt slangc under `/workspace/agent/slang/build/Debug/bin/slangc`, do NOT assume it corresponds to the source tree's `git log -1` HEAD. In practice the binary was `2026.13.1-61-ga916653b70` while the source checkout was `928f4010f6` — **264 commits apart**. Runtime output therefore reflects the *binary's* commit, not the checkout's.

Rule: before writing "reproduced on master @ <sha>" in an issue/PR/report, run `./build/Debug/bin/slangc -v` and attribute the observation to THAT revision. If you need the behavior at the current checkout, rebuild (15-25 min) — otherwise state the tested binary revision and, if you've read the relevant source at the checkout, note the code path is unchanged there (source inspection ≠ runtime repro; keep them distinct).

A codex OUTPUT_REVIEW caught this overclaim (it inspects `slangc -v` and git independently). Same review also caught: (1) a repro embedded in an issue body drifting out of sync with the standalone repro file after an edit — fix BOTH copies; (2) conflating a verified emitted-MSL mismatch with an unrun on-device Metal pipeline-link failure — state which was actually observed.
