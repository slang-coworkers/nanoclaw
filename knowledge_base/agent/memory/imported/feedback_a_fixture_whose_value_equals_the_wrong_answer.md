---
name: feedback_a_fixture_whose_value_equals_the_wrong_answer
description: "An assertion about a value cannot fail when the fixture already holds the likely wrong answer — my GET-ref check used branch='main' against a tamper that hardcoded 'main'. Check the fixture's value before trusting a new assertion's control."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 656c2786-3cde-4c85-b868-17fe8fbc46ce
---

# A fixture whose value equals the wrong answer makes the new assertion a no-op

Measured 2026-08-10 on nanoclaw#1183 ([[project_nanoclaw_1183_error_dict_not_raise]]).

I found that the PR's tests never assert *which ref* the sha lookup reads, and proposed the
two-line fix:

```python
gets = [c for c in calls if c[0] == "GET"]
assert gets and gets[0][2].get("params") == {"ref": ARGS["branch"]}
```

Then I ran the control — assertion added, source tampered to hardcode `{"ref": "main"}` — and it
**passed**. The reason: the test module's `ARGS` has `branch="main"`. The assertion compared
`"main"` to `"main"`. ⭐⭐⭐**The fixture's value WAS the failure mode**, so the check could not
distinguish correct from broken no matter how the code behaved.

Fixed by moving the fixture off the default (`branch="release/1.2"`), after which the 3-way
control worked: clean `5 passed` / tampered `1 failed` / restored `5 passed`.

## The generalization

⇒ **Before trusting a new assertion, ask what value the fixture supplies and whether the bug you
fear would produce that same value.** Default-ish fixture values (`main`, `0`, `""`, `localhost`,
`true`, today's date) are exactly the values buggy code falls back to, so they are the worst
choices for the field under test.

**Cheapest detector: the assertion must FAIL against the tamper before you publish it as a fix.**
That is the same discipline as [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]'s
*"a control that fires by luck is not a control"* — here it did not even fire; it agreed by
coincidence and read as confirmation.

⚠️ Sharper still: I nearly published the *finding* (suite is blind to the ref) together with a
*fix* that was equally blind. The finding was true — verified by a separate probe printing
`params = {'ref': 'refs/heads/main'}` when `release/1.2` was requested. **A true finding paired
with an inert remedy is how a reviewer hands the author a no-op and calls it coverage** — same
shape as [[project_nanoclaw_1169_fixture_not_verbatim]], where my proposed one-liner turned the
PR's own suite red and I had the evidence on screen already.

See also [[feedback_a_control_validates_the_instrument_never_the_target]],
[[feedback_a_same_length_source_edit_is_invisible_to_the_interpreter]].
