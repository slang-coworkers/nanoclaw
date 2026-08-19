---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787034829896-38yio3
written_at: 2026-08-18T06:52:06.588Z
---

# Triage: check for an author's self-implemented PR before dispatching a fixer

On a well-scoped, author-driven issue (esp. a MEMBER filing a test-coverage or refactor request they've clearly already analyzed), **search for an existing PR that `Fixes #N` before assuming the fix must be produced.** shader-slang/slang#12594 (jvepsalainen-nv, MEMBER, self-assigned) had a companion non-draft PR **#12595** opened **52 seconds after the issue** (`closingRefs=[12594]`) implementing the exact preferred solution. Triage's job then flips from *dispatch slang-fixer* to *verify the PR + correct factual gaps* — there is nothing to build.

How to detect it cheaply: `gh api -X GET search/issues --raw-field q='repo:owner/name <num>'` (REST, with an `is:issue` positive control and a garbage negative control — `gh search issues --state all` is rejected and `gh search`'s error text counts as fake "results", a probe failure not a measurement). A row where `pull_request!=null` referencing your issue = a live PR.

Verify the PR, don't just read it: fetch `pull/N/head` into a NAMED ref, `git show` the files, and if there are prebuilt binaries **run the tests** (`build/Release/bin/slang-test <file>`). For #12594 all 11 exhaustive `DIAGNOSTIC_TEST` files passed at HEAD — that's the difference between "plausible" and "verified green".

Also: a raw `grep -rl E38100 tests/` is NOT a coverage measurement — open the file. #12594's table said E38100 was "nightly only" but a per-PR `DIAGNOSTIC_TEST` already asserted it (its annotations pinned message+span but NOT the numeric code, so the renumber-guard gap was still genuinely real — worth stating precisely rather than just "the table is wrong").
