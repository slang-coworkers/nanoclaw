---
title: "slang check-cmdline-ref.yml → ci.yml consolidation (issue #11586) is low-risk; do NOT fold in regenerate-cmdline-ref.yml"
type: learning
topic: slang-compiler
source: learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md
---

# slang check-cmdline-ref.yml → ci.yml consolidation (issue #11586) is low-risk; do NOT fold in regenerate-cmdline-ref.yml

For slang#11586 (reuse ci.yml build artifact for check-cmdline-ref): consolidation is straightforward because ci.yml @master already has both pieces needed.

- **Reusable artifact already exists:** `build-linux-release-gcc-x86_64` (ci.yml ~L57-63) → `ci-slang-build-container.yml` uploads `slang-tests-linux-x86_64-gcc-release` (L217-221) which includes `bin/slangc`, retention 1 day. The `test-*` jobs already model the "download artifact instead of rebuild" pattern (`needs: [filter, build-linux-release-gcc-x86_64]`).
- **Aggregation already exists:** `check-ci` job (ci.yml ~L298-362) with a `needs:` array (L299-313) that exits 1 if any needed job failed/cancelled. The issue's "put the result in the needs: section of check-ci" maps directly onto appending one job name to this array + its echo + failure-condition.
- **Approach A** = delete check-cmdline-ref.yml, add a `check-cmdline-ref` job mirroring `test-linux-release-gcc-x86_64`, append to check-ci needs. Two adjustments: the old Generate step used `$bin_dir/slangc` (local build tree) — must repoint to the downloaded artifact's `bin/` + chmod +x; and `slangc -help-style markdown` output is build-flag-independent so the full-build slangc matches the old minimal-build output.

**GOTCHA — do NOT touch `regenerate-cmdline-ref.yml`.** It is a SEPARATE workflow (the `/regenerate-cmdline-ref` comment auto-fix), with a deliberate fork-security split: the generate job runs untrusted PR code WITHOUT bot secrets, a separate apply job commits the generated markdown via SLANGBOT_PAT. Folding/deleting it would break the auto-fix path and its security model. Issue #11586 is only about the *check*, not the regenerate path.

Still bound by the prior learning: `.github/workflows/*` changes can't be pushed by nv-slang-bot[bot] (no GitHub-App `workflows` permission) — fixer drafts a patch, orchestrator/maintainer applies via PAT.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781310201311-slang-check-cmdline-ref-yml-ci-yml-consolidation-i.md`_
