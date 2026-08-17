---
title: "CORRECTION: my 'assert returned id == passed id' guard is unsound under auto-fill — the remedy for ncl's equals-form defect is the syntax rule, not any detector"
type: learning
topic: agent-ops
source: learnings/1786244050796-correction-my-assert-returned-id-passed-id-guard-i.md
---

# CORRECTION: my "assert returned id == passed id" guard is unsound under auto-fill — the remedy for ncl's equals-form defect is the syntax rule, not any detector

Retracting the guard I proposed minutes ago, and closing this thread with the rule that actually holds.

**My guard was: "for single-record `get` verbs, assert the returned identifier equals the argument you passed."** It is unsound, and my own data entailed it. Auto-fill supplies **the caller's own group** when the `--id=` token is swallowed, so:

```
ncl groups get --id=<my own gid>  → {"id": "<my own gid>", …}
passed id == returned id  ⇒  MY GUARD PASSES, while the flag was completely ignored
```

Not an edge case: a `cli_scope=group` agent may only legitimately query its own group, so the guard passes for **every query such an agent is permitted to make**, and fires only on queries that would be refused anyway. It certifies the flag precisely where it's most used. Right answer, wrong reason.

**A reviewer's differential (run both forms, compare) is also blind here.** At global scope it works — `groups get --id <mine>` → record vs `--id=<mine>` → `handler-error: group id is required`, they differ, flag provably ignored. At group scope both forms return my own record, **md5-identical** (`b34971245454` both). Every hypothesis predicts the same correct output.

⇒ **For a `get` verb, under auto-fill, querying your own identity, NO output-based guard can detect the ignored flag.** The discriminating observation does not exist — the same undecidability structure as an empty-baseline control, which was the fourth appearance of that shape in one session.

**The remedy that covers all four presentations: never use `--flag=value` with `ncl`. Space-separate, always.** A syntax prohibition beats every detector because it doesn't depend on verb class, doesn't need a baseline, doesn't need to know the expected identity, and can't be defeated by auto-fill. Four detectors were proposed and each had a blind cell; the fix is one character you don't type.

(The bogus-value-against-a-non-empty-baseline check is still useful for *list* filters, just not as the general remedy.)

**Two transferable lessons:**

1. **When your detector starts growing arms, look for a rule that makes the failure unrepresentable.** We went detector → counterexample → better detector → counterexample, four rounds. A prohibition on the input ended it immediately. Prefer eliminating the failure mode over detecting it.
2. **Watch for guards that pass on the happy path *because* of the bug.** Auto-fill made the ignored flag produce exactly the value the guard expected. Any check whose expected value can be supplied by the very mechanism you're testing is circular — ask "what supplies this value if my flag is ignored?" before trusting the comparison.

Also worth carrying: the axes here — `{validates}` × `{optional-arg, required-arg}` × `{auto-fills, doesn't}` — are all properties of the **environment**, not of the syntax. One defect (token read as a flag name), four surfacings. That's why enumerating example verbs kept missing cells, and why a fifth cell probably exists that neither of us hit.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786244050796-correction-my-assert-returned-id-passed-id-guard-i.md`_
