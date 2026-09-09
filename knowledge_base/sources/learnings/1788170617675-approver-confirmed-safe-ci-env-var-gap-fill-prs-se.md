---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788165739295-8ry0mv
written_at: 2026-08-31T10:03:37.675Z
---

# [approver/confirmed-safe] CI env-var-gap-fill PRs (set an existing gated var in one more workflow) merge clean — positive-control + sibling-precedent is sufficient

**Outcome (calibration):** WOULD_APPROVE on slang#12811 was confirmed — the PR merged (by jvepsalainen-nv) at `054cfeff59347a743e6d5cc3e4a291fa3b8bfbc5`, the *exact* commit I decided on, with **zero follow-up commits** between my decision and the merged head. My read and the shipped change were identical. Human had also pre-approved (LGTM). No false-safe.

**The safe shape (transferable prior for Step-0 recall):** a PR that only *sets an already-existing, already-gated* env var / flag in one more CI workflow to close a known coverage gap — here `SLANG_DISABLE_AVX512: "1"` added to `nightly-slang-test.yml`'s agentic step to match `ci-slang-test.yml` / `ci-slang-sanitizer.yml` / `ci-slang-coverage-test.yml`. Characteristics that make this class low-risk:
- No new flag *and* no new gate → the standing "positive control required for every new flag" always-skip failure mode structurally cannot occur; do not demand a trigger-present control here.
- No C++/compiler source, no public-header/ABI surface; blast radius bounded to the one workflow; fully reversible (delete one line).
- On a bot-authored `fix/issue-N` branch, production claude-code-action genuinely skips review → harvest exit 20 → Devin-only tier is expected and correct, NOT an infra abstain.

**What investigation was sufficient (and confirmed adequate by the clean merge):**
1. **Positive control** — verify the edited step *actually exercises the gated path* so the var isn't a no-op. Here: the agentic step runs `slang-test -test-dir docs/generated/tests` with **no `-api`/target filter**, so `-cpu` variants route through the slang-llvm JIT (the code the env var gates). This is the one probe that carries real bits for this class.
2. **Gate semantics vs source** — confirm the var name and short-circuit (`disableAVX512ForJIT()` returns unless value is exactly `"1"`; `createSlangLLJIT()` calls it). Env-var names are a known hallucination surface; verify, don't recall.
3. **Sibling precedent** — the same mitigation already in N other workflows, applied without breakage, is strong evidence the change is behavior-preserving for these tests.

Deep diff-archaeology or frequency-figure verification ("2 of last 11 nightlies") was **not** needed and correctly not relied upon. The three probes above were necessary and sufficient; the clean merge-at-reviewed-commit validates that scope.
