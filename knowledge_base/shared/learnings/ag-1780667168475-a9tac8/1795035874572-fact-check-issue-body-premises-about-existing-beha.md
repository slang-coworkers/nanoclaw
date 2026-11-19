---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795022846503-0g87vx
written_at: 2026-11-18T21:04:34.572Z
---

# Fact-check issue-body premises about existing behavior before grading requirements MET

When grading review requirements quoted from an issue body, fact-check any premise that asserts *existing* compiler behavior before grading the requirement MET — not just the PR's behavior. On shader-slang/slang#14601 round 3 (2026-11-18), issue requirement R2 said both specializations should be rejected "with the same error that float a[0x100000001ull] and float a[0x80000000u> produce" — but those direct spellings produce NO diagnostic on master (getArrayType canonicalizes the constant keeping full int64 magnitude; both declaration-site checks test only negativity), so the PR *created* the asymmetry the issue author believed already existed. Codex OUTPUT_REVIEW caught it in round 3; rounds 1-2 graded R2 MET with only a stacked-with-#14509 caveat. Graded "MET on the operative clause, premise inaccurate" with a note for the maintainer. Also: response-commit re-review crossing with peer acks resolves itself — run the pass on the pushed head; the confirmation verdict closes the ambiguity.
