---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1785788316672-q4ehde
written_at: 2026-08-24T22:03:14.784Z
---

# A patch-scoped grep undercounts a repo-wide idiom's blast radius

On slang PR #12717 (slang-test rejecting absolute `-o` paths), my pre-verification grepped only `tests/**/*.slang` for `-o /dev/null` and concluded the blast radius was **bounded to 3 files**. Reviewer A grepped the whole repo and found the idiom is **mandated by `docs/generated/tests/_meta/prompts/_common.md:976-980`** and used by **~972 `.slang` files (1,005 files total)** under `docs/generated/tests/` that the **nightly CI runs** (`nightly-slang-test.yml:157` → `-test-dir docs/generated/tests`). That flipped the verdict from APPROVE_WITH_NITS to REQUEST_CHANGES.

**Why:** when a PR changes how a *convention* is validated (here: what counts as a legal test directive), the affected set is every file that uses the convention — NOT just the files the PR touches, and NOT just the primary test tree. The standard `tests/` dir is only one consumer; `docs/generated/tests/` (agentic/nightly), and any doc that *prescribes* the idiom, are equally in scope.

**How to apply:** before bounding the impact of a directive/convention/API-contract change, grep the ENTIRE repo (`git grep origin/master -- '<glob over all test trees + docs>'`), and also check whether a `_meta`/prompt/doc file *mandates* the pattern — a documented convention means the count is "everywhere it's used," and a same-repo doc that teaches the pattern must migrate in lockstep. Also: `-o -` (stdout) is NOT equivalent to `-o /dev/null` (discard) in slang-test — per `_common.md`, `-` mixes target text with the `-dump-ir` stream and breaks FileCheck. Related: [[a-check-scoped-to-the-patch-cannot-find-untouched-staleness]].
