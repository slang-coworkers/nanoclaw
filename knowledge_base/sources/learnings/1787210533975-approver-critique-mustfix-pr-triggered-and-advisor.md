---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787208113173-doxczh
written_at: 2026-08-20T07:22:13.975Z
---

# [approver/critique-mustfix] "PR-triggered" and "advisory nit" are two claims to verify at the source, not assert — slangpy#1119

## Context
shader-slang/slangpy#1119 "Thread sanitizer" (skallweitNV, MEMBER). Adds `SGL_ENABLE_TSAN` +
new `tsan` jobs in `.github/workflows/sanitizers.yml` + libdeflate vcpkg overlay + LLVM 22
download. Fallback tier (no primary Claude review; CodeRabbit 1 actionable + Devin clean).
Final decision ABSTAIN_POLICY:OPEN_GAP — but only after the DECISION_REVIEW critique gate caught
TWO errors in my WOULD_APPROVE draft. Both are recurring, both are cheap to prevent.

## Error 1 — I asserted "the flag has a setter in a PR-triggered job" without reading `on:`
`sanitizers.yml` `on:` = `schedule` (cron) + `workflow_dispatch` ONLY. No `pull_request`. The
green tsan run on the head (run 32156153681) was `event=workflow_dispatch` — manually dispatched
on the branch. I wrote "PR-triggered positive control satisfied" and even added "Distinct from
slangpy#925 (workflow_dispatch-only)" — i.e. I named the exact prior this PR matched and then
claimed the opposite. **A green sanitizer/CI lane proves the flag FIRES and the path works AT THAT
HEAD; it says NOTHING about whether PRs auto-exercise it. Those are two separate facts and each
has its own source.** Read the workflow's `on:` block AND the run's `event` field
(`gh api .../actions/runs/<id> --jq .event`) before writing "PR-triggered" — never infer trigger
from "the job ran green." (This is my Core Memory "write the role where the operation happens":
a green check-run carries its result, not its trigger.)

## Error 2 — I downgraded a bot's merge-gating finding to a "nit" by appeal to convention
CodeRabbit's ONE actionable finding said verbatim (coderabbit-review.md): "Pinning the action,
verifying the archive checksum, and disabling unnecessary credentials are **required before merge
or need explicit security-owner acceptance**." I labeled all three "advisory CI-hygiene nits"
because the checkout/get-cmake patterns matched the pre-existing repo convention. The convention
defense was valid for 2 of 3 items — but NOT for the genuinely-new unverified-LLVM-archive
download, and "matches convention" never converts a bot's *stated* merge-gating verdict into a
nit. **When a review source labels a finding blocking/required-before-merge, that IS the parsed
verdict (REQUEST_CHANGES), even if you'd personally rate it low — parse it, don't reinterpret it
(skill Step 2). Reserve your judgement for Step-3 severity, and there uncertainty abstains.**

## How to catch it
- Before writing "PR-triggered"/"PR CI"/"automatic coverage": read the workflow `on:` triggers
  and the run's `event`. schedule/workflow_dispatch-only ⇒ say "fired at head via dispatch, not
  automatic PR coverage."
- Before writing "nit"/"advisory" about a bot finding: quote the bot's own severity/merge
  language. "required before merge", "blocking", 🟠/🔴 Major ⇒ it is a gap, map to
  REQUEST_CHANGES; your convention/low-risk argument belongs in Step-3 severity, not in
  re-labeling the parsed verdict.
- Both errors are the one-directional-toward-approve drift my Core Memory warns about — I caught
  neither myself; the codex DECISION_REVIEW gate caught both. The gate earns its cost on
  approve-leaning decisions; do not skip or rush it.

## Outcome
Final: ABSTAIN_POLICY:OPEN_GAP (correct per codex both rounds). Not BLOCK (no verified 🔴 bug).
Fix = re-read source for each claim; the decision state was right, the derivation prose was not.
