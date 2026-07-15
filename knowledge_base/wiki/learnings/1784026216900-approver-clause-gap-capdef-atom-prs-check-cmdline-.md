---
title: "[approver/clause-gap] capdef atom PRs: check-cmdline-ref (not just check-spirv-generated) fails if command-line-slangc-reference.md isn't regenerated"
type: learning
topic: slang-compiler
source: learnings/1784026216900-approver-clause-gap-capdef-atom-prs-check-cmdline-.md
---

# [approver/clause-gap] capdef atom PRs: check-cmdline-ref (not just check-spirv-generated) fails if command-line-slangc-reference.md isn't regenerated

**Symptom.** shader-slang/slang#12089 rev @ce42d01f added two capability atoms (`nvapi_hit_objects`, `cuda_glsl_nvapi_hit_objects`) and updated the human-facing `docs/user-guide/a4-02-reference-capability-atoms.md`, but CI's `check-cmdline-ref` job failed → combined status=failure → `ci_green_on_sha` clause FAIL → ABSTAIN_POLICY.

**Root cause.** Adding a capability atom changes `slangc -help-style markdown -h` output (the `-capability` option enumerates every atom). CI's `check-cmdline-ref` job (in ci.yml) regenerates `docs/command-line-slangc-reference.md` from that command and diffs byte-exact against the checked-in file. This is a SECOND generated doc, distinct from `a3-02/a4-02-reference-capability-atoms.md` — authors routinely update the a-XX reference (or it auto-regens) but forget `command-line-slangc-reference.md`. The failing job log names the fix: `slangc -help-style markdown -h > docs/command-line-slangc-reference.md` or comment `/regenerate-cmdline-ref` on the PR.

**How to catch it (challenger, any capdef/capability-atom PR).** Don't trust the combined-status API alone (that was the rev1 miss on the SAME PR). Independently query the real ci.yml check-runs and look specifically for `check-cmdline-ref` and `check-spirv-generated` failures:
`gh api "repos/{repo}/commits/{sha}/check-runs?per_page=100" --jq '.check_runs[]|select(.conclusion=="failure")|"\(.name) \(.html_url)"'`
Then read the failing job's log to confirm it's the generated-doc diff (PR-caused, trivial fix) vs a real logic failure:
`gh api "repos/{repo}/actions/jobs/{job_id}/logs"` and grep for `out of date|regenerate|diff`.

**Fix / disposition.** ABSTAIN_POLICY / CLAUSE_FAIL:ci_green_on_sha is correct — CI is genuinely red on a PR-caused failure. Even trivial-to-fix CI-red is not approvable; the human/author must regenerate + re-push. Generalizes [[approver/clause-gap]] (combined-status green ≠ real CI passed): the flip side is combined-status *red* correctly firing the clause once real CI runs. Companion signal on this PR: a verified 🔴 bug in the production review (SLANG_UNEXPECTED abort on a bare-hlsl_nvapi+pre-6.9 config) — see [[pr-12089-decided-rev-ce42d01f]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784026216900-approver-clause-gap-capdef-atom-prs-check-cmdline-.md`_
