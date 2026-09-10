---
name: feedback_i_read_the_denying_hook_and_missed_the_denial
description: "4 wrong gate diagnoses in one evening — the cause was a `sandbox: read-only` param denied by force-codex-sandbox.sh (exit 2 = no PostToolUse at all). I READ that hook and reported only 'it never rewrites tool_input', the true-but-irrelevant half"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# I opened the file containing the answer and reported the irrelevant half of it

**slang#12330, 2026-08-06.** Four consecutive wrong diagnoses of one gate failure, all mine, each
internally coherent. The true cause was found by slang-fixer reading **the skill's own instructions**:
it passed `sandbox: "read-only"` on every direct `mcp__codex__codex` call, and
`/app/hooks/force-codex-sandbox.sh` **denies** anything that isn't `danger-full-access` with `exit 2`.

⇒ **`exit 2` on a `PreToolUse` hook means the tool call never executes**, so there is no `PostToolUse`
event, so `track-critique.sh` never runs, so `developer-instructions` never reaches it. Everything
downstream was a study of a hook that had never been invoked.

## ⛔ The part that is mine: I read that hook and drew the wrong conclusion

I opened `force-codex-sandbox.sh` in full, to eliminate it as a candidate, and reported upstream:

> *"the only `PreToolUse` hook on `mcp__codex__codex` is `force-codex-sandbox.sh`, and I read it in
> full — it inspects `.tool_input.sandbox` and either exits 0 or exits 2. **It never rewrites
> `tool_input`**, so nothing on the hook path strips the field."*

**Every clause is true.** And the question I was answering — *does anything strip the field?* — was the
wrong question. The hook doesn't strip the field; **it prevents the call.** I even wrote "exits 0 or
exits 2" without asking what `exit 2` *does*. ⇒ ⭐⭐⭐**Reading the artifact is not the same as
interrogating it: I extracted the feature I was hunting for and stepped past the feature that
mattered.** A search with a hypothesis reads for confirmation of that hypothesis; the file answered a
question I hadn't asked.

## The four wrong diagnoses, and what actually discriminated

| # | my diagnosis | killed by |
|---|---|---|
| 1 | `workflow-state-reset.sh` zeroes the counter on every router envelope | key-count: `do_reset` writes 11 keys, no edge had them |
| 2 | cross-session sharing lets a sibling satisfy the gate | `findmnt` — `/workspace` is per-**session** |
| 3 | `head -c 500` truncates the `STAGE:` token | fixer measured the token at **byte 0**; and the receipt interpolates `$STAGE`, so a receipt naming a stage proves the pin ran |
| 4 | the pin never ran / rejects valid text | the call was **denied upstream**; no `PostToolUse` ever fired |

⭐⭐⭐**All four were source-reads. All four lost to measurements.** Standing correction:
**reading source tells you what CAN happen; only measurement tells you what DID.** And the operational
form the triager derived, which would have killed #3 and #4 in one step: **when you author a mechanism,
name the single measurement that would kill it and ask for that first.**

## ⭐⭐ The fixer's self-diagnosis is the transferable one

> *"I read the hook's source repeatedly and the skill's instructions once, carelessly — the answer was
> in the shorter document."*

Its isolation tests were all **valid and all beside the point**: it tested the text, the truncation, the
greps, the `jq` round-trip — **but never the call's own parameters against the skill's stated
contract.** ⇒ ⭐⭐⭐**Before debugging a tool's downstream, check your invocation against the tool's
documented contract.** The cheap document is the one nobody re-reads.

## ✅ What the refusal bought

Both coworkers declined `CRITIQUE_PIN_INSTRUCTIONS=0` — the documented bypass — on the grounds that a
self-cleared gate writes a falsehood into an audited artifact. **Had either taken it, the real cause
would never have surfaced**, the reviews would have been recorded as "gate satisfied", and a
`read-only` sandbox param would still be silently voiding every direct critique call in the fleet. ⇒
⭐⭐⭐**A refusal to bypass a broken control is what makes the control diagnosable.** With the parameter
fixed, all three stages recorded immediately (`PLAN_REVIEW`/`CODE_REVIEW`/`OUTPUT_REVIEW` = approve),
no pin disabled, nothing weakened.

⚠️**Two defects I escalated remain real and independent of this:** the verdict-vocabulary mismatch
(`track-critique.sh:92-97` accepts only `approve|must-fix`; the skill requests APPROVE/MINOR/MAJOR) and
the unanchored Bash-branch marker match (`gate-critique-on-deliver.sh:81`, which blocks `git commit -m
"note: gh pr create …"`). Both confirmed at source. **Withdraw the transit hypothesis; keep those two.**

## Related

[[feedback_a_count_can_answer_a_different_question_than_you_asked]] ·
[[feedback_a_shared_conclusion_stops_the_mechanism_audit]] ·
[[feedback_critique_gate_state_is_container_scoped_not_session_scoped]] (the three retractions) ·
[[project_12330_entrypoint_throws_not_diagnosed]]
