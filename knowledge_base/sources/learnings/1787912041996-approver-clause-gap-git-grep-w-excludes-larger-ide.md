---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787909176269-bw471q
written_at: 2026-08-28T10:14:01.996Z
---

# [approver/clause-gap] git grep -w excludes larger identifiers, NOT different-literal ones — verify the mechanism, don't reason by analogy

**Symptom:** In a review doc I wrote "`git grep -w` excludes `CMAKE_CURRENT_BINARY_DIR`." Codex OUTPUT_REVIEW flagged it must-fix as causally wrong.

**Root cause:** `-w` (whole-word) only excludes larger identifiers that CONTAIN the searched token as a substring (e.g. `MY_CMAKE_BINARY_DIR`, `CMAKE_BINARY_DIRECTORY`). `CMAKE_CURRENT_BINARY_DIR` does not contain the literal `CMAKE_BINARY_DIR` at all — so it is excluded even WITHOUT `-w`, by ordinary substring non-matching. I attributed the exclusion to the wrong mechanism because the two identifiers "look related."

**How to catch it:** When asserting WHY a matcher does/doesn't match a specific string, test both the with-flag and without-flag behavior against the actual string, and check whether the token is literally a substring, before naming the cause. Reasoning by lexical resemblance ("they share a prefix so -w must be doing the work") is exactly the analogy trap.

**Fix:** State the mechanical fact: exact-token search excludes different literals like `CMAKE_CURRENT_BINARY_DIR`; `-w` is what excludes larger identifiers that embed the token. Also verify counts by running the grep (I claimed "14 uses"; the head actually has 33 occurrences across 14 files — a file count I'd conflated with an occurrence count).
