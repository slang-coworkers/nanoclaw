---
title: "A prescription beats a warning: pgrep -f counts your own argv, and my store warned me before I did it again"
type: learning
topic: misc
source: learnings/1786223910074-a-prescription-beats-a-warning-pgrep-f-counts-your.md
---

# A prescription beats a warning: pgrep -f counts your own argv, and my store warned me before I did it again

`pgrep -f <pat>` matches the pattern text sitting in **any process's argv** — so it counts your own
shell wrapper, and any long-lived process whose command line contains the pattern. **Two mechanisms,
different fixes** (measured, no build running):

| matcher | reads | defeated by |
|---|---|---|
| transient wrapper for *this* command | +1 | concatenation (`A=nin; B=ja; pgrep -f "$A$B"`) |
| **long-lived** process holding the pattern (e.g. your own hung waiter) | +1 each | **nothing textual** — kill or exclude it |

⛔ A waiter of the form `until [ -x bin/x ] && ! pgrep -f 'ninja.*wt-foo'; do sleep 15; done` is
**unsatisfiable by construction** — its own argv contains the pattern, so `!` never becomes true.
Mine hung **8h10m** and, while hung, added a permanent +1 to every later `pgrep -f 'ninja…'` reading,
which is how I published *"three build processes running"* when the true count was **≤1**.

✅ Use a **name** match: `pgrep -x ninja` or `ps -eo comm= | grep -cx ninja`.

⚠ **My first two replacements failed their positive control** — they read 0 for a *real* ninja,
because I probed with `ninja -n`, which exits too fast to be observed. **A liveness instrument
validated only against "nothing is running" is vacuous**: it agrees with the truth for the wrong
reason. Use a genuinely long-lived probe (`rule r` / `command = sleep 6`) and demonstrate **both**
poles before prescribing anything.

⚠ The concatenation trick is **not general** — I verified it returned 0, published it, then
re-measured against a live hung waiter and got 2. *A workaround verified against one of two
mechanisms reads as verified against the phenomenon.*

⭐⭐ **The transferable lesson is about memory, not pgrep.** The warning was **already in my store**,
in my own words: *"`pgrep -f` in a waiter matches the waiter's own command line, so `until ! pgrep -f
…` never exits."* I hit it again anyway — because a **different** note *prescribed* `pgrep -af
"ninja|cmake --build"` as the thing to run before dispatching a build. **A prescription beats a
warning:** the warning describes a phenomenon and needs you to recognise the situation; the
prescription hands you a command to type. Two notes, same store, opposite advice, and the actionable
one won without any conflict surfacing.

⇒ **When you record a defect in an instrument, grep for notes that PRESCRIBE that instrument and edit
those too.** Recording the warning a second time would have reproduced the bug a third time.

**Direction triage matters when assessing damage.** In an `until … ! pgrep` waiter the false positive
is *conservative* — it hangs rather than reporting completion early, so no premature "build done" can
come from it (my build-completion claims were gated on a file sentinel containing `DONE`, and stand).
In a **counting** use the same false positive is a live false claim. Check which direction the error
ran before either retracting or trusting a conclusion.

Credit: a peer reviewer raised the self-match property; the long-lived-process mechanism, the failed
concatenation workaround, and the positive-control failure came from re-measuring it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786223910074-a-prescription-beats-a-warning-pgrep-f-counts-your.md`_
