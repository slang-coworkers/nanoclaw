---
title: "[approver/challenger] Devin-only tier: reconcile a Devin 'Bug' by checking what the PR actually changed; sole-signal bug → ABSTAIN not BLOCK"
type: learning
topic: review-approval
source: learnings/1789064482299-approver-challenger-devin-only-tier-reconcile-a-de.md
---

# [approver/challenger] Devin-only tier: reconcile a Devin "Bug" by checking what the PR actually changed; sole-signal bug → ABSTAIN not BLOCK

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789063853356-hem5ut
written_at: 2026-09-10T18:21:22.299Z
---

# [approver/challenger] Devin-only tier: reconcile a Devin "Bug" by checking what the PR actually changed; sole-signal bug → ABSTAIN not BLOCK

## Symptom

On a Devin-only fallback tier (harvest exit 20 — a `fix/issue-N` fixer branch
that is also bot-authored, so production `github-actions[bot]` review genuinely
skips), Devin is the SOLE review signal. Devin's "Bugs" category is fuzzier than
a production 🔴: it lists candidate concerns, not verified PR-introduced bugs.
Example: shader-slang/slang#12970 (a warn-only PR adding diagnostic E00088
"module-format-not-frozen"), Devin flagged a Bug "rejected modules are still
written" anchored at `slang-end-to-end-request.cpp:1018`.

## Root cause

The line Devin anchored to (:1018) was inside the NEW comment block this PR
added, but the concern it described ("rejected modules are still written")
was about PRE-EXISTING serialization behavior of `maybeCreateContainer()` —
which serializes whatever IR exists once `writeContainerToStream()` succeeds.
The PR's only behavioral change was one informational
`getSink()->diagnose(ModuleFormatNotFrozen{})` gated on `m_isCommandLineCompile`;
it changes nothing about what is written or when. Devin anchored a design/
pre-existing observation to the diff region because that's where its attention
was, not because the diff introduced the behavior.

## How to catch it

For every Devin "Bug" on the Devin-only tier, read the anchored code AND the
actual diff, and ask: does the PR's change introduce or alter this behavior, or
is it pre-existing? A bug anchored to a comment line, or to code the diff only
adds an informational statement near, is a strong tell that it's pre-existing/
out-of-scope. Independent in-source checks (here: diagnostic code uniqueness,
gate liveness proven in BOTH directions by a positive control + a negative
control, message-vs-test-assertion match, ci_green) can all be clean while the
sole-signal bug flag remains unresolved.

## Fix (decision calibration)

Sole-signal (Devin-only) bug flag → the two non-approve states are the only
options: the skill forbids upgrading a doc's 🔴 to WOULD_APPROVE via
investigation. Choose between them by verification:
- BLOCK only if you VERIFY the bug is real AND PR-introduced.
- ABSTAIN_POLICY (reason CHALLENGER_CONCERN) when you cannot verify it as
  PR-introduced (reads as pre-existing/out-of-scope) yet cannot conclusively
  clear the fuzzy sole signal — a human adjudicates. This is a Policy-family
  reason (pipeline worked), NOT infra, so it does not count against the infra
  gate. It is also excluded from agreement scoring, so it never risks a
  false-block on a CI-green mergeable PR nor a false-safe.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789064482299-approver-challenger-devin-only-tier-reconcile-a-de.md`_
