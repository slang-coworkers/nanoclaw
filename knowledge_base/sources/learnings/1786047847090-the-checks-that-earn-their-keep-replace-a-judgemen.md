# The checks that earn their keep REPLACE A JUDGEMENT WITH AN EXECUTION — six that paid off in one session, none of which required knowing the failure mode

## The pattern

Across one long compiler-fix session (slang#12284), a dozen defects were caught before shipping.
Reviewing which checks actually paid off, they share one property: **each replaced a judgement I would
otherwise have made with an operation I could run.** None required guessing which failure mode was
present, which matters because the faculty that produces a defect is the same one that would be asked
to spot it.

| judgement it replaced | execution |
|---|---|
| "is this new test meaningful?" | run it on the **fix-absent binary** — it must FAIL. Caught an anti-test that passed 100% with the feature removed. |
| "does my log parser see everything?" | assert **parsed count == raw status-line count**. Caught two silent undercounts (a status form with no `test:` token; trailing timings after the quote). |
| "can my parser report a non-zero result?" | **mutation control** — flip one real passing line to failing; the tool must report exactly 1. |
| "is the guard I added armed?" | compare the **inode** the running shell holds (`/proc/PID/fd/N`) against the file on disk. It wasn't — the edit replaced the file. |
| "is this preserved baseline copy usable?" | **two axes** — emits 0 on the positive case *and* still compiles something. A truncated copy also emits 0. |
| "will a reader see my correction?" | **grep the dangerous terms** and observe where they land. A top-of-file banner didn't reach a searcher. |
| "are these file:line citations right?" | **print every cited line** and flag comment/brace/blank landings. Two rounds, 13 wrong citations. |

## Why judgement fails specifically here

In every case my inspection *passed* the artifact. The banner looked sufficient; the test looked
reasonable; the parser's output looked plausible; the guard looked present. **Inspection can only
check against your model, and the defect is in the model** — so the check has to derive its
expectation from the artifact rather than from you.

Corollary already known but reinforced: prefer controls whose expectation comes from the artifact
(cross-total, mutation, inode, access-pattern simulation) over controls you author (hand-built
fixtures, "does this look right?"). A self-authored fixture validates the code against your model of
the format, so it can only confirm what you already believe.

## Practical use

When about to write "verified", "looks correct", "should be fine", or "clearly cannot happen" — ask:
**what operation would expose me if I were wrong, and can I run it in one command?** If yes, run it
instead of writing the adjective. Most of these took under a minute; each prevented shipping a false
claim.

⚠ The corollary that stings: a check whose failure is indistinguishable from its negative result is
not a check. "No output" from a formatter that never ran, "0 warnings" from a broken binary, "no
findings" from a regex that matched nothing, silence from a guard that never fired — all read as
success.
