---
title: "slang-mcp: github_list_issues and github_get_discussions return FALSE EMPTIES (is:merged actually works; merged_at is the broken field)"
type: learning
topic: slang-compiler
source: learnings/1785744880116-slang-mcp-github-list-issues-and-github-get-discus.md
---

# slang-mcp: github_list_issues and github_get_discussions return FALSE EMPTIES (is:merged actually works; merged_at is the broken field)

Discovered 2026-08-03 during a Slang daily-report run. Two corrections to prior assumptions about the `slang-mcp` GitHub tools — both matter because they fail **silently**, producing a confident "nothing new" report.

## 1. `github_list_issues` returns `total_count: 0` unconditionally (BROKEN)

Verified against all three repos (`shader-slang/slang`, `slangpy`, `slang-rhi`), both with and without a `since` filter → zero results every time. This is **not** a filter artifact.

**Why it's dangerous:** a daily/sweep report built on `github_list_issues` reports "no new issues across the board" and looks correct. On the day this was found, the tool hid **4 newly-created slang issues** (including an SS-class silent-wrong-value bug) plus 10 more untriaged ones.

**Workaround that works:** use `github_search_issues` with an explicit query, e.g.
`repo:shader-slang/slang is:issue is:open created:>=2026-08-01`
`repo:shader-slang/slang is:issue is:open updated:>=2026-07-31`
Search returns real, complete data. Sanity-check any "nothing new" result with a second query whose non-empty answer you can predict (e.g. widen the window to 30 days) before believing an empty one.

## 2. `github_get_discussions` also returns 0 (BROKEN)

Returned zero discussions AND zero categories for `shader-slang/slang`, filtered and unfiltered, while Discussions are demonstrably enabled and active. Fall back to a web fetch of `https://github.com/shader-slang/slang/discussions`.

## 3. `is:merged` is NOT broken — `merged_at` is the broken field

A prior session recorded "the `is:merged` search is broken, returns 0 results — use the REST pulls/commits API instead." **That conclusion was wrong and should not be carried forward.** Re-verified: `repo:shader-slang/slang type:pr is:merged closed:>=2026-07-31` returned 12 results; `is:unmerged` returned 1; plain `closed:` returned 13. 12 + 1 = 13 — the two filters are exact complements, mutually corroborating.

What actually misleads: **`merged_at` is `null` on every result, including confirmed-merged PRs.** Reading `merged_at` to decide merge state makes every PR look unmerged, which is almost certainly what produced the "is:merged is broken" belief.

**Rule:** determine merge state from the `is:merged` / `is:unmerged` filters (and/or the issue auto-closing via `Fixes #N`), never from `merged_at`. To be certain about a single PR, spot-check that a file it added now exists on the default branch via `github_get_file_contents`.

## General lesson

An MCP read tool returning empty is ambiguous between "genuinely nothing" and "tool is broken." For any report where empty means "all clear," verify the tool is alive with a control query that MUST return data. Silence is not evidence. (Same shape as the Discord `#slang-support` / `#slang-support-bot` reads returning empty 3 days running while sibling channels read fine — likely a read-scope gap, not genuine silence.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785744880116-slang-mcp-github-list-issues-and-github-get-discus.md`_
