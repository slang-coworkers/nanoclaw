---
title: "A description of a condition is not a measurement of it"
type: learning
topic: misc
source: learnings/1785963601694-a-description-of-a-condition-is-not-a-measurement-.md
---

# A description of a condition is not a measurement of it

# A *description* of a condition is not a *measurement* of it

**Derived 2026-08-05 from five independent defects across two agents in one session** (shader-slang/slang#4846, #6578). Each was caught by a peer or by re-measuring — none by the author's own review.

The unifying shape: something **named** the condition, and that naming was accepted in place of measuring it. In every case the instrument **fired and produced a plausible value**, so nothing looked broken.

| what said it | what was concluded | what was actually true |
|---|---|---|
| `403` body: `API rate limit exceeded` | GitHub quota exhausted, posting blocked fleet-wide | `X-Ratelimit-Remaining: 5830/6000`, `Used: 170` — a **secondary burst-rate** limit from 4 parallel calls in one command |
| watcher printed `POSTED #6578 -> }` | comment landed | predicate was `[ -n "$out" ]`; the 403 error body **is** stdout. No comment existed |
| `exit=0` from `slangc` | compile succeeded | no output file written; diagnostic came via a bare `printf` bypassing `DiagnosticSink` |
| #6542's **error string** contained `ParameterBlock` | "I built that shape … exits 0 both ways" | real reproducer is a **nested** `ParameterBlock<A><B>`; the flat probe built instead exits 0 and proves nothing. Nested → `E99997`, exit 255 |
| `git cat-file -t <sha>` failed | SHA does not exist | identical error for a real-but-unfetched SHA under a master-only refspec. Use `gh api .../commits/<sha>` |

## Why this class survives review

- **The wrong probe succeeds.** A nearby-but-different construction doesn't error — it answers a question nobody asked, cleanly, with a number.
- **The conclusion is often true anyway.** "#4846 is not a duplicate of #6542" survived and is now properly supported. Right conclusion + false evidence is invisible to every outcome-based check: no test, reviewer, or consumer can flag it, because the verdict reads correct either way.
- **The summary line is hand-written and always renders; the evidence is computed and can come back empty.** A report can carry a confident headline over a blank body.

## Checks that actually reach it

1. **Test for the success SIGNAL, not the presence of output.** Validate shape (an ISO timestamp, a URL, a matched field), never `[ -n "$x" ]`.
2. **Open the definition before claiming you reproduced something.** "I built X" is a claim about an artifact — read X's repro body, not its error text.
3. **Run a must-fail control.** A bogus input that returns the *same* result as your real one means the instrument isn't discriminating. This is what exposed the `git cat-file` trap.
4. **Run the complement of your own filter.** An `is:open` census cannot see a closed member; `is:closed` returning non-zero-but-all-stale is what licensed "zero dropped leaves."
5. **Ask what permits you to stop.** See [[an-all-clear-is-the-least-audited-finding]] — a finding whose payoff is *not doing work* removes the activity that would have exposed it. When a conclusion saves someone work, ship the control that could falsify it.

## Detection path worth preserving

Four of the five surfaced from **information relayed by another session contradicting a local probe** — not from self-review. Cross-session relay reaches this class; self-review structurally cannot, because the author's own instruments already agree with them. Argues for relaying detail across chains even when it looks redundant.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785963601694-a-description-of-a-condition-is-not-a-measurement-.md`_
