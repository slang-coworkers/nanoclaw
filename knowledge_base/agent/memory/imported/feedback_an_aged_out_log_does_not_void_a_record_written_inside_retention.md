---
name: feedback_an_aged_out_log_does_not_void_a_record_written_inside_retention
description: "Before marking an occurrence \"unverified, logs past retention\", grep your own chain memos and re-fetch check-run metadata — both outlive the log window. Recovered the 208 error code for the 07-19 slang-rhi flake row."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **"The logs are past retention" bounds ONE artifact, not the evidence.** Two things routinely
outlive a CI log and were both still available for a row published as **"unverified — could be a
different failure"**:

1. **Check-run / check-suite METADATA.** Measured 2026-08-07 for a 2026-07-19 failure: check-suite
   `80331363618` still resolves at head `eccfc77a073250bc01b4b73898759b860710d237`, and check-run
   `88133870031` = `conclusion:failure` @ `2026-07-19T00:11:51Z` on exactly
   `test-windows-debug-cl-x86_64-gpu / test-slang`. So *"that leg really failed, then"* is
   **re-confirmable today**. What metadata does **not** carry is the payload — annotations gave only
   `"Process completed with exit code 1."`, and `output.title/summary/text` were empty.
2. **My own contemporaneous chain memo**, written while the log was live.
   [[project_12154_relocate_slang_test_outputs]] records the payload verbatim: single failing test
   `sharedBufferD3D12ToCUDA.internal`, `CUDA_ERROR_ALREADY_MAPPED (208)`,
   `external/slang-rhi/src/cuda/cuda-heap.cpp:395`, 11264/11265 passed, retried and still failed.

⇒ The row was **not** "could be a different failure": leg-level failure re-verified from GitHub,
error code supplied by the memo. Confirmed occurrences **1 → 2**.

⭐⭐⭐ **State the two provenances SEPARATELY, because they are not equally strong.** The leg failure is
a re-fetchable artifact; the `208` is a **memo claim** — recorded from the live log inside retention,
but no longer independently re-derivable. Collapsing them into one "verified" overstates exactly the
weaker half. ⚠️ Do not silently promote the memo to artifact status just because the *conclusion* is
right (the failure mode of [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]).

⛔ **DERIVED-FIGURE FENCE.** That same memo also says *"master intermittently red on this workflow
(2 of 3 recent runs)"* — a statement about the **WORKFLOW**, not this test. Reusing it as a rate for
**this signature** would be the wrong-scope error: right about what it names, wrong about what it
covers. A recovered occurrence raises the **count**; it licenses **no rate**.

⚠️ **ID-TYPE TRAP that cost me a false 404:** my memo wrote *"suite `80331363618`"* and I first probed
`/actions/runs/80331363618` → `404 Not Found`. It is a **check-suite** id: `/check-suites/<id>` and
`/check-suites/<id>/check-runs` resolve fine. **A 404 from the wrong endpoint is indistinguishable
from a deleted object** — positive-control the endpoint against a known-good id of that type before
concluding "gone". Same instrument class as [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

✅ **GUARD:** before publishing *"unverified / logs unavailable / past retention"* —
(a) `grep -rli <test-name> <memory-roots>` for a contemporaneous record, and
(b) `gh api repos/<o>/<r>/commits/<full-sha>/check-runs` for the leg conclusion. **Use the FULL sha**:
a truncated `head_sha` filter returned `total_count:0` where the full one returned `14` — a silent
false negative that reads as "expired". Sibling lesson from the same artifact:
[[feedback_a_rerun_in_flight_is_not_a_rerun_that_cleared]].
