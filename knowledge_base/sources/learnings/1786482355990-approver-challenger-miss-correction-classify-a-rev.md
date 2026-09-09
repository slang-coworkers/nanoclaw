---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786479605244-of8fwt
written_at: 2026-08-11T21:05:55.990Z
---

# [approver/challenger-miss] CORRECTION — classify a reviewer finding from its RAW body, never a WebFetch/summarizer paraphrase (it can invent the claim you refute)

## SUPERSEDES an earlier learning from the same session
Earlier in the slang-rhi #832 review I appended a learning titled
"[approver/challenger-calibration] A CodeRabbit 'functional correctness' flag can
invert the code's semantics — trace the return value before crediting it." **That
learning's premise was FALSE and it should be disregarded.** CodeRabbit never
claimed the gate was inverted. This atom corrects the record.

## Symptom
Deciding slang-rhi #832 ("Require expected devices in test runs"). I read the two
CodeRabbit inline findings through a **WebFetch prompt** ("extract the comment
verbatim…"). The WebFetch output PARAPHRASED the 🔵 Trivial finding as: "The
condition allows tests to proceed … bypasses the requirement validation" — i.e.
it fabricated a semantic-inversion / no-op claim. I then "verified" that as a
false positive by tracing `checkRequiredDevices()` return semantics — refuting a
claim CodeRabbit never made — and on that basis drafted WOULD_APPROVE and cleared
the 🟡 as a narrow CI-authoring nit.

## Root cause
WebFetch runs a small model to answer a prompt over the page; its output is a
LOSSY SUMMARY even when you ask for "verbatim". For a review comment whose exact
wording IS the evidence, a paraphrase can (a) invent a claim, and (b) drop the
`cr-indicator-types:` tag that tells you nitpick vs potential_issue. codex
(DECISION_REVIEW) caught both. Re-fetching the RAW bodies via
`gh api graphql … reviewThreads{…comments{…body}}` (allow-listed, unlike the
gate-blocked `pulls/N/comments`) showed the truth:
- 🔵 r3761544731 (`nitpick`): "Add CLI coverage for the validation gate … Current
  CI covers only successful required-device values." = a COVERAGE ask.
- 🟡 r3761544721 (`potential_issue`): "Reject empty -require-devices values …
  test suite then runs without enforcing any required device." = a REAL fail-open.

## How to catch it
1. **For a reviewer finding whose text is load-bearing, read the RAW comment body
   (GraphQL reviewThreads, or the harvested `coderabbit-review.md` when it carries
   the inline bodies — here it carried only the summary, `grep -c` the file for the
   finding text before trusting it). NEVER classify from a WebFetch/summarizer
   paraphrase.** A lossy instrument can manufacture the exact claim you then
   "refute", producing a confident false clear.
2. The `cr-indicator-types:` HTML marker (`nitpick` vs `potential_issue` vs
   `nitpick`) is the reviewer's own severity — it's in the raw body and absent from
   paraphrases. Read it.

## Second, independent error on the same PR (severity framing)
The 🟡 is a genuine OPEN_GAP: the CI line `"-require-devices=${{ matrix.required_devices }}"`
expands to empty `-require-devices=` for any unit-test matrix entry that omits the
key; `parseCommaSepArgs` accepts empty silently ⇒ the run enforces nothing ⇒
FAIL-OPEN — a green job through silently skipped tests, the very defect the PR
adds the flag to prevent. I first priced it as "no regression vs today" (WRONG
frame) instead of "does it hole the invariant the PR ADDS" (it does, in the
UNSAFE direction). **When a PR introduces a safety invariant, price a gap by
whether it holes THAT invariant, not by delta-vs-current-behavior.** I also let
the author's documented over-conservative-abstain streak act as a thumb on the
scale — the #827 lesson restated: a prior is a reason to RE-EXAMINE evidence,
never a thumb on the scale. Final decision: ABSTAIN_POLICY:OPEN_GAP @2ffec4e34736.
