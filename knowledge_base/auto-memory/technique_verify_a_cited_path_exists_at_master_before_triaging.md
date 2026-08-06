---
name: technique_verify_a_cited_path_exists_at_master_before_triaging
description: "OPEN BEFORE TRIAGING ANY ISSUE THAT CITES A FILE, TEST, SYMBOL, OR EXTERNAL REPRO/GIST: `git ls-tree` / `git grep` each cited path at origin/master with a non-zero control, and OPEN the external artifact rather than trusting the body's quotation of it. A bot- or self-filed issue is often written in the PRESENT TENSE about code on an unmerged branch; a human-filed feature request often quotes its own motivating artifact ASPIRATIONALLY — the body shows the API being requested where the real code has a workaround. Cheap check, relocates whole verdicts."
metadata:
  node_type: memory
  type: reference
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# A cited path is a claim about a tree — name the tree

**Open this when an issue body cites a test file, a helper name, or "the code now does X."**

## The command

```bash
git fetch -q origin master
git ls-tree -r --name-only origin/master -- tests/<dir>/ | grep -c '<test-stem>'   # per cited path
git grep -c '<symbol>' origin/master -- source/                                   # per cited symbol
git grep -c '<symbol-known-present>' origin/master -- source/<same-file>          # NON-ZERO CONTROL
```

The control is mandatory: a bare `0` from a mistyped path or a bad ref is indistinguishable from a
genuine absence. ⛔ **Also check the PR head** (`git fetch origin pull/<N>/head`) — confirming the thing
exists *there* turns "absent" into "absent from master, present on the draft," which is a far stronger
finding than a bare negative.

## Why it matters — measured, slang#12339 (08-05, slang-triager)

A **bot-filed** issue was written in the **present tense** about code living only on draft PR #12340:

| body claim | master | PR head |
|---|---|---|
| "Regression test exists and is disabled pending this work" | **absent** | present, 3086 B, `//DISABLE_TEST:` line 4 |
| "Regression test exists and pins the fallback" | **absent** | present, 3415 B, active `//TEST:SIMPLE` |
| `findIncludingNonIncludedSourceFile` | **0 hits** (control 7) | `slang-lower-to-ir.cpp:15468`, called `:15630` |
| symptom 4: "resolution **now** counts distinct includers" | no such logic — only a flat `!source->isIncludedFile()` gate | that unmerged helper |

⇒ **Three of the issue's four symptoms described an unmerged branch.** One symptom's stated outcome was a
property of an *intermediate, reverted* approach — not reproducible at master at all. **This relocated the
entire triage verdict** and prevented the obvious wrong next step ("the test exists, just enable it").

## Second case — the cited artifact never used the requested API (slang#6434, 08-05, slang-triager)

A **human-filed feature request** (`nthsetbit` intrinsic, filed 2025-02-24) linked a public gist as its
motivating real-world usage, and quoted four lines of it inline. The quote is line-for-line identical to
the gist **except the one line that matters**: the body shows `nthsetbit(mask, 0, n)` where the real code
calls a hand-rolled 32-iteration software `__fns(mask, n)` built on `firstbitlow`. **All 10 gist revisions
(2024-08-11 → 08-15) carry the software fallback; zero mention `nthsetbit`** — so the workaround *predates
the issue by ~6 months*. The body was written as a **wish**, not pasted.

⇒ This inverted the scrub's verdict: not "the requester's shipping code is broken by the gap" but
"the requester has been living with a working fallback for two years." Still valid — ergonomics and
performance (32 iterations vs one PTX instruction) — but **not a blocker**, which is what a
close/reassign/prioritize decision turns on. The requester also never commented on his own issue in
17 months while remaining active in the repo, which is consistent with the same reading.

⚠️ **Two nouns on the same artifact:** the gist's `updated_at` was 2026-06-30 while its newest content
revision `committed_at` was 2024-08-15. Metadata freshness is not content freshness — and confirm the
revision list is single-page (no `Link` header) before saying "all N revisions."

## Rules

- ⭐⭐⭐ **A file path in an issue body is a claim about a tree, and the tree is usually unstated.** The
  author's working copy, a PR head, and master are three different answers.
- ⭐⭐ **Be precise about which absence you found.** *"No such tests"* was accurate; *"no tests with that
  prefix"* was **false** — master has two sibling `debug-function-scope-*` tests from a merged predecessor.
  An over-broad negative is its own error.
- ⭐⭐ **Self-filed / bot-filed issues are the high-risk class**, because the filer wrote the body while
  holding the branch in their working tree, where every present-tense claim was true.
- ⭐⭐⭐ **An inline quotation of an external artifact is a claim about that artifact — open the artifact.**
  Two distinct drifts, both invisible if you read only the body: the tree drifted out from under the
  citation (#12339), or **the citation was aspirational from the start** (#6434). A near-verbatim quote
  is the dangerous shape: it reads as pasted evidence, so the one edited line gets no scrutiny.
- ⭐⭐ **On a feature request, "is the requester blocked?" is a separate question from "is the gap real?"**
  Both can be yes-and-no independently, and the *priority/close* decision keys on the first. The body's
  motivating example is evidence about the second only.
- ⭐ **Freshness-check the binary too** if you run probes: confirm the build postdates a known commit by a
  behavioural test, and confirm any commits since touch **0** files under `source/`|`include/`|`prelude/`
  (with a non-zero total as control).

Related: [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] (the non-zero-control
family), [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] (another tree-identity trap).
