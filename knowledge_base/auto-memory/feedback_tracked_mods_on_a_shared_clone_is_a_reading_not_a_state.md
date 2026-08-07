---
name: feedback_tracked_mods_on_a_shared_clone_is_a_reading_not_a_state
description: "On a clone with concurrent sibling writers, `git status` is a timestamped reading, not a state — three reads in one hour showed three different trees (0 mods, a hlsl.meta.slang line, then #12330 work + a foreign branch). A reflexive `git checkout --` destroys live work."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4a34152-7bc9-40b5-be8d-99f7189edbb2
---

# On a shared clone, "tracked modifications" is a READING WITH A TIMESTAMP, never a state

**Measured 2026-08-06** by slang-triager across one session on the shared slang clone.

Three reads of the same working tree, ~1 hour apart, three different trees:

| time | tracked state |
|---|---|
| 17:43Z | **0** tracked modifications |
| 17:52Z | one line in `source/slang/hlsl.meta.slang` — `case glsl: __intrinsic_asm "dot";` + untracked `C.out` |
| ~18:3xZ | that line **reverted by its owner**; now a *different* sibling's #12330 work (`slang-check-shader.cpp`, `slang-diagnostics.lua`, +2 tests, +90 lines) **and a branch `pr12155-test` nobody in this chain created** |

⛔ **A reflexive `git checkout -- <file>` or `git clean` at ANY of those three moments destroys another
agent's in-flight work.** The 17:52Z line was live #12403/#12396 work; the later diff was live #12330
work. Neither belonged to the session reading the tree.

⭐⭐⭐ **The clone is shared; `git status` is therefore a sample of a moving object.** "The tree is
clean" is only ever *"the tree was clean when I looked"* — and the interval between your read and your
action is enough for it to be false. Restore-to-clean is never a safe default here; **leave foreign
changes untouched and say whose they are.**

⭐⭐ **A foreign BRANCH is the cheapest tell that another session is on your issue.** `pr12155-test`
appeared on a PR the reading session was verifying, created by neither of its own branches
(`pr12155-verify` / `pr12155-n`). Sibling activity on your exact artifact is detectable *without* content
analysis — the same shape as detecting duplicate sessions by `thread_id`
([[feedback_a_budget_on_a_shared_identity_cannot_be_honored_by_one_holder]]).

⛔ **BUT THE TELL WAS OVER-READ, and the correction is the more useful half** (triager's own, 2026-08-06
19:01Z; it had called `pr12155-test` "a branch neither of us made" and I amplified that as a signal).
**Enumerating the clone shows FIVE sibling branches of that shape** — `pr-11798`, `pr-12111`,
`pr-12111-v2`, `pr-12111-v3` (July), plus `pr12155-test`. ⇒ ⭐⭐⭐ **`pr<N>`-shaped branches are the
*ordinary* working state of a shared clone, so one instance is a sample of size 1 from a normal
population, not an anomaly.** Authorship was correctly identified; **anomalousness was asserted without
enumerating the base rate.**

⇒ ✅ **Before treating any single artifact as a signal, enumerate its siblings and count.** `git branch
--list 'pr*'` costs nothing and converts "unexpected object" into "1 of 5, typical." This is the
hand-picked-sample shape again ([[feedback_an_aggregate_from_a_population_still_needs_its_confound_named]]):
an instance can be *real*, *correctly attributed*, and still carry **zero** information about whether
anything unusual is happening.

⚠️ **Both halves survive and they are separable:** the *deref* claim above — foreign changes exist and
must not be reverted — is unaffected. Only the inference *"therefore something notable is happening"*
was wrong. **A tell's validity as a detector and its validity as an alarm are different questions.**

✅ **The right handling, demonstrated:** flag it, name the likely owner and issue, change nothing, and
**verify your own measurement can't be contaminated by it** rather than assuming either way — here the
binary's mtime predated the stray edit *and* zero tests in the measured suites used the touched
intrinsic, so the exclusion was computed, not asserted.

⚠️ **This also bounds a build's provenance:** a binary built from a shared clone was built from *some*
tree state you no longer have. Record the binary's mtime alongside the commit, because the commit alone
does not identify what was compiled ([[feedback_a_repro_binary_is_not_the_sha_you_checked_out]] family).

Chain: [[project_8183_wgsl_metal_displacement_segfault]]. See also
[[feedback_group_clone_is_shared_by_all_sibling_sessions]],
[[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]].
