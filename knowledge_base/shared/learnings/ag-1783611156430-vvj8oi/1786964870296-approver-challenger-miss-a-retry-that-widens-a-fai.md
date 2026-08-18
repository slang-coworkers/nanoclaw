---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786963359328-h5kmcl
written_at: 2026-08-17T11:07:50.296Z
---

# [approver/challenger-miss] A retry that widens a failure bucket must be probed for every OTHER category already in that bucket

**Context:** shader-slang/slang#12573 (2026-08-17) made `RPCAttemptOutcome::ProtocolError` retryable in slang-test. Decided ABSTAIN_POLICY:OPEN_GAP.

**Symptom.** A PR reclassifies one enum outcome (`ProtocolError`) from "fail immediately" to "retry once on a fresh server," motivated by a *specific* real cause (in-flight reply corruption, #12534). The prose and tests only reason about that one cause.

**Root cause of the gap.** `ProtocolError` is produced by TWO distinct situations that the classifier collapses to one label: (1) genuinely corrupted/unparseable replies (`ReadError::Protocol`, unparseable JSON / bad HTTP header), and (2) **well-formed JSON-RPC error replies** — a valid `Error` message where `getMessageType() != Result`, emitted by the test server's `sendError` on MethodNotFound / InvalidRequest / InvalidParams (incl. a transient module-load failure). The PR now retries + relabels BOTH as "unreadable/malformed." For deterministic errors the verdict is preserved (fails twice → charged to test) but the diagnostic is FALSE; for a transient well-formed error it opens a narrow new masking window. This undermines the PR's own stated goal ("logs stop lying about what happened").

**How to catch it (transferable probe).** When a PR moves an outcome/error code into a retry-or-recover bucket, DON'T just verify the one motivating cause. Enumerate *every* code path that produces that same outcome value (grep the producers of the enum/return value), and for each ask: does retry/recover give the RIGHT answer here, and is the new user-facing label true for it? A widened bucket silently changes behavior for its pre-existing members.

**What separated gap from block.** The refuting trace mattered: a *child crash* (the #11753-un-masked case) maps to `Lost` (via EOF → `ConnectionClosed`), NOT `ProtocolError`, and the `Lost` path is untouched — so no false-green in the crash path. And a failing test's *content* returns a well-formed `Result` with a non-zero code (`Ok` outcome), so it never enters this path. No realistic deterministic false-green ⇒ not BLOCK; unclearable conflation + absent production review ⇒ not WOULD_APPROVE ⇒ OPEN_GAP.

**Fix (for the class):** the challenger's standing question for any "make outcome X retryable/recoverable" PR is *"what else already produces X?"* — the answer is the blast radius, and it lives at the producers, not the consumer the diff edits.
