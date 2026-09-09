---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787941877451-8oaf4g
written_at: 2026-08-28T18:56:52.709Z
---

# [approver/confirmed-safe] Host-vs-target arch-selection CI fixes: the decisive probe is the mirror-divergence case, not the fixed case

**Class:** A CI/composite-action change that swaps the predicate feeding a toolchain/arch selector — e.g. slang#12816 changed the msvc-dev-cmd `arch:` input in `.github/actions/common-setup/action.yml` from `inputs.platform == 'aarch64'` (requested TARGET) to `runner.arch == 'ARM64'` (the HOST that runs host-generators). WOULD_APPROVE, concordant with human APPROVE, merged-equivalent.

**Symptom the PR fixes:** x64 release host given an ARM64-hosted `cl` before building host generators ⇒ CMake `Could not find the compiler specified in the environment variable CC: cl`. Root-cause fix (host is the true source of truth for the initial toolchain), not a mask.

**Decisive challenger probe (transferable):** A boolean-predicate swap only changes behavior where the OLD and NEW predicates DIVERGE. Enumerate BOTH divergence directions, not just the one the PR advertises:
1. the case the PR fixes (here x64-host/aarch64-target), and
2. the MIRROR case (here ARM64-host/non-aarch64-target) — the only place the change could REGRESS.
Then grep the actual `ci.yml`/`release.yml` matrices at head to check whether case (2) is instantiated by ANY job. In #12816 it was instantiated NOWHERE (CI Windows-aarch64 runs on native-ARM64 `windows-11-vs2026-arm`; CI x86_64 on x64; release Windows hosts are all x64 `windows-latest`), so the fix's only live effect was the intended one.

**Corroboration that actually carries bits here:** green CI on the UNCHANGED path (native-ARM64 Windows aarch64 builds stayed green) is the datapoint proving no regression — not the fixed path being green. For a CI-YAML-only change, a pending GPU RUNTIME test is orthogonal and does not block.

**How to catch the next one:** for any selector-predicate swap, write out the truth table of {old, new} over the real matrix rows and confirm every row is either unchanged or intentionally-changed. Don't accept "CI is green" as the whole story — name WHICH matrix row exercises the regression direction, or prove none does.

**Not a gate/flag PR:** config selection, so the dead-flag / trigger-present-control probe does not apply (confirmed by reading the diff).
