---
name: feedback_a_search_query_is_not_the_link_graph
description: "My gate discovered linked PRs with search 'NNNN in:body' and found 1; the issue TIMELINE carried 2 — the missed PR's reference lived in a comment. A body-text query cannot see comment, commit-message, or branch links."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6814333a-3933-498e-a3fc-7ebf564c6556
---

# For "what PRs are linked to this issue", read the timeline, not a search query

**Measured 2026-08-09, shader-slang/slang#12443.** My resume gate discovered linked PRs with

```
gh api "search/issues?q=repo:$REPO+is:pr+$ISSUE+in:body"     # -> 12444        (1 PR)
gh api "repos/$REPO/issues/$ISSUE/timeline"  (cross-referenced)
                                                             # -> 12444, 12438 (2 PRs)
```

**#12438's reference to the issue lives in a PR *comment*, not the PR body**, so no body-text
query can ever see it. A commit-message link or a branch-name link is invisible the same way.
The search returned a true count about a population I had silently narrowed to "PRs that spell
the number in their description."

⭐⭐⭐ **The timeline is the surface GitHub itself uses to decide what is linked** — that is what
makes it the complete one. `cross-referenced` events carry `.source.issue`, with
`.pull_request != null` distinguishing PRs from issues and `.state` available inline.

## The second defect the first one hid

Filtering the timeline to **open** PRs is load-bearing, and I only noticed because #12438 forced
it. #12438 is **closed and unmerged** (superseded), yet it touches
`source/slang/slang-emit-c-like.cpp`, `slang-emit-spirv.cpp`, `slang-ir-string-hash.cpp`,
`tools/render-test/**` *and* `docs/generated/tests/_meta/expected-failures.txt`. My classifier
("any file outside `docs/generated/**` ⇒ candidate fix") would have called it a fix and closed
the chain on a PR that landed nothing. ⇒ **A file-set classifier is only valid on an open PR;
state has to be checked before the file test, not after.**

## Controls that matter here

```
#12367 -> 12378 open           positive: finds the known linked PR
#12371 -> 12382,12408 open     positive: finds TWO
#12092 -> NONE                 zero-case: clean empty, not an error
```

⚠️ **My first negative control was not one.** I picked sibling issue #12440 expecting zero and
got the *same two PRs* — because both genuinely cross-reference it (same generated-test batch).
A control that returns the expected-shaped answer for the wrong reason certifies nothing; I had
to hunt for a real zero-case (#12092). Cf.
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] on controls that pass by
luck.

## The qualifier the whole classifier rests on

`slang-triager` validated my rule and found the counterexample: keying on *"touches
`docs/generated/`"* instead of *"touches **only** `docs/generated/`"* misclassifies the real
fix. Verified instance `8ac9e49a5` ("Make vertex-shader-missing-sv-position pedantic and off by
default") touches `source/slang/slang-diagnostics.lua` + `slang-options.cpp` +
`slang-diagnostic-sink.h` + `tests/diagnostics/**` **and** one file under `docs/generated/` — a
genuine diagnostic change that regenerates docs alongside code, which is exactly the shape the
#12443 diagnostic fix will take. **A one-word omission inverts the verdict and the failure is
silent — the gate just stays armed forever.**

And a criterion I had listed first was useless: *"adds/keeps an expected-failures entry"*
**does not separate fix from suppression** — a real fix touches that file too, because it
*removes* the entry a suppression added. ⇒ **When a rule lists two criteria, check whether
either one alone gives the right answer; if not, say which one is primary and mark the other as
non-discriminating**, or a reader applies the first and gets it backwards.

⇒ **Ask what population your query defines, not just what it returns.** `in:body` was never
"linked PRs"; it was "PRs whose body text contains this string," and the gap between those two
is where the fix PR would have gone missing.
