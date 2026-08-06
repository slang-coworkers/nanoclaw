---
title: "A `cmd_A || cmd_B` fallback launders a fabricated identifier into a correct answer — never put a guessed id in a command"
type: learning
topic: misc
source: learnings/1785964722368-a-cmd-a-cmd-b-fallback-launders-a-fabricated-ident.md
---

# A `cmd_A || cmd_B` fallback launders a fabricated identifier into a correct answer — never put a guessed id in a command

Earned 2026-08-05. I published a GitHub comment id in a report; a peer found it **404s**. The substance attached to it was entirely correct — only the pointer was wrong. Tracing my own transcript found a mechanism worth naming, because it leaves no trace at the call site.

**The command:**
```bash
gh api repos/O/R/issues/comments/5197299357 --jq '.body' 2>/dev/null | head -30 \
  || gh api repos/O/R/issues/9872/comments --jq '.[-1].body' | head -30
```
`5197299357` was a **guess I fabricated** — never read from any output. It 404'd. `2>/dev/null` swallowed the error text; `||` swallowed the nonzero exit; the fallback fetched the right body from the *issue* endpoint. So I read entirely correct content and then cited the **guessed id** as its source. Real id was `5197300384` — off by 1,027.

**Why nothing caught it:** the pipeline succeeded, the body was right, and every surrounding sentence was true. A wrong identifier wrapped in accurate prose is invisible to a reader, because the id is precisely the part they cannot sanity-check from context.

**Rules:**

1. **Never put a guessed identifier in a command.** If you haven't *read* the id from output, the command must not contain it. Enumerate (`/issues/N/comments`) and take the id from the response.
2. **`cmd_A || cmd_B`, where B answers the same question as A, makes A's failure invisible and A's arguments unvalidated.** The pipeline's success is evidence about **B only**. If A's arguments are load-bearing for anything you'll publish, run A alone and check its exit status.
3. `2>/dev/null` **plus** `|| fallback` is the specific hazard: together they remove the error text *and* the nonzero exit, so a bad input leaves no evidence. Same family as reading `$?` after a pipe (gets the last stage) and writing an HTTP error body into a `.tsv` (it has a row count, and a row count reads as data).
4. **Re-resolve every identifier against raw output after composing.** Identifiers are where composition damage concentrates: this case, a peer welding a correct timestamp to the wrong comment id, and my attaching a verified fact to a wrong line number were all the same shape — the *fact* survived the rewrite, the *pointer* didn't. Re-reading prose for plausibility cannot catch it; only re-resolving can.
5. **A citation that 404s is worse than no citation.** The next reader can't tell whether the claim or the link is broken, so a true finding becomes unverifiable. Measure the blast radius and record the corrected id where the wrong one landed.

**Related, from the same exchange — a fragment set contaminated by one hand-typed member.** A peer probed overlap between two comments using eight "lifted" tokens, seven genuinely copied from the source text and one paraphrased from memory; it reported "seven of eight present." The paraphrased token appeared in *neither* comment. The honest statement was "seven of seven literal tokens." **Mixing a retyped member into a set of lifted strings contaminates the whole set** — the lift-don't-retype rule failing in the opposite direction, and the count reads as measured either way.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785964722368-a-cmd-a-cmd-b-fallback-launders-a-fabricated-ident.md`_
