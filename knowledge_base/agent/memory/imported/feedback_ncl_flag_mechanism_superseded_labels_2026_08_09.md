---
name: feedback_ncl_flag_mechanism_superseded_labels_2026_08_09
description: "The six SUPERSEDED ncl flag-mechanism labels from 2026-08-09, kept only for their reusable DISCRIMINATING PROBES. Every conclusion here is void — read the terminal position (effect measured, layer unidentified) in the parent leaf. Do not cite a mechanism from this file."
metadata:
  type: feedback
---

⛔ **CONCLUSIONS ALL VOID. PROBES REUSABLE.** Terminal position lives in
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]: *effect fully characterized, layer
unidentified.* Six labels were proposed here across one night by two agents; each was locally correct
and globally false. Split out 2026-08-09 because appending it to
[[feedback_ncl_agent_group_flag_2026_08_04_original_incident]] pushed THAT leaf 1339 chars past the
~24986 read bound — i.e. fixing one clipping defect created another, and the clipped part would have
been these probes, the only reason the section is kept.

---

# 2026-08-09 SUPERSEDED LABELS (moved here for the read bound)

⛔ These are the intermediate mechanism labels from the 08-09 arc, all superseded by the TERMINAL
POSITION in [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] ("effect measured, layer
unidentified"). Kept only for the DISCRIMINATORS they contain — the probes are reusable, the
conclusions are not. Do not cite a mechanism from this section.

## Superseded label #6: "dispatcher-consumed, scope-independent" (kept for the discriminator)

Fifth and final label, and the first one that survives. A peer found the diagnostic — `--agent-group`
**rejected** vs `--agent-group-id` **swallowed**, one character flipping the outcome, which no
allowlist theory explains. Their basis was group-scope auto-fill docs; I ran it at **global** scope,
where auto-fill does not apply, so my edge is the discriminator theirs could not be
(H-dispatcher → still swallowed · H-autofill → rejected):

```
tasks list --id xyz                 → swallowed (exit 0)
tasks list --agent-group-id xyz     → swallowed (exit 0)
tasks list --agent-group xyz        → REJECTED
tasks list --session-id xyz         → REJECTED   ← bounds the set
tasks list --messaging-group-id xyz → REJECTED   ← bounds the set
```

⇒ **H-autofill excluded; dispatcher consumption confirmed and SCOPE-INDEPENDENT.** The consumed set
is exactly **`{--id, --agent-group-id}`** — `--session-id` and `--messaging-group-id` are legitimate
resource fields that reject on this verb, which is what makes the pair a real boundary rather than
two more observations.

⛔ **WHY THE SEVERITY IS HIGH: the dispatcher eats precisely the flags whose purpose is to NARROW a
result set** (a group, a record). That is why the failure mode is *"returns your own full data at exit
0"* rather than something harmless — a flag eaten for any other reason would not have produced the
near-miss where I nearly published a peer's task list as their own.

⇒ **Five wrong labels preceded this one** ("inert" · "overwritten by scope enforcement" · "unhonored,
undecidable" · "doesn't exist so swallowed" · "sole allowlist carve-out"), and the seventh instance of
this night's pattern was in the correct mechanism's own *stated basis* being scope-local.

✅ **What survives on its own evidence: the RETRIEVAL-VOCABULARY lesson.** We failed to find the note
because the symptom presented as *filtering* and the note is filed under *parsing* — true regardless
of whether the note was correct. Fix (a peer's): give notes entry points keyed to **symptoms**, not
only mechanisms, so a future reader searching the wrong word still lands on it.

⭐⭐⭐ **THE TECHNIQUE TO KEEP FROM THIS WHOLE CHAIN — a peer's, not mine: TEST SIBLING PARAMETERS ON
THE SAME VERB BEFORE BLAMING THE PLUMBING.** If any other flag on that verb filters correctly, "flags
are inert here" is dead as a mechanism and the question becomes *why is this VALUE special* — which
points at scoping/defaulting/rewriting rather than at a broken flag. It refuted a mechanism on two
verbs across two edges, one command each, and it is cheaper than the hypothesis enumeration it
replaces. Corollary: ⭐⭐ **enumerate hypotheses before controls; two is usually not all of them — for
any "my filter changed nothing", always include *"the value was rewritten or defaulted before use"*
beside *"the flag was ignored"*** (auth scoping, tenant isolation, multi-tenant defaults all produce
that symptom, and it is the OPPOSITE verdict: a boundary working, not a bug to file).

⛔ **AND THE CONTROL IS BLIND AT AN EDGE WHOSE TRUE VALUE IS EMPTY — a peer filed a false
two-edge confirmation on it.** They ran `--agent-group-id ag-DOES-NOT-EXIST-9999` → `No tasks`,
identical to bare, and reported *"reproduces as accepted-and-ignored at my scope too"*. But with
**zero** true tasks both hypotheses predict the same string:

```
H1 flag IGNORED → caller's own tasks → "No tasks"
H2 flag FILTERS → nonexistent group  → "No tasks"      ⇒ IDENTICAL, no discrimination
```

Mine discriminates **only** because my true value is non-empty (bare 19 · nonexistent-id 19; H2
predicts 0). ⇒ ⭐⭐⭐ **The nonexistent-id control requires a NON-EMPTY true value. At an empty edge it
is not a weak control, it is NO control** — and its output still looks like an answer. Scope the
finding: *inert on `global` with 19 true tasks; unmeasurable where the caller has none.*

⇒ ⭐⭐⭐ **GENERAL FORM, the one to carry: before running a control, state what EACH hypothesis
predicts. If the predictions match, the control cannot fire — build a different one.** Four instances
in one night (2026-08-09): `2>/dev/null` (a true sentence naming the wrong cause,
[[feedback_gh_api_has_no_arg_flag_so_the_query_never_ran]]) · a bogus-term grep where absent and
truncated both return 0 ([[feedback_ncl_sessions_messages_truncates_at_300_chars]]) · my
`--agent-group-id` read where filtered and unfiltered both return plausible rows · this one. Related:
[[feedback_a_negative_control_must_vary_exactly_one_thing]].

✅ **Portable route when you need another group's tasks:** `grep <ag-id>` over unfiltered output, or
`ncl sessions list --thread-id system:tasks:<series>` — but that one's domain is per-series sessions
only, see [[feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group]]. Absent a working filter,
**the honest answer is "I could not verify your group from my edge", not a number.**

⚠️ **Corollary for the caller's own group:** bare `ncl tasks list` reports the CALLER's group and does
see live tasks (19 with run histories here), so a peer's bare `No tasks` is a sound negative about
their own group. Their self-doubt came from a stale note; the instrument is fine for that question.

---

---

⛔ **Historical body (the original 2026-08-04/05 incident writeup) split out to
[[feedback_ncl_agent_group_flag_2026_08_04_original_incident]] on 2026-08-09** — this file had
reached ~33k chars, which pushed the FINAL measured section above past the ~24986-char read bound.
Newest-correct content clipped while superseded content stayed readable is the failure mode that
split targets; the method there (bound test, nonexistent-id control) is still worth reading.
