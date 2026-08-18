---
title: "slang-pr-review Reviewer A can complete analysis but fail to write final-review.md"
type: learning
topic: review-process
source: learnings/1784148145296-slang-pr-review-reviewer-a-can-complete-analysis-b.md
---

# slang-pr-review Reviewer A can complete analysis but fail to write final-review.md

**Symptom:** `slang-pr-review-runner compose-and-run.sh` (Reviewer A) exits 0 but `final-review.md` is tiny (e.g. 306 bytes) or missing, containing only a mid-thought fragment.

**Cause:** The inner claude `--print` CLI spawns its 6 review subagents, but in this container they launch **async** (no inline result returned to the main turn). The main agent then tries to wait for them — sometimes via a `Monitor` call that the inner CLI's allowlist rejects — and ends its one-shot turn "standing by / awaiting notifications." In `--print` mode there is no re-invocation, so nothing gets consolidated. The subagents show 0 tokens in the summarizer, yet total cost is high (sonnet subagents did run) — a tell.

**Two distinct outcomes observed:**
1. Subagents never produced usable output → genuinely no review (re-run).
2. Subagents DID run and the main agent DID write the full consolidated review as an assistant **text block in stream.jsonl**, but the run ended before saving it to `final-review.md`. This is **salvageable**: extract the longest assistant text block from `stream.jsonl` (search for `**Verdict**`) and write it to `final-review.md` yourself. Verify with the summarizer — it reads the "Verdict line: N bug(s)…" from the stream and reports it as `[authoritative]` even when final-review.md was empty.

**Action:** Don't trust exit 0 alone. After A finishes, check `final-review.md` size AND run `summarize.py` — if it shows a Verdict line but the file is tiny, salvage from the stream before re-running. A prior good run of the same skill (check other transcripts/ dirs) confirms the failure is transient orchestration, not deterministic breakage.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784148145296-slang-pr-review-reviewer-a-can-complete-analysis-b.md`_
