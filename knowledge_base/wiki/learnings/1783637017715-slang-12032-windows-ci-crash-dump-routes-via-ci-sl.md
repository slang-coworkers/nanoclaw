---
title: "slang#12032 Windows CI crash-dump: routes via ci-slang-test.yml, not the Linux container path"
type: learning
topic: agent-ops
source: learnings/1783637017715-slang-12032-windows-ci-crash-dump-routes-via-ci-sl.md
---

# slang#12032 Windows CI crash-dump: routes via ci-slang-test.yml, not the Linux container path

Triaging #12032 (Windows counterpart to the #10812 Linux core-dump capture). Two non-obvious facts, verified @ HEAD 58d433809:

**1. CI dispatch graph.** Windows GPU test jobs (`test-windows-*-gpu`, `ci.yml:458-468`, `os: windows`, self-hosted `["Windows","self-hosted","GCP-T4"]`) run through the **shared reusable workflow `.github/workflows/ci-slang-test.yml`** — the os-agnostic one (linux/macos/windows all call it), NOT a Windows-specific file. It defaults to `shell: bash` (`:58-60`) and has **no** artifact-upload step. The Linux #10812 core-dump capture is in a **different** file, `ci-slang-test-container.yml` (`ulimit -c` @:117, "Capture core dump backtraces" `if: always()` @:198-238, upload @:243-250), because Linux GPU tests are *containerized* with a `/var/cores` bind-mount. Windows self-hosted runners aren't containerized → WER LocalDumps (registry) is the right mechanism, added Windows-guarded (`if: runner.os == 'Windows'`) to the shared reusable file so linux/macos jobs aren't touched. A WER-setup step must set `shell: pwsh` (overriding the bash default).

**2. Security design to preserve.** `ci-slang-test-container.yml:240-242` deliberately uploads ONLY gdb-symbolized backtraces, NEVER raw cores: "Raw cores contain full process memory which can include credentials or other sensitive in-memory state." The naive WER snippet in the issue uses `DumpType=2` (full dump) and uploads raw dumps — that regresses the Linux security posture. Correct: symbolize on-runner with `cdb` and upload only .txt (needs Debugging Tools + PDBs on the image), or `DumpType=1` mini + documented caveat. Also: `if: always()` + `if-no-files-found: ignore` (Linux pattern) beats `if: failure()` — it covers the "RPC-failure-only, exit code unknown" case AND uploads nothing on success.

**3. Routing.** Pure `.github/workflows/**` change → bot cannot land it (App token lacks `workflows` perm; category previously closed unmerged on policy, #11989→#12001). Sanctioned deliverable = validated `git apply`-able diff as an issue comment, never a PR. Flag before building.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783637017715-slang-12032-windows-ci-crash-dump-routes-via-ci-sl.md`_
