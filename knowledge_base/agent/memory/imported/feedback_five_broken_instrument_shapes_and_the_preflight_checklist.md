---
type: feedback
name: feedback_five_broken_instrument_shapes_and_the_preflight_checklist
description: "Five ways a measuring instrument fails silently while emitting something shaped like a measurement — two-variable negative control (fake signal), wrong-path positive control (fake void), pipe fallback (absence as silence), keyword search over a corpus you write into (passes, certifies nothing), write that can't tell success from no-op — plus the 5-item pre-flight checklist. Also: a registry entry is a claim about a mapping; open the far end."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# Five broken-instrument shapes and the pre-flight checklist

All five bit both actors (me and the slangpy approver) within two days, slangpy#925 chain,
2026-08-05. Split out 2026-10-15 from
[[feedback_a_negative_control_must_vary_exactly_one_thing]], which holds shape #1 in full.

| # | broken instrument | what it produces |
|---|---|---|
| 1 | negative control varying **two** things | invents a **signal** (fake discriminator) |
| 2 | positive control on a **wrong path** | invents a **void** (fake absence) |
| 3 | **fallback behind a pipe** (`\| head` ⇒ exit 0) | reports absence as **silence** |
| 4 | **keyword search over a corpus you write into** | **passes, and certifies nothing** |
| 5 | **write** whose response can't distinguish success from **no-op** | you build on a change that never happened |

All five fail silently and emit something shaped like a measurement. ⭐⭐⭐ **#4 is the only one
where the control passed and was still worthless.** ⭐⭐⭐ **#5 has the worst blast radius:** a
silent read failure leaves you knowing less than you thought; a silent write no-op leaves you
believing you changed state and scoping further work on top of it (measured: a 49-row backfill
scoped on two calls of unconfirmed effect).

## #2 — a failing positive control means fix the probe, not draw a conclusion

Testing whether `shader-slang/slang-skills` carries the approver skill, the approver's control
query `contents/slangpy-build?ref=main` also 404'd, and it briefly read that as "the repo carries
none of these skills." Real cause: skills live under `skills/`, not the root. ⇒ ⭐⭐⭐ **A path
failure and a content failure are indistinguishable in the status code.** When the control that
must fire doesn't, the only valid next move is to repair the instrument. My own run dodged it only
because I listed the directory first (`contents/` → `agents, skills, …`): **enumerate the container
before addressing into it.**

⚠️ **Refinement — read the body, not just the status.** GitHub returns `"No commit found for the ref
main"` for a wrong ref versus a bare `"Not Found"` for a wrong path. The discriminator was already on
screen; I read the signal I had asked for (status), not the one the tool volunteered (message).
Concrete trap: `shader-slang/slang` defaults to `master`, `shader-slang/slangpy` to `main`, so
`?ref=main` fails silently on one of two sibling repos. ⇒ **When filing an instrument lesson, check
whether the instrument was telling you more than you read.**

## #3 — a fallback behind a pipe never runs

`grep … | head -1 || echo "(none)"`: `head` makes the pipeline exit 0, so the `||` branch never
runs and every no-match prints a blank line that reads as "no note." I was one step from publishing
"none of them self-declare," which would have destroyed a correct peer finding. Sound form:

```bash
hit=$(grep -ioE 'pat' "$f"); echo "${hit:-(none)}"      # ${x:-…} fires on empty
n=$(grep -ic 'pat' "$f"); printf '%s hits=%s\n' "$f" "$n"
```

Cheap habit: point the check at a case you know lacks the pattern and confirm the fallback prints.

⛔ ⭐⭐⭐ **Diagnose an odd-looking instrument before reformatting it** (the approver's meta-lesson).
It hit the same bug a round earlier, wrote "the grep collapsed the output" (a description
masquerading as a cause) and switched constructs. The replacement happened to be sound, so the result
was right by luck of construct choice. ⇒ **A right answer obtained after an unexplained instrument
anomaly is unverified, not confirmed** — re-derive it with a construct you understand.

## #4 — the corpus contains discussion of the artifact

Grepping its own container logs for a host log string (`approval decision joined to human verdict`)
gave the approver an apparent control hit, plus a file matching commit `57259b457b4c`. Both were its
own conversation text echoed into session transcripts. ⇒ ⭐⭐⭐ **A keyword search over a corpus you
have been writing into cannot come out negative for the thing you are discussing.** Falsifier that
settled it: require the **exact machine-emitted literal** (the `store.ts` strings), not a keyword.
Generalizes to transcripts, chat history, memory stores, issue threads — anything you contribute to:
match an exact emitted literal, or search a corpus you don't write to.

## A registry entry is a claim about a mapping — open the far end

Same exchange; it inverted a standing rule. The approver's procedure held "skill present in
`.external-skills.json` ⇒ local edits are ephemeral (a sync reverts them)." The entry was real:

```json
"slangpy-pr-approver": { "repo": "shader-slang/slang-skills", "ref": "main" }
```

But the far end did not carry the skill (mine-verified: 30 upstream skills, no `*-pr-approver`,
`agents/` holds only `spirv-expert`, `skills/slangpy-build` returns `SKILL.md` as a working control).
So nothing upstream matched, nothing would overwrite, and an "upstream PR" had nowhere to land.
⇒ ⭐⭐⭐ **The rule was sound; its precondition was unstated** — "in the registry ⇒ ephemeral" holds
only if the declared source actually contains the item. Matching the name is not verifying the
mapping. **Fix the procedure, not just the conclusion, when a bad precondition is baked into a
standing rule.** Whether the sync tolerates a missing source, prunes unmatched skills, or resolves a
private path was left open, to be settled by a marked-edit-and-wait test. The durability rule itself:
[[feedback_never_edit_externally_synced_skills]].

## Pre-flight checklist (the approver's consolidation, sharpened at item 3)

1. Could this match have come from something **other than the event**?
2. Does my control differ from the positive case in **exactly one variable**?
3. Does the **path** resolve — and if not, does the error name the **ref** or the **path**? Read the
   message body first (free); run a control second. Is my control passing for the right reason?
4. Can the **negative branch actually execute**?
5. For writes: does the response distinguish **success from no-op**, and did I confirm through
   **another channel**?

Related: [[feedback_a_negative_control_must_vary_exactly_one_thing]] ·
[[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]
