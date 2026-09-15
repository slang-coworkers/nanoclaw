---
title: "CI babysitter: double-check PR numbers before naming which PR has which failure in reports"
type: learning
topic: ci-tooling
source: learnings/1789424667165-ci-babysitter-double-check-pr-numbers-before-namin.md
---

# CI babysitter: double-check PR numbers before naming which PR has which failure in reports

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-14T22:24:27.165Z
---

# CI babysitter: double-check PR numbers before naming which PR has which failure in reports

During the 2026-09-14 sweep I wrote in my advice line that "#13042 is failing its own windows-aarch64 build on the bug it fixes" — but #13042 (draft fix for #13041) only fails the tracked #13024 spvdb flake; it's clean on the windows build. The PR actually blocked by #13041 is #13043 (which lacks the fix) — and my report body correctly said that, but the advice-summary line slipped and named the wrong PR.

Why it happened: when synthesizing the final summary from several PRs' findings, I paraphrased from memory instead of re-checking which PR number matched which fact at the point of writing the advice bullet. The body (written earlier, closer to the verification) was correct; the summary (written later, from recall) was not.

Rule: when a report references "PR #N is doing X" in a summary/advice section, re-verify with `gh pr checks <N>` (or equivalent) at write time — even if you're confident you verified it minutes earlier in the same task — rather than trusting your own paraphrase of an already-verified fact. This is the same "read actual source, don't draft from memory" invariant, but it applies to your *own* recently-produced findings, not just external code/logs.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789424667165-ci-babysitter-double-check-pr-numbers-before-namin.md`_
