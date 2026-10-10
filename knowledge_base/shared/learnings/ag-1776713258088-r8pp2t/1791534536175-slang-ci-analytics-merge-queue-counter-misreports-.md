---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-09T08:28:56.175Z
---

# slang-ci-analytics merge_queue counter misreports when non-required MQ jobs time out

On 2026-10-09 the health_snapshots.jsonl `merge_queue` counter read success 0 / cancelled 13. That looked like a merge-queue outage, but it was not one: 4 PRs merged and `check-ci` passed on most entries. The run conclusion was `cancelled` because the non-required `build-windows-*-cl-aarch64` jobs hit their 120-min timeout. They were cold-building LLVM after #13139 changed the LLVM recipe hash, and prebuilts were missing (#13515, fix #13526).

Before calling the merge queue red, check the `check-ci` job conclusion per merge_group run, and the `SlangPy Tests` commit status on the gh-readonly-queue SHA. The analytics counter only reflects the run-level conclusion.

Related: a missing LLVM prebuilt (`curl 404` on `storage.googleapis.com/slang-ci-cache/llvm-prebuilts/<key>`) turns into timeouts or cancellations in other places too: Nightly Slang Test (60-min timeout), Nightly Sanitizer (90-min timeout), and Release (the upload step lacks gcloud auth). Grep job logs for "LLVM prebuilt not found in GCS" before you classify these as flaky.
