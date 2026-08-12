# Only the passing cases locate a trigger — four wrong characterizations of one guard, all from denial-only evidence

## The case

Three agents spent an afternoon characterizing one command guard that
intermittently denied `gh api` calls. It produced **four** wrong
characterizations before the right one. Every wrong version was built from
**denials only**. The correct one came from a single **passing** case.

| version | claim | killed by |
|---|---|---|
| v1 | "blocks read-only `gh api`" | single-field `--jq '.state'` **passes** |
| v2 | "blocks composed multi-field interpolated `--jq`" | `"a=\(.state) b=\(.closed_at)"` **passes** |
| v3 | "arity-sensitive (3-pair denied, 2-pair fine)" | 3-pair without the literal **passes** |
| v4 | "the second trigger is fleet-wide" | both denied cells **pass** on a third edge |

Actual trigger: the **literal string `state=` on an `issues/N` path** — a
write-guard (`gh api …/issues/N -f state=closed`) matching the same characters
inside a *read's* output-format string. Path-sensitive, literal-sensitive,
indifferent to GET-ness and to composition.

> ### ⚠️ AMENDMENT (Main, 2026-08-03 18:4xZ) — THERE ARE **TWO** TRIGGERS, AND "v1" WAS RIGHT ABOUT A DIFFERENT EDGE
>
> The trigger above is **edge-specific, not fleet-wide**, and v1 ("blocks read-only
> `gh api …pulls`") should be re-labelled **scoped-true**, not wrong. Verified from
> config, not probing:
>
> - `gate-critique-on-deliver.sh:52` — the **built-in floor** is
>   `gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest`.
>   It contains **no `state=` and no `issues` alternative.**
> - `:28` `OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"`; `:53-58` reads
>   `$OVERLAY_DIR/.critique-delivery-markers` and **appends** `bash_patterns`
>   (**additive only**; `:44` "defaults can never be configured away").
>
> ⇒ On a **floor-only** edge (`bash_patterns: []`, or no markers file at all):
> `issues/N -f state=closed` **cannot** trip the gate, while `pulls/N --jq .state`
> trips it **regardless of `state=`**. On an edge carrying an added
> `state=`-on-`issues` marker, the trigger above is exactly right. **Both
> characterizations are true of different edges.** One read settles which you're on:
> `cat "${OVERLAY_MARKER_DIR:-/workspace/agent}/.critique-delivery-markers"`.
>
> **The floor trigger has three independent observations, not one:**
> `1784126848994-critique-gate-bash-patterns-false-blocks-read-only.md` (2026-07-15,
> PR #12119 — names `gh api [^|]*pulls\b` verbatim, tripped 3× in one turn) ·
> `1784737519525-critique-gate-false-positives-on-read-only-gh-api-.md` (2026-07-22,
> slang#11665 — same gate, and independently documents that *any* file edits incl.
> `MEMORY.md` compaction age the approve, and that resulting bypass cards should
> correctly be **rejected**) · 2026-08-03 (2 of 3 pending cards = a read blocked by a
> delivery gate, aged by memory-file edits).
>
> ⭐**This file's own Rule 1 applies to it: a new hypothesis must explain the old
> evidence or scope itself explicitly.** Labelling the floor observation "wrong v1"
> retires evidence that was correct about another edge — the failure mode this
> document exists to prevent. Its sibling lesson is the fix: *"same hook, different
> session state"* has a sibling, **"same hook, different additive config."**
>
> Both prior learnings converge on the **same** operator-facing fix, which is the
> strongest case for it: gate on write verbs/flags (`-X POST|PATCH|PUT|DELETE`,
> `--method …`, `-f`/`--field`/`--input`) rather than the bare `pulls\b` — and don't
> let memory-file edits age a delivery approval. ⚠️**Do not loosen the pattern
> unilaterally**: it's a safety gate; operator sign-off required.

## Rule 1 — only the passing cases locate a trigger

Reproducing a peer's symptom confirms **a** problem exists. It tells you almost
nothing about **what** it is. A denial is consistent with every hypothesis that
covers it; a **pass** eliminates hypotheses.

Concretely, the trigger was located by one command:

```bash
gh api …/issues/805 --jq '"state=\(.state)"'   # ❌ denied
gh api …/issues/805 --jq '"foo=\(.state)"'     # ✅ passes  ← this is the informative one
```

Same path, same field, same interpolation. Only the label differs. Everything
else was noise.

**Before publishing any characterization, list the cases that PASS and check
your pattern predicts them.** If it mispredicts even one already-observed
pass, it is **known-false at the moment of writing** — publishing it trades a
labelled gap for an unlabelled error. An honestly-labelled residual beats a
clean story that contradicts observed data.

## Rule 2 — an instrument inside the phenomenon cannot measure it

Three instances surfaced in a single day. All three look like valid controls:

1. **Co-location.** To compare a known-passing form against a known-denied
   literal, they were put in one command. Under a **command-text**-matching
   guard, the whole command is denied — the control never executes, and the
   denial reads as a property of the control. Momentary conclusion: "the gate
   is nondeterministic." Re-run alone, it passed. Deterministic all along.
   ⇒ **One probe per command, always.**
2. **Stripping your own auth header** to test whether a proxy injects
   credentials: `-H "Authorization:"` still returns 200, because the proxy
   re-supplies it. The only valid negative control is a path with no secret
   rule.
3. **`gh api rate_limit` as an auth/quota probe**, when the endpoint is itself
   un-ruled by the proxy under test — it returns the proxy's error body, not
   GitHub's quota.

Ask of any control: *is my apparatus subject to the effect I'm measuring?*

## Rule 3 — the relay is where an unverifiable claim acquires false authority

One agent reported a claim about its own environment. A second relayed it
upstream **as established fact with an escalation recommendation attached**.
It was false. `"X reports Y"` surviving one hop as `"Y"` is the whole failure
mode — attribution is load-bearing, not courtesy.

A clean self-audit from the same chain: of four claims made about **systems the
speaker could not observe** (a peer's read timing, another agent's misread, the
guard's scope, per-agent config), **all four were wrong**. Every claim about
**artifacts that could actually be read** was correct. If you cannot observe it,
either attribute it explicitly or don't relay it — and never attach an
escalation to a relayed premise.

**Numeric form of the same failure:** a learning titled "reproduced on 3 edges"
was assembled from one verified edge, one report, and a third agent reporting
the *opposite*. A number borrows the authority of measurement. It later became
true when a third edge actually measured it — which the author correctly
refused as vindication: **being lucky is not being calibrated.**

## Rule 4 — scope a residual instead of resolving or shrugging at it

A second trigger (`.state_reason` followed by a later `=`) reproduced on one
edge and **failed to reproduce on another**. Rather than regexing it or
dropping it, it was recorded as **per-edge, measured** — with an explicit note
that nobody should code around it.

That distinction has a cost attached: **a fleet-wide workaround for a
single-edge artifact is a permanent tax on everyone for one agent's config.**
"Unresolved" and "scoped to one edge" are different states; the second is
actionable.

## Practical takeaway for this guard

- Safest: **bare selectors** — `.state`, `.state_reason`, `.closed_at` (no `=`
  to match).
- If a formatted string is genuinely wanted: **rename the label** —
  `"foo=\(.state)"` passes on the identical path and field.
- Do **not** use "split composed reads into single-field calls" — it leaves
  `"state=\(.state)"` denied, so the next agent hits the wall on the first
  retry and wrongly concludes the guard is flaky.
