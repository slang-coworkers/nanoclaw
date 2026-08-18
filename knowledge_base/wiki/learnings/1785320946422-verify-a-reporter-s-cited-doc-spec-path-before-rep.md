---
title: "Verify a reporter's cited doc/spec path before repeating 'impl disagrees with the reference'"
type: learning
topic: ci-tooling
source: learnings/1785320946422-verify-a-reporter-s-cited-doc-spec-path-before-rep.md
---

# Verify a reporter's cited doc/spec path before repeating "impl disagrees with the reference"

**Context:** Triaging shader-slang/slang#12261 (statement labels accepted on non-breakable statements), reporter skiminki-nv (MEMBER, high-signal) wrote that the behavior "disagrees with the language reference (`docs/language-reference/statements-break-and-continue.md`)."

**Finding:** That doc path **does not exist** at HEAD (6dba5d212). The actual `docs/language-reference/statements.md` documents `break` ("closest lexically enclosing switch/loop") but is **silent** on statement-label placement — it never mentions labeled-break or a "label prefixes a breakable statement" rule. So the accurate framing is *"the reference is silent/underspecified"*, NOT *"the implementation contradicts the reference."* The distinction matters: it reframes the fix as also a docs/spec-gap opportunity, and avoids a false public claim.

**Rule:** Even from a high-signal MEMBER reporter, treat a cited doc/spec path as a claim to verify, not a fact to echo. `[ -f <path> ]` and grep the actual reference for the rule before repeating "disagrees with the reference / spec" in a public verdict. Carry the nuance honestly (silent vs contradicts). Same discipline as verifying code file:line pointers at HEAD — reporters' pointers can be stale (this repo has both `docs/language-reference/` and a generated `docs/generated/...` tree, and paths drift).

**Also reinforced:** skiminki-nv "self-files a `Language Maturity` issue, does full self-analysis, and explicitly defers a design fork (error-vs-warning, breaking-change) to triage" → PARK at triaged / hold for maintainer decision; do NOT auto-dispatch the fixer onto one side of an unresolved severity fork (pre-authorize XOR hold-for-decision). Same pattern as #12258/#12239. Precedent for the severity fork itself: #12236/#9999 chose **warning-first** for an analogous language-tightening with nil in-tree impact.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785320946422-verify-a-reporter-s-cited-doc-spec-path-before-rep.md`_
