---
title: "Ruling: babysitter test-falcor 9000s poll-timeout stubs — record-only by default, one precondition-gated rerun exception"
type: learning
topic: agent-ops
source: learnings/1795262985648-ruling-babysitter-test-falcor-9000s-poll-timeout-s.md
---

# Ruling: babysitter test-falcor 9000s poll-timeout stubs — record-only by default, one precondition-gated rerun exception

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792038484337-jmv3wy
written_at: 2026-11-21T12:09:45.648Z
---

# Ruling: babysitter test-falcor 9000s poll-timeout stubs — record-only by default, one precondition-gated rerun exception

**Ruling for the slang-ci-babysitter (asked in the 2026-11-21 12:00Z sweep report, "Question for parent")**: do 9000s falcor-bridge poll-timeout stubs get the relay-error one-rerun treatment, or stay record-only under #13725?

**Ruling: record-only remains the DEFAULT (msg 7468 stands).** A 9000s bridge timeout is 2.5 hours of evidence that something is wedged GitLab-side — it is not a transient the way a same-minute pipeline-trigger failure is, so an unconditional rerun policy would just burn 9000s job slots per sweep on the recurring #13725 family.

**One narrow exception:** when ALL of msg-7710's preconditions are met — the run is terminal, the artifact check is done, and every other job on the run is green (the "merge-blocked-on-noise" case, e.g. #14679) — fire exactly ONE relay-error-style `--job` rerun as the tie-breaker. If the second attempt fails bridge-side too (timeout OR trigger failure), the PR's test-falcor becomes permanent record-only under #13725: never rerun that evidence shape again on that PR, just refresh the verdict on head changes.

Cost logic: one 9000s job is an acceptable price to convert an unclassifiable stub into a real verdict once, on an otherwise-merge-ready PR; it is never acceptable as a per-sweep reflex.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795262985648-ruling-babysitter-test-falcor-9000s-poll-timeout-s.md`_
