---
type: decision
title: test-falcor reruns under babysitter gate 0d
description: test-falcor rerun rules under babysitter gate 0d — bridge "relay error" gets one rerun (infra); pipeline "failed" stays no-rerun; one-off #13880 rerun for #13725-window reds; #13697 declined. 0d's "rerun can't change outcome" rationale is false (#13886).
tags: [slang, ci, falcor, ci-babysitter, decision]
---

# test-falcor reruns under gate 0d

**Gate 0d** in the babysitter's sweep prompt (task `task-1776715487702-ftr4s6`, which the babysitter group owns) defers every bridge-poller-shaped `test-falcor` red as `unclassifiable`, with no rerun. The reason it gives is that "rerunning cannot change an external GitLab pipeline's outcome".

- **That reason is false.** #13886's `test-falcor` job 120443897612 was rerun at 10-23 13:35Z, after the 02:44Z gate, and passed at 14:22Z. A rerun submits a new GitLab pipeline.
- **slang#13725** (Falcor failing broadly on unrelated PRs) was first seen 10-16 18:02Z and closed COMPLETED 10-26 18:12Z.
- **10-27 06:1xZ decision (Main, on the babysitter's question in msg 184):** a one-off `--job` rerun for #13880 (job 120498672351, bot PR) and #13487 (job 117217681041, pdeayton-nv). Both have `check-ci` SUCCESS with `test-falcor` as their only red, and both reds fall inside the #13725 window. If either fails again, log it `unclassifiable`, don't rerun again, and report it as possibly real. 0d itself was not lifted, and I did not edit the babysitter's prompt, because that is another group's config and the operator hadn't asked.
- **Open:** whether to correct 0d's reason in the prompt. That is the operator's call; I haven't asked yet.

## Outcome, 10-27 06:13Z
- **#13880:** the `--job` rerun (run 39960878492, attempt 3) failed in 19 s at `Run external CI`, because the run's `slang-tests-windows-x86_64-cl-release-falcor` artifact was gone and no pipeline was triggered. **So the real limit is this: a test-falcor-only rerun works only while the run's `slang-tests-*` artifact still exists, about a day.** After that, rerun the upstream `build-windows-release-cl-x86_64-gpu-falcor / build` job, which re-uploads the artifact and re-runs test-falcor with it.
- **#13487:** GitHub returned 403 "Jobs in this workflow run cannot be re-run" (run 38936803952). It needs an author push.
- **06:1xZ:** Main approved one `--job` rerun of #13880's build job 122040695046 (one Windows build plus one Falcor pipeline), because #13880 is our own unreviewed bot PR whose only red is test-falcor.

## 10-28: #13697 declined
The babysitter asked for the same one-off rerun on #13697 (albertrodriguezclo, SPIR-V `SPV_EXT_shader_subgroup_partitioned`). I declined. It failed `test-falcor` on 2 consecutive attempts **after** #13725 closed, while Falcor passed on other PRs then (#13898 04:54Z), and the PR changes SPIR-V extension declarations. So it is likely real. I escalated to the operator as needing GitLab access to read pipeline 77209672. ⇒ **The #13880 exception covers reds inside an outage window only. A red that recurs on consecutive attempts outside that window is evidence, so don't rerun it.**

## 10-28 20:0xZ: standing rule split by signature (Main → babysitter, msg 273)
- **Bridge `relay error`** in the stub log (an infra signature we can see): one `test-falcor` `--job` rerun is allowed, after the run is terminal and while the `slang-tests-*` artifact exists; otherwise rerun the falcor build job. Normal caps apply. First case: #13945 (job 123031508685).
- **Pipeline `failed`** (opaque): stays under 0d, with no rerun. Two consecutive failures outside an outage window count as likely PR-owned (#13697).
- A second `relay error` on the rerun, or on another unrelated PR, means no further reruns; report it as a possible #13725 recurrence.
