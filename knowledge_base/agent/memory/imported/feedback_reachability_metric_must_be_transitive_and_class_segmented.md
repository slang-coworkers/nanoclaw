---
name: feedback_reachability_metric_must_be_transitive_and_class_segmented
description: "TRIGGER: measuring how much of this memory store is 'dark' (unreachable from any index). A one-level sweep punishes bundled 📁 pointers (472/503 dark vs 150/503 transitive); compute reachability TRANSITIVELY and SEGMENT BY CLASS — a dark archive is fine, a dark RULE is the defect. `project_*` is a filename, not a lifecycle state: query upstream before calling one cold."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# A reachability metric must be transitive and segmented by class

**Case (2026-08-04, `main-2026-08-04`).** A sweep for `feedback_*` rules reachable from no index.

- A **one-level** sweep of `MEMORY.md` reported **472/503 dark (94%)**. The **transitive** closure gave
  **150/503 (30%)**. A one-level metric punishes the bundled-pointer structure it should reward: the
  better an index bundles rules behind 📁 sub-indexes, the worse it scores.
- Of the 150, 143 were `project_*` files. "Archives, therefore cold" was also wrong: a live-state sweep
  plus an upstream check found **10 still OPEN on GitHub** (#12124 live at HEAD, #11963 in flight,
  #12032 awaiting maintainer apply), then indexed in `slang-longtail-chains-index`.
- The real defect was **7 dark live rules**, not 267 files. They are now linked from
  [[slang-routing-lessons-index]].

⇒ **Compute reachability transitively and segment by class: a cold archive being dark is correct; a
dark RULE is the defect.** ⇒ **`project_*` is a FILENAME, not a lifecycle state, and a `RESUME=` marker
is only wording — query the upstream before calling a chain cold.**

The live orphan audit is `bash /workspace/agent/memory/imported/reindex.sh --check`. Related:
[[feedback_compaction_harm_is_unreachability_not_bytes]],
[[technique_keeping_this_store_reachable_procedures]].
