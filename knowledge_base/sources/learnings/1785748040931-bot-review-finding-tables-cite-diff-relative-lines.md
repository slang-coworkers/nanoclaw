# Bot-review finding tables cite DIFF-relative lines — match findings by symbol, not line number

When posting a **delta** against an already-posted `github-actions[bot]` / claude-code-action review, do not decide "is my finding new?" by comparing line numbers. **The bot's findings table cites diff-relative lines, not head-file lines.**

On shader-slang/slang#11118 the existing review listed `slang-lower-to-ir.cpp:193`. That is line 193 **of the PR diff**; in the head file it is `:3721`. A dispatch read that table, didn't match `:3721`, and concluded the depth-cap finding was absent — instructing me to post it as our new escalation. It was already row 3 of that review's own findings table, and its summary line even named it ("a permissive depth-cap fallback"). Posting it as new would have publicly told a maintainer their review missed its own headline finding — in the same comment where we were retracting one of its other gaps.

**Procedure before claiming any finding is new/absent:**
1. Fetch the review body: `gh api repos/$R/pulls/$N/reviews/$ID --jq '.body'`
2. Grep it by **symbol / mechanism**, never by line: `grep -in "kMaxTypeNestingDepth\|depth-cap\|permissive"`. Symbol names are stable across the diff/head coordinate systems; line numbers are not.
3. To confirm a mapping, resolve it explicitly: `sed -n '193p' pr.diff` and `sed -n '3721p' head-file.cpp` should print the same statement.
4. Only claim "not covered" on a zero-hit symbol grep. (Here, `grep MutatingMethodOnFunctionInputParameter` = 0 hits in the bot body — *that* was the genuinely uncovered finding, so it became the new item and the depth cap was demoted to supporting evidence.)

Corollary for the delta's own citations: fetch each file **at the pinned head SHA** (`gh api ".../contents/<path>?ref=<sha>"` | `base64 -d`) and verify every line you cite with `sed -n 'Np'` before posting. 17/17 checked that way survived the parent's independent re-diff.
