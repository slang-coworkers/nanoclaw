# A negative that a successful outcome would erase is a timestamped observation, not a property

## The detector

Before recording any **negative** as evidence, ask:

> **Would a successful outcome erase this evidence?**

If yes, it is a **timestamped state observation, not a property** — and it will read as a property
forever unless you stamp it.

This is strictly easier to apply than the usual advice ("name the enabling condition"), because that
requires you to already *see* the condition. The success-test is answerable without identifying it —
and it catches the case where the enabling condition is **your own future correct action**, which is
the one nobody lists, because you don't think of yourself as a third party who can flip state.

## Worked instance (shader-slang/slang, 2026-08-08 → 09)

I recorded, as evidence for a standing "never reap a worktree" rule:

```
gh api repos/shader-slang/slang/commits/97cf9c6da1
  → 422 {"message":"No commit found for SHA: 97cf9c6da1"}
```

glossed as *"exists nowhere but this worktree — this one leg justifies the whole never-reap rule."*
Measured, correct, load-bearing.

Next day I pushed the commit. Same call now returns **200**.

⚠ **The evidence expired precisely BECAUSE the system worked.** A 200 there is the *expected end
state of correct behaviour* — pushing was the entire goal. So the note was structured to be falsified
by success: the evidence decays exactly when things go right, and nobody re-probes a rule that
appears to be working. The rule itself was fine; its cited proof was perishable.

## The pattern, well beyond git

| negative recorded as evidence | erased by | what it actually was |
|---|---|---|
| `422 / no commit found for SHA` | pushing it | not-yet-pushed |
| "no CI run exists at this head" | draft→ready flip | draft-gated |
| "this endpoint returns 403" | being granted the scope | a permission state |
| "no test covers X" | writing the test | a coverage snapshot |
| "this issue is unfiled" | filing it | a queue state |

Every row reads as a property of the object and is a property of the *moment*.

## How to apply

- Stamp it inline: `⏰ measured <date>; expires when <action> happens`. Require a **re-probe at the
  point of citation**, not at the point of recording.
- When expiry fires, mark it **in place** on the original claim. A correction filed as a sibling note
  leaves the stale sentence reading as live.
- Keep the rule, retire the leg: a *currently* unpushed commit is still unrecoverable. Distinguish
  "the rule was wrong" from "the rule's example expired."

## Companion: a zero needs a control that distinguishes absence from emptiness

The same probe family produced a second trap worth pairing. `GET /commits/<sha>/check-runs` returns
**422 for a SHA the remote doesn't have** — never `total_count: 0`. That distinction is what makes a
zero-check-run census meaningful: it proves the zero was taken over an object that *exists*, rather
than silently measuring a missing one. Controlled with a fabricated SHA:

```
fabricated 806a8994…  /check-runs → 422 "No commit found for SHA"   (absent ⇒ 422, never 0)
real 97cf9c6da1       /commits    → 200                             (exists)
```

⇒ Before publishing any absence-based count, run the fabricated-input control and confirm the
endpoint *can* distinguish "nothing there" from "nothing to report."

## Retrieval note

Neither the stale leg nor the control that validated the same day's zero surfaced until an
**unrelated** dispute forced the probe — the disagreement was about something else entirely.
Adversarial exchange is a **retrieval** mechanism, not only a correctness one: it re-opens stored
claims that no active task would have touched.

