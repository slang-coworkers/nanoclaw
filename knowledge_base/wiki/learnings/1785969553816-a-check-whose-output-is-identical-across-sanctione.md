---
title: "A check whose output is identical across sanctioned and unsanctioned causes is not evidence"
type: learning
topic: verification
source: learnings/1785969553816-a-check-whose-output-is-identical-across-sanctione.md
---

# A check whose output is identical across sanctioned and unsanctioned causes is not evidence

**If a command returns the same result whether the cause was authorized or not, running it tells you
nothing about which happened.** You need the authorization record, not a better query.

Concrete case, slangpy#1054: a reviewer ran `git merge-base --is-ancestor <old-head> <new-head>` → `false`
and concluded "the force-push destroyed the old head." But the push was an **authorized commit re-author**
(fixing a CLA identity), and re-authoring rewrites every SHA by construction — so `--is-ancestor → false`
is the *expected signature of the sanctioned operation*. The exit code is byte-identical for "history
rewritten exactly as approved" and "work lost." Only knowing which rewrite was authorized distinguishes
them. Root cause was a lost authorization record, not a bad git query.

Same shape elsewhere in that chain:
- `git log -S` on a shallow clone returns a confident single answer that is wrong; identical output shape
  to the correct answer on a full clone. Check `git rev-parse --is-shallow-repository` first.
- `--is-ancestor` also returns `false` when an object simply **isn't in your clone** — indistinguishable
  from a real rewrite. Positive-control with `git cat-file -t <sha>` before believing it.
- Grepping a public artifact for *your own prior claim* finds it even when struck through, because a
  correction usually **quotes** what it refutes. Counts are identical whether the artifact is untouched or
  fully retracted. Read the newest comment first, grep `REFUTED|CORRECTED|Superseded|~~`, *then* your text.

**Two operational rules that fell out of it:**
1. **Read a remote head; never retype it.** `git push --force-with-lease=<ref>:<sha>` with a *remembered*
   SHA fails closed (good) — but the failure is your own typo, not a real conflict. Get the value from
   `git ls-remote` and pass it. Note the *pinned* form is stronger than bare `--force-with-lease`, which
   silently degrades to "no expectation" when there is no remote-tracking ref.
2. **"The symbol is exported" never implies "this code path is reachable."** Follow the initialization: a
   struct member says which function is *bound*, not which rules a caller can reach. Two reviewers both
   confirmed a function was a member of an exported struct and neither checked which pointer it was
   initialized with — the wrong reachability claim then went into a public issue.

**And the meta-rule:** a *plausible mechanism* can override a *correct instinct* that has no story
attached. That is how the wrong claim above got written: one party's instinct said "internal-only" (right),
the other supplied a persuasive mechanism (wrong), and the instinct lost. When someone hands you a
mechanism that contradicts your instinct, treat it as a hypothesis to test, not grounds to overwrite.
Be most suspicious of a surprising claim that arrives with a good reason attached — the reason is what
switches off the implausibility check that would otherwise have caught it.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785969553816-a-check-whose-output-is-identical-across-sanctione.md`_
