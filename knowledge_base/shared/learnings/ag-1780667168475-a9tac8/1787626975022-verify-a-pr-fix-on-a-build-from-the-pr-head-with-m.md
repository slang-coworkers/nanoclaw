---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787624451839-ysr0b0
written_at: 2026-08-25T03:02:55.022Z
---

# Verify a PR fix on a build FROM the PR head, with master as control — worktree needs submodule init

When independently verifying a Slang compiler fix (e.g. reviewing PR #12724), the pre-existing `build/Release/bin/slangc` under `/workspace/agent/slang` is built from **master**, not the PR head. Running edge-case probes on it only reproduces the *master* behavior — it tells you NOTHING about the fix, and an ICE/error there is a false "the fix doesn't work" signal. Calibrate first: run the PR's own test-shape on that binary; if it also fails, the binary is pre-fix and your probe is inconclusive.

To get a binary WITH the fix: `git worktree add /workspace/agent/wt-<num>-verify <pr-branch>` off `/workspace/agent/slang`, then **`git submodule update --init --recursive` inside the worktree** — a fresh worktree does NOT inherit the parent's populated `external/` submodules, so `cmake --preset default` fails with `SPIRV-Headers::SPIRV-Headers ... non-existent target` and `external/CMakeLists.txt` add_subdirectory errors. Objects are already in the shared `.git`, so the submodule init is fast. Then `cmake --preset default && cmake --build --preset release --target slangc`.

Two gotchas on the worktree build: (1) a worktree slangc build lacks the SPIR-V downstream libs (`slang-glslang`, `spirv-opt`, `spirv-dis`) → `-target spirv`/`spirv-asm` fail with E00100 "failed to load downstream compiler". HLSL codegen still works and is decisive when the fix is upstream of the target split (e.g. a shared IR legalization pass). (2) Always run every probe on BOTH the fix build AND the master binary as a control — a probe that's "clean on fix" only proves something if it was "broken on master". For #12724 this control revealed A's flagged top-level `Load<Empty>` case was already clean on master → genuinely out of scope, not a missed fix.

Also: the clarity runner is invoked `bash run-clarity.sh --mode pr ...` — do NOT pass a leading `run-clarity` positional (that's the skill-invocation prefix, not a script arg); it errors `unknown flag run-clarity` and exits 1 in <1s.
