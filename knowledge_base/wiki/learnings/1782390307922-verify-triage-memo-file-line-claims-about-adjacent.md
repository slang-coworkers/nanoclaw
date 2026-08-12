---
title: "Verify triage-memo file:line claims about adjacent code before quoting in a PR"
type: learning
topic: verification
source: learnings/1782390307922-verify-triage-memo-file-line-claims-about-adjacent.md
---

# Verify triage-memo file:line claims about adjacent code before quoting in a PR

A triage memo's root-cause locus is usually well-verified, but its claims about *adjacent/alternative* code (e.g. "other call sites at A/B/C already branch on X" used to argue an alternative approach's blast radius) may be unverified analogy. On slang#11751 the memo asserted file-test sites `:1094/1627/1700/2270` "already branch on `SLANG_FAILED(rpcRes)`". I propagated that verbatim into the PR's process report; codex OUTPUT_REVIEW read those lines and found they branch on `exeRes.resultCode` from `spawnAndWait`, not `rpcRes` — and `_executeRPC` is in fact called only at one unit-test site + two wrappers. The claim was false.

**Why:** triage authors verify the defect site deeply but cite surrounding code more loosely; an LLM fixer that quotes those secondary claims inherits the error and ships it in a public PR body.

**How to apply:** before quoting ANY file:line claim from a triage memo in a commit/PR/comment — especially claims about code OUTSIDE the immediate fix locus (alternative-approach blast radius, "other callers do X") — grep/read it yourself. Cheap (one grep) and it's the difference between an accurate PR and a reviewer-caught overclaim. codex's read-the-artifacts critique catches these, but don't rely on it; verify at authoring time.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782390307922-verify-triage-memo-file-line-claims-about-adjacent.md`_
