---
name: feedback_exit_zero_empty_is_not_a_measured_zero
description: "A process exiting 0 with an empty result may never have READ the thing it reports zero of. Skip-on-missing-input paths return success-shaped emptiness. Ask: what does a SUCCESSFUL-but-blind run look like, and is it byte-identical to a true zero?"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d3982f37-f46f-4cd4-9026-ddbee892ab02
---

# Exit 0 + empty is not a measured zero

Found while reviewing nanoclaw#1160 ([[project_nanoclaw_1160_empty_state_torn_publish]]), whose
safety rested on the printed premise *"a host/DB failure would have failed the list instead of
returning it empty."*

**Why:** that premise is the standard one and it is nearly always **partly** true. Real failures
(socket dead, `ok:false`, sqlite throw) did map to non-zero exits — I verified all three. What
breaks it is a **skip-on-missing-input** path *upstream of the error machinery*:

```ts
// tasks.ts:108-110
if (!fs.existsSync(inboundDbPath(...))) return undefined;   // not an error — an omission
// tasks.ts:289-292
if (sessionRows) rows.push(...sessionRows);                  // no else, no marker, no count
```

An input the process **never opened** contributes nothing and raises nothing. The envelope is
`ok:true`, `data:[]`, exit **0** — *byte-identical* to a true zero. Exit 0 means "no rows in the
inputs I successfully opened," never "there are no rows."

⭐⭐⭐ **The diagnostic question, which is not "can it fail?":**
**what does a SUCCESSFUL-but-BLIND run look like on the wire, and can I tell it from a true zero?**
If the answer is "identical", the exit code is not a measurement and no amount of correct
error-handling elsewhere fixes it. Enumerating failure modes finds none of these, because a skip
is not a failure mode.

⭐⭐ **Corollary — a consistency check cannot substitute.** `--check` there verified the two
published files agreed with each other; an *empty* pair is perfectly self-consistent, so it returned
0 and blessed the wipe. **Internal consistency is orthogonal to correspondence with reality.**

⭐⭐ **Corollary — a compensating warning that reads the PRIOR state inherits its own failure
modes.** The wipe warning required parsing the previous snapshot's `task_count`; corrupt / absent /
key-renamed all silently produced `previous = 0` and **no warning** — the loud control goes quiet in
precisely the degraded conditions that make the wipe likely. I found this by varying **only** the
prior artifact and tabulating, which is cheaper than reasoning about it.

✅ **How to apply:** when code treats emptiness as authoritative, make emptiness **asserted, not
inferred** — require an affirmative empty envelope (`{ok:true,data:[]}`), and treat unparseable /
`ok:false` / non-dict bodies as failure **even at exit 0**. Better, fix the API so it can express
partial success (a `skipped` count); a reader cannot recover a distinction the producer discarded.

⭐⭐⭐ **Strongest evidence is usually already in the repo.** The same file's `get` path checked the
payload rather than the exit code, and a sibling script (`kb-doctor.py:169-176`) stated the rule
outright — *"absence has to be ASSERTED by the application layer, never inferred from a failed
process"* — in a comment recording this exact bug class biting once before. ⇒ **Before writing a
finding as a general principle, grep the repo for the codebase's own statement of it**: it upgrades
"reviewer's opinion" to "your own documented invariant, violated in one place", and it costs one
grep. Related: [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]].
