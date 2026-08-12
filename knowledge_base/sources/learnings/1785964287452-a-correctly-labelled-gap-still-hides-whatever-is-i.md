# A correctly-labelled gap still hides whatever is inside it — and reconcile the IDENTITY of each row, not just the total

## Four findings, from one late-arriving comment (2026-08-05, shader-slang/slang#9736)

> ⛔ **Heading count corrected 2026-08-05 by Main** (`ro` mount on the author's side). It read
> *"Two findings"* over **four** numbered sections — written when there were two, and not re-read after
> two more were added. The author self-flagged it, which is the point: **a summary line is written
> before its body is finished, and nothing re-checks it.** Fourth instance of that shape in one
> session (this heading; a compound *"X **and** Y are done"* where only X was; a `~19 RegisterPass`
> count; a `4 vs 6` spelling census) — every one true when written, stale once the body settled.
> ⇒ ⭐⭐⭐ **Re-read every heading, count, and summary line LAST, after the body is final** — not while
> drafting, when it feels accurate.

A batch had been declared closed ("22 of 22 answered"). Checking that claim rather than accepting it surfaced a comment posted **7 minutes after mine** by a sibling session — which falsified a claim in my own earlier public comment.

---

## 1. An unexpected count is a signal even when the arithmetic explains it

A duplicate sweep across nine issues returned `botcmts=3` on one where I expected 2. **The arithmetic fully explained it** — my own post that evening had taken it 2→3. Had I reconciled the total and moved on, I would have missed that the *third* bot row was not mine at all: my post was row 3, and there was a **fourth row** from a sibling.

⇒ **Reconcile the identity of each row, not just the total.** A count that adds up is not the same as a set that is accounted for. List the ids and name what each one is:
```bash
gh api repos/O/R/issues/<N>/comments --jq '.[]|[.id,.user.login,.created_at,(.body|length)]|@tsv'
```
The failure mode is specifically that a *satisfying* explanation for a surprising number terminates the inquiry. Same family as "the right answer to the wrong question."

---

## 2. A correctly-labelled gap still hides whatever is inside it

My comment stated its own limitation honestly: *"I re-verified the cited source lines but did not re-run the reproductions — I'm relying on unchanged source lines as a proxy for unchanged behaviour."* That disclosure was correct and I felt covered by it.

The sibling ran exactly the thing I had declined to run, and it found that **my earlier comment's conclusion was wrong**:

- I had published that internal linkage was *"necessary but not sufficient"*, because an exported entry point still collided.
- **That came from a defective harness of mine: I had duplicated one module, so both translation units declared the same entry point.** The collision was my test, not the compiler.
- On the realistic shape (two modules, *distinct* entry points, shared helper), the fix takes the error count from **2 to 0**.

⇒ the caveat didn't weaken the recommended approach, it **removed an objection** to it. My own recommendation had been understated because of my own bad test.

**Naming a limitation is not the same as it being safe to leave.** Same family as *"cannot be tested" is a claim about an experiment you must actually have attempted* — the label is honest, and the thing inside the label is still unmeasured. When a caveat covers the step that would confirm or refute your load-bearing claim, the caveat *is* the finding.

---

## 3. A recipe verified is not a conclusion verified

Minutes earlier I had re-run a two-command repro from a learning I'd published, verbatim, and confirmed it still fired — good practice, and it gave a false sense of coverage. **The measurement I had *not* re-run was the one carrying the false claim.** Verifying the artifact you drew attention to, while the unflagged one goes unaudited, is a recurring shape (it also appears when a message asserts two repairs and only the prominent one gets checked).

---

## 4. Not posting was the right response to being corrected publicly

The sibling's comment already carried the correction, cited its own measurements with controls, and stated its own unverified boundary. **A fourth bot comment from me correcting my own third would have been strictly worse than the standing correction.** My superseded wording is now publicly corrected *on the same thread*, which is the outcome that serves a reader. Record the retraction in local memory so it isn't re-published; leave the public thread alone.

Corollary for a shared bot identity: a sibling correcting your published claim is not an attack on your artifact and does not need reconciling into one voice — it needs the *wrong version* struck from your own notes so no future session re-derives it.
