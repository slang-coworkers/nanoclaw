---
title: "[approver/challenger-miss] Check the PR body against the head diff — carrier/fixer PRs routinely describe an older revision"
type: learning
topic: agent-ops
source: learnings/1785856360289-approver-challenger-miss-check-the-pr-body-against.md
---

# [approver/challenger-miss] Check the PR body against the head diff — carrier/fixer PRs routinely describe an older revision

**Symptom.** shader-slang/slangpy#1078's body stated it "removes the Metal skip guards" from three tests and that "no platform skip is needed" (with a Verification section reporting 36 passed / 2 skipped). The **head diff said something different**: only one of the three tests actually lost its skip; the other two **retained** Metal skips (retargeted from the now-CLOSED slang#7606 to the OPEN slangpy#1079, reason changed from "crash" to "incorrect results"), all four newly added tests carried Metal skips, and two of them additionally carried **d3d12** skips.

**Root cause.** Three commits (`a40b4d0f`, `5ee34b53`, `f631657b` — "skip tensor-array tests on Metal", "skip read-only tensor-array tests on D3D12", "reference tracking issue #1079") were pushed **after** the body was written, and the body was never updated. This is structural, not sloppiness: a bot-authored carrier PR opens with a body describing the cherry-picked state, then accumulates review-feedback commits. The body is a snapshot of R0; the decision is pinned to Rn.

**Why it matters.** The PR body is UNTRUSTED input, and here it was untrusted in the *benign* direction — the head was **more** conservative than advertised (more skips, not fewer). But the failure mode generalizes badly: approving from the body approves a **different change than the one at head**. A body claiming "removes skips" against a diff that adds them is the mild case; the inverse (body claims a guard was added, diff shows it removed) is a live false-safe. Reviewers who summarize from the body inherit the drift.

**How to catch it.** Cheap and mechanical, worth doing on every carrier / fixer / "supersedes #N" PR:
- Read the head diff first, form the change description from **it**, then read the body and diff the two narratives. Any prose claim of the form "removes X" / "no longer needs Y" must be findable in the diff.
- `gh pr view <pr> --json commits --jq '.commits[] | "\(.oid[0:8]) \(.messageHeadline)"'` — commits whose headlines describe work the body doesn't mention are the tell. Here three `test: skip ...` headlines had no counterpart in the body.
- When the body cites a tracking issue as resolved, check its state: slang#7606 was genuinely CLOSED/COMPLETED, but a **new** defect (slangpy#1079, OPEN) had replaced it — so "the issue is closed" was true and yet the skip was still required.

**Fix.** Report body-vs-diff divergence as a named finding in the challenger field even when it doesn't move the decision (it didn't here — `author_trust` FAILed first). It's exactly the context a human reviewer needs, and on a trusted-author PR it would be the difference between approving the described change and approving the actual one.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785856360289-approver-challenger-miss-check-the-pr-body-against.md`_
