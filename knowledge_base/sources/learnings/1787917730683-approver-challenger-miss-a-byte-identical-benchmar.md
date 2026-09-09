---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787141961922-ezvw6x
written_at: 2026-08-28T11:48:50.683Z
---

# [approver/challenger-miss] a byte-identical benchmark that never exercises the NEW branch carries zero bits about it

**Symptom:** On a "same result, faster path" refactor (slang#12616: two-pointer merge replacing HashSet+sort in the type-flow set-union), I cleared the "no regression test for the new interleaved multi×multi merge" gap as ADVISORY, arguing that Devin's n=800 byte-identical-output benchmark was a *differential test of the interleaved path*. The DECISION_REVIEW critique refuted it and I flipped to ABSTAIN_POLICY(OPEN_GAP).

**Root cause:** I let a strong-looking empirical result stand in for coverage of the specific new branch WITHOUT checking that the benchmark actually drives that branch. Devin's own prose said the workload "grows one element at a time" — i.e. the set accumulates by multi×SINGLETON merges (advance one pointer + tail-copy), which never exercises the alternating `getUniqueID(a)<getUniqueID(b)` interleave. Byte-identical output on inputs that don't hit the branch says nothing about the branch. This is the exact "could this observation have come out otherwise?" trap — and my own Step-0 recall had pre-registered it, yet I still walked in because "n=800, byte-identical" *feels* like overwhelming coverage.

**How to catch it:** For any "faster path, identical result" change, separate TWO questions: (1) is the new code correct by construction/proof? (2) is the NEW branch actually EXERCISED by the evidence you're leaning on? A perf benchmark optimized for size, not input shape, usually drives only the common (trivial-agreement) shape. Before crediting a byte-identity/CI-green as coverage of the novel branch, name the input shape that hits the branch and confirm a test or the benchmark produces it. If not, the branch is UNTESTED regardless of how big the green number is.

**Why it was OPEN_GAP not advisory:** the interleaved branch is reachable (`updateInfoForMerge` unions two possibly-multi-element sets at phi/return/field/multi-store merges — no singleton constraint), and its only release-build ordering guard is compiled out (`getSetFromSortedElements` ordering check is `#ifdef _DEBUG`; dup-freedom is adjacent-only) ⇒ a mis-ordered interleave silently breaks hash-cons identity in RELEASE. Reachable + silent-miscompile blast radius + no coverage ⇒ ABSTAIN, not the #12105 "test-gap-only, no silent-miscompile mode" advisory shape. **A coverage gap's severity depends on whether the untested path has a silent-failure mode with its guard compiled out — that distinction is what separates advisory from OPEN_GAP.**

**Bonus (harness):** my Devin subagent wrote `devin-flags.md` as "Flags: none" while the raw Devin page showed "0 Bugs · 2 Flags." Always cross-check a subagent's Bugs/Flags SUMMARY against the raw page's flag COUNT before synthesizing — a summarizer can silently drop the flags list.
