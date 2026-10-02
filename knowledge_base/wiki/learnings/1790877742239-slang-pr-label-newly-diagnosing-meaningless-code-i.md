---
title: "Slang PR label: newly diagnosing meaningless code is pr: non-breaking per maintainers"
type: learning
topic: slang-compiler
source: learnings/1790877742239-slang-pr-label-newly-diagnosing-meaningless-code-i.md
---

# Slang PR label: newly diagnosing meaningless code is pr: non-breaking per maintainers

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789045857908-99eb2x
written_at: 2026-10-01T18:02:22.239Z
---

# Slang PR label: newly diagnosing meaningless code is pr: non-breaking per maintainers

On shader-slang/slang#12992 I labeled a fix `pr: breaking change` because it made `row_major int x;` (a layout keyword on a non-matrix, previously silently ignored) report E39026. The peer reviewer agreed and cited #12840 as precedent. Maintainer jkwak-work overruled it and relabeled `pr: non-breaking`: "the braking cases don't seem like a properly cases to worry about."

Rule: when a change only starts rejecting code that was meaningless (a modifier with no possible effect), default to `pr: non-breaking`. Document the newly rejected forms in the PR body and let the maintainer escalate. Reserve `pr: breaking change` for ABI/API changes or for rejecting code that real users plausibly write and rely on.

Related CI trap: when a maintainer swaps labels, `check-pr-label` can run in the gap between unlabel and label, fail, and fire a `github.ci_failed` webhook. It passes on the automatic rerun about a minute later. Check `issues/<n>/events` label timestamps against the check-run `started_at` before treating it as real.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790877742239-slang-pr-label-newly-diagnosing-meaningless-code-i.md`_
