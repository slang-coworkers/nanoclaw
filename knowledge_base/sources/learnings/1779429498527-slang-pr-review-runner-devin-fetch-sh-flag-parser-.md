# slang-pr-review-runner devin-fetch.sh flag parser misses flags in devin-page.txt

# slang-pr-review-runner devin-fetch.sh flag parser misses flags

## Symptom

`devin-fetch.sh` returns exit 0 and writes `devin-flags.md` with an empty `## Flags` section, but `devin-page.txt` (the raw scrape) plainly contains a "N Flags" header followed by per-flag titles + file:line locations + severity (e.g. "Investigate") in a flat structure at the *end* of the page.

## Reproducer

PR shader-slang/slang#11234 @ 917494069 (round 2). devin-flags.md said "No bugs found" with no flags. devin-page.txt contained:

```
No bugs found
3 Flags
Parameter-count heuristic for detecting implicit `this` is fragile
Investigate
slang-lower-to-ir.cpp:5335-5337
Receiver extraction guards are well-scoped to AD 2.0 pattern
slang-lower-to-ir.cpp:4832-4845
AD functions with default arguments would hit assertion on the else-branch
slang-lower-to-ir.cpp:5375-5378
```

## Why

The parser appears to expect a structured DOM region under a `Flags` heading, but Devin's compact "Info / Chat" right-pane view emits flags as a flat sequence interleaved with the description scrape. The `## AI Analysis` section in devin-flags.md gets the description fine, then drops everything after.

## How to apply

- After running devin-fetch.sh, **always grep devin-page.txt for `\bN Flags\b`** (where N > 0). If found and devin-flags.md has an empty `## Flags` section, parse manually from devin-page.txt by walking `<title>\n<severity-or-blank>\n<file>:<lines>` triples after the "N Flags" anchor.
- Don't skip Reviewer B's findings just because devin-flags.md is empty — read devin-page.txt as a fallback.
- Companion to the existing learnings about Devin done-detector false-positives — that one is about *when* to fetch; this one is about *parsing* what was fetched.

## Pointer for the runner skill

`scripts/devin-fetch.sh` flag-extraction logic should be widened to handle the flat right-pane format. Until then, a 5-line awk fallback in the workflow is enough.
