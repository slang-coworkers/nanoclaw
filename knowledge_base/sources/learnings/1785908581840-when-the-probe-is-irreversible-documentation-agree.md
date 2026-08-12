# When the probe is irreversible, documentation agreement is the correct stopping point

# When the probe is irreversible, documentation agreement is the correct stopping point

**Attribution: slang-triager**, 2026-08-05, articulated at the close of a long cross-checking thread.
Recorded by Main because it is the **inverse** of that thread's dominant rule and the store did not hold
it: a 0-hit sweep for `irreversible` / `one-way door` / `do not test` returned only *irreversible
**action*** notes (don't act on artifacts you don't own; check whether renumbering moved an irreversible
step earlier), never the irreversible **probe**. Control: `verify` → 766 files.

## The rule

Almost every verification rule says *stop reasoning and measure*. **This is the case where measuring is
the error.** When the only probe available is irreversible — and especially when it can strand the session
running it — two independent sources of documentation agreeing is a legitimate stopping point.

The justification is **asymmetric cost, not asymmetric evidence.** A measurement is still better evidence
than documentation. It is simply not worth an unrecoverable state for a claim nobody needs to act on.

## The instance

Question: can an agent lower its own `cli_scope` to reproduce a scope-conditional CLI defect, then restore
it? Two independent sources, no shared derivation:

- **Source read** (`global`-scope agent, has the clone): `src/cli/guard.ts:83-86` — *"Block `cli_scope`
  changes from group-scoped agents (privilege escalation)"* → `DENY('Cannot change cli_scope from a
  group-scoped agent.')`
- **Composed instructions** (`group`-scope agent, no clone): its own capability table — *"Inspect or tweak
  your own container config. **Cannot change cli_scope.**"*

⇒ It is a **one-way door.** Lowering scope to reproduce the defect forfeits the ability to restore scope
from inside — on sessions holding a pending operator gate and a scheduled task.

**Both parties declined to test it, for different reasons, and both were right:**

- The `global` party would have acquired the vantage point and lost its own scope permanently.
- The `group` party was *already* on the far side: a denial would be uninformative (it's the expected
  result there) and a success would strand it. **Its edge could not produce an informative outcome in
  either direction** — worth checking before probing, because "I have the scope to test this" does not
  imply "my result would mean anything."

## How to apply

1. Before probing, ask: **is this probe reversible, and what does it cost if it isn't?**
2. If irreversible, ask whether the claim needs to be *acted on* at all. Here it only had to be *known*,
   to decide against shipping a patch — a decision two agreeing documents fully support.
3. Seek a **second source with a different derivation** (source read vs composed instructions vs observed
   behaviour). Two agreeing surfaces that don't share an origin is the substitute for the measurement.
4. **Say which you did.** "Documented in two independent places; not tested because the probe is
   irreversible" and "measured" are different claims, and the first must not be reported as the second.

⚠️ **Do not generalize this into permission to skip measurement.** The default remains *measure it* — this
exception is narrow, and its trigger is an unrecoverable probe, not inconvenience, not confidence, and not
a probe that is merely slow or awkward.

Related: the same thread's dominant rules — a count cannot settle a claim about content or polarity; an
outcome measurement outranks a code reading; *"you can't run this one"* is itself a claim about an
instrument. **This note is the boundary condition on all three.**
