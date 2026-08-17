---
title: "Making a slang CI check 'required' = add a job to check-ci.needs, not branch-protection UI"
type: learning
topic: slang-compiler
source: learnings/1784430693229-making-a-slang-ci-check-required-add-a-job-to-chec.md
---

# Making a slang CI check "required" = add a job to check-ci.needs, not branch-protection UI

**Context:** triaging shader-slang/slang#12157 ("make the IR-instruction version-bump check a required status check"). Verified @ HEAD c6a261068.

**Key fact — the required-check funnel.** `ci.yml` registers exactly ONE aggregate job, `check-ci` (ci.yml:642-711, comment: "Aggregate gate required by branch protection / the merge queue"), in branch protection. Its `needs:` list (643-679) enumerates every build/test/lint job, and the step fails if any needed job != success — checking the generic `needs` JSON, so **"any job added to `needs` above is gated automatically."** Confirmed via DeepWiki. So to make a new PR check blocking/required, you DON'T touch branch-protection settings — you (1) write a `pull_request`-event job that `exit 1`s on violation, (2) add its name to `check-ci.needs`. Established precedents in the same file: `check-cmdline-ref` (ci.yml:523-560, exit 1 on diff) and `check-capability-atoms-ref` (566-609), both plain PR-event jobs wired into check-ci.needs (673-674).

**Combined with the durable workflows-permission wall:** nv-slang-bot lacks the GitHub `workflows` permission and cannot push `.github/workflows/*.yml`. So for any "make X a required check" task, the split is: the *script/tool* change (e.g. adding an `--enforce`/exit-1 mode to a checker under `extras/`) IS bot-committable, but the `ci.yml` job + `check-ci.needs` edit is NOT — it must be delivered as a maintainer-applied diff. Always put this in the triage `next-action`.

**Bonus — advisory-vs-enforcing gotcha for `check-inst-version-changes.sh`:** the "you forgot to bump k_maxSupportedModuleVersion" advisory (source/slang/slang-ir.h:2260-2261 constants) is only advisory because the script `exit 0`s on the needs-bump path (line 193, just a `::warning::`), AND its poster runs `on: workflow_run` (check-ir-version.yml) which reports no PR-head status. Flipping the *existing* "Check Version Constants" build step (ci-slang-build.yml:114-122) to fail is the WRONG fix: that step's artifact-upload has no `always()` guard, so a failing step would silently kill the advisory comment the task wants to keep. Prefer a dedicated cheap job.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784430693229-making-a-slang-ci-check-required-add-a-job-to-chec.md`_
