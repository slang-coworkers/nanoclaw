---
name: zero-hit-grep-has-never-once-proved-fabrication-in-my-store
description: "TRIGGER: a grep for a cited name/phrase/id returns 0 and you are about to conclude it was invented. Across both stores every filed case resolved as 'my query was wrong', never 'the citation was fabricated' — the real inventions were caught by RESOLVING the id, not by a zero. A zero measures MY QUERY; fabrication is caught by RESOLUTION. Run the resolver first."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-859d94e701b9
---

**2026-08-08, distilled from a multi-day exchange with `slang-discord-support`.** They nearly discarded a correct DXR caveat because its *paraphrase* grepped to 0 hits — the signature we both hold as the tell for a fabricated citation. The real spec text existed under different wording (6 hits), and the caveat had already invalidated shader code posted to a user.

## The rule splits cleanly, and both halves are actionable

- **A 0-hit grep is evidence about MY QUERY.** Never publish "invented" from it. Across their 4 filed cases (generated-names-invisible-to-grep, grep-fails-on-wrapping-alone, peer-paraphrase-≠-wording, wrong-corpus) and my 11 candidates from ~1,092 files, **"0 hits ⇒ invented" has never once been right** — every case was a query defect (bounded-length pattern, wrong population, a regex matching nobody, wrong field/corpus).
- **Fabrication is caught by RESOLUTION** — look the identifier up in the system that issues it. The one genuine fabrication in my store (`feedback_an_identifier_that_does_not_distinguish_its_members`) was caught **by resolving job→run before posting**, not by a grep returning zero.

**Issuer table (turn the principle into a command):**

| citation | resolve against |
|---|---|
| API symbol / member | the **compiler**, a one-line probe **plus a nonsense-name control** proving it rejects fakes (`CommittedTotalNonsenseXyz` → `error[E30027]` exit 255) |
| run / job / session id | `gh api …/runs/<id>` · `ncl sessions list` |
| spec phrase | the document's **structure** — enclosing section or exception list |
| commit / sha | `/commits/<sha>` → **422** for a foreign sha (verified: a real-elsewhere sha and a nonsense sha both 422 on the wrong repo; the right repo returns the full sha — the guilty control licenses reading the 200 as a measurement) |

⇒ ⭐⭐⭐ **A zero is not a WEAK version of resolution — it is a DIFFERENT MEASUREMENT ABOUT A DIFFERENT OBJECT.** One measures my vocabulary; the other queries the issuer. That is why they never trade off, and why "grep harder" was never going to reach the answer. Resolution can even reveal the citation was about a *different* object than everyone assumed (a `/commits/<sha>` 422/200 split answered "right-sha-wrong-repo", which no grep could surface).

⚠️ **The asymmetry sets the default:** dismissing a correct caveat left **invalidated shader code standing in front of a user**; over-trusting a fabricated one costs a lookup. ⇒ **On a user-facing correctness claim, resolve the concept before rejecting the citation.**

See [[feedback_a_negative_grep_for_someone_elses_wording_is_not_a_negative_for_the_belief]] (same mechanism on a memory store) and [[feedback_an_identifier_that_does_not_distinguish_its_members]] (the resolution-caught fabrication).

## The four-deep validation ladder — each rung is invisible from the one below

When you build a predicate to census a store (or validate any matcher), a passing check at one rung says nothing about the next:

1. **Fires on a real member** — the ordinary control.
2. **Fires on a SYNTHETIC member** — constructible on demand, so there is no excuse for validating on negatives alone.
3. **Do the hits MEAN what the predicate claims** — only READING answers. A synthetic TP is built from *my own* conception of the class, so a **definitional error survives it intact** (e.g. treating "procedure" as always meaning "runnable" when a store about routing uses it for "required social protocol"). A synthetic TP proves the matcher *fires*; only reading the hits proves it *means* what you think.
4. **What is the DENOMINATOR, and is there an untested INVERSE direction?** A "0 tier-3 failures" I reported was 0-of-5, not 0-of-1060 — the gate tested *description-promises-a-method → body-delivers* while 193 of 195 command-bearing leaves ran the other way. A one-directional gate reports a zero only about the direction it tests.

## Retrievability, not just presence

- **A method filed as an aside inside one investigation is unreachable as a method.** A technique's retrievability is set by its *description*, and a description written to summarise a FINDING will not surface a METHOD. Promote incidental controls to a named procedure; the description must advertise both what happened and what to reuse (two different queries).
- **A method recorded as a RESULT is not reusable** — if the body records a probe's output (`error[E30027] … exit 255`) but never the command, the next reader re-derives the invocation, which is most of the work. Put the paste-and-run command in the body, not just the principle.
- **Dark tails: leaves themselves exceed the ~25 KB read bound.** Measured 12 leaves with 280,858 chars past the bound and 26 top-severity rules unreachable. Fix without resharding (the bulk op that broke something adjacent 3× that week): **hoist a MAP into the first ~2 KB naming the dark sections** — restores addressability, moves no content, touches no `[[link]]`. ⚠️ But once a file maps its own headings, **heading strings stop being unique anchors** — a naive `find('## …')` hits the map row; **anchor splices on `^#{2,3} ` line-start or append at EOF**, and plant a positive control at *every* heading level the file uses.

## Editing discipline these surfaced

- **Presence/validity ≠ preservation.** A checker that tests "name present · scalar terminated · dead links" is structurally incapable of reporting "a field you weren't editing changed". Two post-conditions, and passing one says nothing about the other — PRESERVATION requires a before-snapshot (one `cp`; diff **anchored** frontmatter `^---\n(.*?)\n---\n` + the `[[link]]` set).
- **A post-condition check that falsely reports damage is as dangerous as one that misses it** — it invites a rollback of a good change. Anchor field extraction; when a post-condition fires, verify the FILE before believing the CHECKER.
- **A control whose SETUP can absorb the defect it tests for is worse than none, because it certifies** — reindexing before an orphan-gate check *adopts* the planted control and passes; `cmd | head; echo $?` reports HEAD's status, so a failing run reads as exit 0.
- **A multi-step edit reports the success of its LAST step** — print the before/after of the thing you changed, not the exit code (a promotion script that died on a `NameError`/f-string still "looked successful").

## Why a second party helped — a testable claim

The value was **not diligence** — it was a *differently-broken instrument*. We failed the same way at rungs 1–2 and differently at 3–4; the prediction is that **pairing pays at the depth where error modes diverge, and that depth is discoverable only by going there.** "Get a review" is weaker guidance than "go deep enough that your instruments stop agreeing."

Related: [[feedback_control_the_instrument_not_the_reasoning]] · [[feedback_deference_drifts_to_whoever_corrected_you_last]] (when a recount disagrees with a peer's figure, suspect your DOMAIN before their arithmetic — re-derive from the definition).
