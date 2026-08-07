---
name: feedback_zero_test_jobs_is_not_zero_tests_ran
description: A CI job-name sweep cannot see a test STEP; "0 jobs named test" is not "0 tests ran" — confirm absence at the step list, not the job list.
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-slangpy-820-fanout
---

MEASURED 2026-08-05, shader-slang/slangpy. I **publicly disproved a true claim** and asked a peer
to retract it. The peer refused, showed receipts, and was right.

**What I did.** A scrub comment on #768 cited CI run `31010713264` as evidence that four tests
`PASSED [DeviceType.cuda]`. I checked:

```
gh api repos/.../actions/runs/31010713264/jobs --jq '.jobs[]|"\(.conclusion)  \(.name)"'
→ 12 jobs, ALL named "build (...)", 0 named test, 0 named cuda
```

I widened it — `ci-gcp` (the GPU workflow) has **zero runs ever**; `slangpy_torch` last ran
2026-04-20 and **failed**. Conclusion drawn: no CUDA execution exists in this repo's CI, so the
claim is phantom. I then wrote to the peer that the disproof was independent and asked for a
correction, and told the operator I was "holding the relay of a CUDA claim I've already disproved."

**Why it was wrong.** ⛔ **The tests run as STEPS INSIDE the build jobs.** One API call at the
job level shows it:

```
gh api repos/.../actions/jobs/92321865219 --jq '.steps[]|"\(.conclusion) \(.name)"'
→ ... 18. Typing Checks (Python) / 19. Unit Tests (C++) / 20. Unit Tests (Python) ✓
labels: Linux,X64,nvrgfx-kernelvm-bridge     ← self-hosted, GPU-backed
```

Verified in the job log myself afterwards: all four cited verdicts present verbatim as `PASSED`,
`test_raw_dispatch` **31/31 PASSED**, and 3,619 `DeviceType.cuda` / 4,121 `DeviceType.vulkan`
occurrences — matching the peer's numbers exactly.

⇒ ⭐⭐⭐ **"0 jobs named `test`" and "0 tests ran" are as different as "the message arrived" and
"the work happened"** — the same delivered-vs-executed distinction I had recorded *hours earlier*
in [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]], re-encountered from the
other side and missed. **A granularity mismatch between instrument and claim produces a confident
false negative:** my query enumerated jobs; the claim lived in steps.

**Why it felt airtight — the trap worth remembering.** The negative had every marker of rigor:
12/12 jobs enumerated (not sampled), no `cuda` substring anywhere, *and* two corroborating
findings (`ci-gcp` never ran, `slangpy_torch` failed). Both corroborations were **true and
irrelevant** — GPU tests ride inside `ci`, not in a separate GPU workflow. ⭐⭐ **Piling on true
adjacent facts does not repair a wrong-granularity probe; it disguises it.** Breadth of evidence
is not depth of evidence.

**How to apply:**
- To claim **no tests ran**, read a job's **step list** (`actions/jobs/<job-id>` → `.steps[]`),
  not the run's job names (`actions/runs/<id>/jobs` → `.name`). One call, and it's decisive.
- Better: verify the **positive** directly — fetch `actions/jobs/<id>/logs` and grep the asserted
  verdict lines. A claim of the form "test T passed on device D" is checkable verbatim; do that
  instead of inferring absence from topology.
- ⛔ **A confident disproof of a peer's specific, checkable claim deserves the same adversarial
  pass as a positive finding** — ask *"what would make my negative wrong?"* before publishing it.
  Here: "could tests run somewhere other than a job named `test`?" Asking it once was enough.
- The asymmetry that makes this expensive: my disproof was **published to a peer as a correction
  request and to the operator as a disproof**. A wrong positive gets checked by others; a wrong
  negative arrives wearing diligence and *closes* the inquiry. See
  [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]] and
  [[feedback_no_evidence_names_where_you_looked]].

**Peer method worth copying** (it beat mine): they reproduced my job-name result *exactly*, agreed
with it, then located the granularity gap rather than arguing; published the raw log lines, a
non-zero control, and the job ids; **refused the remedy whose precondition was false**; and
declined to edit another session's artifact, flagging it instead. Also corrected the claim in the
*less* favourable direction where warranted — Vulkan is 15, not 16, since the torch test doesn't
parametrize there.

**Second lesson from the same exchange — provenance.** I attributed the #768 comment and a #844
retraction to *the session I was talking to*. Both came from **sibling sessions** I can't see. I
built "you retracted this 40 minutes ago, then contradicted yourself" — an inconsistency argument
resting on identity I never checked. ⭐⭐ **`nv-slang-bot[bot]` is a shared identity across many
sessions; a GitHub comment's author does NOT identify the session that wrote it.** Attribute by
asking, or say "a sibling session posted X". See
[[feedback_group_clone_is_shared_by_all_sibling_sessions]].

## FOUR instances in one session — this is a class, not an incident

Same defect, four different instruments, each looking airtight:

| # | instrument | pattern | what it missed | false result |
|---|---|---|---|---|
| 1 | `runs/<id>/jobs` → `.name` | job names | tests are **steps** | "0 tests ran" |
| 2 | grep `[DeviceType.cuda]` | device token | skip renders **`[NOTSET]`** (parametrization collapses with no CUDA device) | test "absent" not skipped |
| 3 | grep `[a-z_]+\[DeviceType\.` | test id | **seed-parametrized** ids `test_x[1-DeviceType.cuda]` | 4 verdicts, actual **44** |
| 4 | grep `loadOnce` | issue's vocabulary | library ships **snake_case** `load_once` | "not implemented" |

⇒ ⭐⭐⭐ **A SCAN WHOSE PATTERN IS NARROWER THAN ITS SUBJECT RETURNS A CONFIDENT FALSE ZERO.**
Four cases, three instruments of mine and one a peer's, all in ~2 hours on one batch. **This has
enough instances to hold as a rule, unlike a single-case recipe** (see the evidence-base banner
discipline). The tell is always the same: the query is *well-formed and complete over the wrong
domain* — 12/12 jobs enumerated, every `[DeviceType.*]` matched, every `[a-z_]+` id captured.
Completeness over the wrong set reads exactly like completeness.

**Countermeasure, cheap and general:** before believing a zero, ask **"what shape could the thing
I'm looking for take that my pattern excludes?"** — then widen once (`[^ ]*` not `[a-z_]+`, step
list not job list, both casings) and confirm the count *changes*. And keep a **non-zero control**
in every scan, which is what caught #3.

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_publish_a_claim_as_wide_as_your_evidence]] ·
[[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[slang-slangpy-tooling-chains-index]]
