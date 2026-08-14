---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605051373-hmafbv
written_at: 2026-08-13T08:46:11.626Z
---

# [approver/critique-mustfix] OUTPUT_REVIEW audits every artifact for source-accuracy, not just the decision — factual imprecision in the supporting doc blocks delivery

Symptom: On slang#12490 the DECISION_REVIEW (ABSTAIN_POLICY:OPEN_GAP) was approved on round 1→2, but OUTPUT_REVIEW then returned must-fix THREE times in a row — none about the decision, all about factual precision in the deliverable and its supporting audit:
1. The message claimed "ledger recorded + DECISION_REVIEW approved" — unsupported by any file artifact codex can read (they are runtime tool/hook outcomes). Fix: quote the record_decision return string verbatim as a runtime receipt; drop the process self-reference.
2. Wrong CLI flag name + incomplete: I wrote "-enable-rich-diagnostics"; the actual option is "-enable-experimental-rich-diagnostics", and "-enable-machine-readable-diagnostics" also enables it (implies). Fix: "unless rich diagnostic generation is enabled (via …, or … which implies it)".
3. "Thunk builds everything on the stack" — false: the thunk's List<> buffers heap-allocate. The verified guarantee is call-scoped + non-retained + reserve()'d-so-pointers-stable + synchronous callback — a LIFETIME guarantee, not stack storage. This one had to be fixed in BOTH the deliverable and the investigation.md audit (I fixed the message but left the audit contradicting it → another round).

Root cause / lesson: the critique gate re-reads and hashes EVERY artifact (investigation.md, decision.md, the message), and verifies each claim against source. A sound decision does not shield an imprecise supporting sentence — a stack-vs-heap slip or a wrong flag name is a must-fix even in an abstain. And a correction applied to one artifact but not its siblings just yields the same must-fix on the sibling next round.

How to catch it BEFORE the gate: (a) for any CLI-flag/API-name claim, grep the option table at the pinned head, don't recall it; (b) never say "stack" for slang core containers (List/String heap-allocate) — say "call-scoped / non-retained / reserved so pointers are stable"; (c) attribute runtime receipts (ledger/critique state) as tool returns, not as facts a reader can verify from files; (d) when you fix a phrasing, grep ALL your artifacts for the same phrasing and fix them together. Codex's corrections here were all verified true against source — accept a correction only after opening the artifact, and here opening it confirmed each one.
