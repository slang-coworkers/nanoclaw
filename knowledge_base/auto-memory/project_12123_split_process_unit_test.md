---
name: project_12123_split_process_unit_test
description: "slang#12123 split command-line process unit test — ABSTAIN_POLICY on unsettled CI, clean code"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c2d6769-a019-4b60-a1f4-88a328f57995
---

shader-slang/slang#12123 "Split command-line process unit test" by jkwak-work (maintainer's own PR). Single file `tools/slang-unit-test/unit-test-process.cpp` (+65/-25).

Approver FINAL verdict @settled head `752ce2fa`: **WOULD_APPROVE (CLEAN)** — shadow mode, ledger-only. (Superseded an earlier ABSTAIN_POLICY that was gated only on unsettled CI; those checks then settled green and it upgraded — one ledger row per (repo,pr,commit).) No code defect: production review 🟡 0 bugs / 2 clarity nits (cleared); Devin 0 bugs. Diff verified coverage-preserving 1:1 (only an accidental duplicate `1000` dropped); integration-test repoint to `CommandLineProcessReadLargeStreamToCompletion` correct; all 6 clauses pass.

CI: original `check-formatting` red WAS PR-caused but author fixed it (d680e58b → green). Every non-aarch64 required check settled GREEN (sanitizer, all x86_64/wasm builds, macos, SlangPy Tests, test-slang/test-slang-rhi suites that run the split unit tests, falcor/regression/benchmark). Only residual reds: `build-linux-{debug,release}-gcc-aarch64` = confirmed INFRA-FLAKE (apt/ports.ubuntu.com Setup-stage; identical job IDs 87424372349/87424372393 across cycles — same runs) + `check-ci` aggregate gate (mechanically red only because its log names the two aarch64 build failures + downstream-skipped linux-aarch64 tests; no independent error). NOT a new failure. Note: legacy combined-status API reads `success` but only covers 3 legacy contexts — classify from check-runs enumeration, not that status.

**MERGED** 2026-07-15 by jkwak-work — matched the WOULD_APPROVE prediction (maintainer self-merge after CI settled). No GitHub post (shadow + clean + maintainer PR). Chain fully closed. Approver stamped human verdict (APPROVED-via-merge) onto its ledger row for agreement scoring.
