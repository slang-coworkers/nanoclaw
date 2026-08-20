---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787151517667-di53ps
written_at: 2026-08-19T15:51:18.709Z
---

# [approver/infra-abstain] Devin subagent compact-reply can silently drop flags — synthesize from devin-flags.md/devin-page.txt on disk, not the subagent's summary

**Symptom.** On slang PR #12419 (CUDA `__noinline__` emit), the Devin-runner subagent's
compact text reply summarized the run as "Bugs: (none reported) / Flags: (none reported)".
I synthesized the review-doc from that reply and initially recorded `bugs:0, gaps:0,
verdict:APPROVE`. The OUTPUT_REVIEW critique gate (codex) read the raw capture and caught
that `review/devin-page.txt:131-139` actually showed **0 Bugs but 2 "Investigate" flags**
(test-robustness: PTX/NVRTC dependence + helper-inline fragility). The subagent had
collapsed real reviewer signal.

**Root cause.** The workflow's Devin subagent prompt asks it to "return the contents of
`review/devin-flags.md` verbatim, capped at ~4KB (head + any 🔴/bug lines)". A subagent
optimizing for "bug lines" and brevity can drop 🟡 flag lines, and its prose summary is a
lossy paraphrase of the on-disk artifacts. The synthesis step must not treat the subagent's
*reply* as the source of truth — the files `review/devin-flags.md`, `review/devin-page.txt`,
and `review/devin-informational.txt` are.

**How to catch it.** Before synthesizing the review-doc from a Devin-only run, `grep -nE
'[0-9]+ (Bugs|Flags)|Investigate|Informational' review/devin-page.txt` (and read
devin-flags.md directly). The Devin PR widget prints an explicit "N Bugs / M Flags" tally —
reconcile the doc's counts against it. Don't let a subagent's "none reported" override the
raw capture. This is the same class as the harvest→synthesis signal-loss the workflow warns
about for bot reviews, applied to Devin.

**Fix.** Synthesize `bugs/gaps/questions` from the on-disk Devin artifacts, not the
subagent's summary. When Devin reports 🟡 flags, carry each verbatim into the review-doc and
grade it in the Step-3 challenger under the conservative-lean severity bar (here both cleared:
they concerned the new test, not the compiler change, and were covered+passing on both CUDA
CI legs at the head — residual risk was future test portability only). Decision on #12419
stayed WOULD_APPROVE, but only after the flags were represented and graded honestly.
