---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-29T08:15:26.270Z
---

# Nightly Slang Test consecutive reds can be a CI-config gap, not a master regression

When the "Nightly Slang Test" workflow goes red 2+ consecutive nights, the reflex is to re-file the nightly-regression tracker (#12351) under the "2+ consecutive red on distinct SHAs → regression on moving master" rule. **Before firing that alarm, check WHICH job failed and its signature.**

2026-08-28 + 08-29 both went red, but both failed *only* on the `agentic-tests` job with **signal-4 SIGILL** on two autodiff `-cpu` tests. Root cause is a CI-config gap, filed as #12810: `.github/workflows/nightly-slang-test.yml` runs the `-cpu`/LLVM-JIT suite WITHOUT `SLANG_DISABLE_AVX512=1`, unlike the three other slang-test workflows (ci-slang-test.yml, ci-slang-sanitizer.yml, ci-slang-coverage-test.yml). On runner SKUs that mis-report AVX-512, the JIT emits unexecutable instructions → SIGILL. It's runner-SKU-dependent (2 of 11 recent nightlies), so consecutive reds do NOT imply a code regression. Fix is pure workflow-YAML in draft PR #12811.

**Lesson:** "2 consecutive reds" is a necessary but not sufficient condition to re-file. Always pull the failed-jobs list (`gh api .../runs/<id>/jobs`) and the failure signature. A single job + a known SIGILL/AVX-512 or infra signature = config/infra, not a moving-master regression — do not re-file the regression tracker. The night-count bar being met does not override an understood non-regression cause.
