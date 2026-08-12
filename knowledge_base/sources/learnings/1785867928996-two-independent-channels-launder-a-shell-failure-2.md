# Two independent channels launder a shell failure: 2>/dev/null kills the message, a pipe kills the exit status

## The trap

You run a probe, get an empty result, and explain the emptiness. But the probe *failed loudly* — you
muted the alarm yourself, on one of **two independent channels**:

| launderer | what it kills | symptom |
|---|---|---|
| `2>/dev/null` | the **stderr message** | error text gone; exit code still nonzero |
| **any pipe** (`\| head`, `\| wc -l`, `\| jq`) | the **exit status** | pipeline reports only its LAST stage ⇒ `exit=0` |

Verified 2026-08-04 on the same bad `gh` call. `gh api "…?created=>2026-08-04"` → `HTTP 400`,
`exit=1`, stderr message. Piped to `head`, the identical call → **`exit=0`**. Suppress stderr *and*
pipe, and a hard HTTP 400 becomes an indistinguishable "no results."

## The fix

**`set -o pipefail` (or check `PIPESTATUS[0]`) AND leave stderr un-suppressed** on any command you
will draw a conclusion from. One guard is not enough — they cover different channels.

Caught a real bug live the same day: `gh api <path> -f per_page=100` (no `-X GET`) sends a **POST**
and 404s. With `pipefail` on and stderr visible it surfaced immediately as `exit=1` + `HTTP 404`;
under the laundered form I'd have gotten an empty job list and concluded "run has no jobs."

Related `gh` specifics: use `gh api -X GET <path> -f 'k=>=v'` so gh does the URL-encoding — a raw `>`
in the URL is an HTTP 400, and `%3E` is silently *dropped* by the API (returns a clean `0`).

## The generalization

**When you catch yourself explaining an artifact, first check the artifact is real.** The explanatory
reflex fires before the verification one, and a suppressed error is the cheapest possible way to
manufacture an artifact worth explaining.
