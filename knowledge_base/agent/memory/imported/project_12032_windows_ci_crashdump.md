---
name: project_12032_windows_ci_crashdump
description: "#12032 Windows CI crash-dump capture — RESOLVED, advisory diff posted; awaiting maintainer apply"
metadata: 
  node_type: memory
  type: project
  originSessionId: 72771520-2e19-474f-a407-c22fb0d8e908
---

**#12032** (shader-slang/slang) — Add Windows CI crash-dump capture for test-server/slang-test failures. Author jhelferty-nv (maintainer). P2, CI-enhancement, Component: CI. Windows counterpart to Linux #10812; blocks root-cause of #11951 (Windows GPU flake) / #11955 (Linux CPU SIGSEGV).

**Path:** PURE `.github/workflows/**` change → bot CANNOT PR (App lacks `workflows` perm + jkwak-work closed same-category #11989→#12001 on policy). Sanctioned deliverable = `git apply`-able unified diff posted as ONE issue comment for maintainer to apply. No branch/PR/push. See [[project_bot_workflows_permission]].

**Fix = Approach A refined** (in `ci-slang-test.yml`, NOT the container file):
- Windows-guarded steps (`if: runner.os=='Windows'`); os-agnostic file, must not touch linux/macos.
- WER LocalDumps setup `shell: pwsh` before "Test Slang" (~:74); capture+upload after test steps (~:201), mirror container:243-250.
- Upload `if: always()` + `if-no-files-found: ignore` + `retention-days: 7` (satisfies criteria 2 RPC-only + 3 no-artifact-on-success).
- **SECURITY (load-bearing):** author snippet's DumpType=2 = FULL dump; uploading raw regresses vs Linux (symbolized-backtrace-only, cores leak creds). Default DumpType=1 mini + caveat; document cdb-symbolize .txt (needs Debugging Tools + PDBs on runner) as Linux-parity upgrade.
- Flag HKCU-vs-HKLM (self-hosted service account).
- Validate: `prettier --check` + `git apply --check` vs pristine base before posting.

**State (07-09 23:10Z) — ✅ RESOLVED, advisory diff delivered:** Triage verdict https://github.com/shader-slang/slang/issues/12032#issuecomment-4930205762 + advisory diff https://github.com/shader-slang/slang/issues/12032#issuecomment-4930289060 (nv-slang-bot, base 58d4338091 = triage HEAD; 3 Windows-guarded steps Setup/Capture/Upload). Validated: prettier --check clean + git apply --check exit 0 vs pristine + codex-critique all-green (4 rounds). Uses DumpType=1 mini + cdb-symbolize-drop-raw, upload if:always()+if-no-files-found:ignore+retention 7. HKCU-vs-HKLM caveat flagged in-comment. **Next human action:** maintainer/local-agent applies diff to ci-slang-test.yml (bot can't land workflow files). Cosmetic nit: comment prose says "two steps" but diff correctly has three; bot 403s on PATCH/DELETE so left as-is (ONE-comment hygiene). Chain CLOSED on triager side; re-opens only on substantive human comment. Thread: gh-issue-shader-slang/slang-12032.
