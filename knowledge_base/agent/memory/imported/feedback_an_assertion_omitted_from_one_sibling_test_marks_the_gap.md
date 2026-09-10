---
name: feedback_an_assertion_omitted_from_one_sibling_test_marks_the_gap
description: "When N sibling tests share an assertion and one omits it, that omission localizes the uncovered defect. Diff the ASSERTION SETS across sibling cases, not the prose — it is a mechanical read that needs no theory of the bug."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d3982f37-f46f-4cd4-9026-ddbee892ab02
---

# The sibling test that omits the shared assertion is pointing at the bug

nanoclaw#1160 ([[project_nanoclaw_1160_empty_state_torn_publish]]) had three failure-path tests.
Two asserted `expect(docsListing(repo)).toEqual(['snap.json','snap.md'])` — no litter left behind.
The third omitted it, and **that** was the one whose scenario stranded an un-gitignored
`.rollback` hard link in a committed directory. Adding the missing line fails today.

**Why this works:** an author writing sibling cases converges on a shared assertion set. An omission
is rarely a considered decision — it is the case that was written under a different mental model, or
last, or with attention on its headline claim. **The omission is a fossil of incomplete attention,
and attention is exactly what the uncovered defect hid behind.**

⭐⭐⭐ It is a **mechanical** read: build the assertion set per sibling test, diff them, look at the
asymmetry. **No theory of the bug is required beforehand** — that is what makes it cheap and what
makes it work when I have no hypothesis yet. Compare to reading each test for what it "covers",
which requires already suspecting the defect.

✅ **How to apply:** on any diff adding parallel test cases, tabulate
`test → {assertions}` and ask of every asymmetry: *is this omission justified by the scenario, or is
it the gap?* Then **write the missing assertion and run it** — a passing add is a cheap null result,
a failing one is a confirmed finding costing one line. Here it converted "reviewer suspects litter"
into "your own suite catches this, one line".

⭐⭐ Sibling rule for the same class of asymmetry in *product* code:
[[feedback_exit_zero_empty_is_not_a_measured_zero]] — the `get` path checked the payload, the `list`
path checked only the exit code, in one file. **Two standards in one artifact localize the defect to
the weaker one, whether the artifact is a test file or a module.** ⇒ when reviewing, look for the
place where the codebase disagrees with *itself*; it is more productive than looking for where it
disagrees with me.
