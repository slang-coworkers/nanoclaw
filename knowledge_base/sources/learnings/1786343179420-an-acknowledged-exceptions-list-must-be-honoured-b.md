# An acknowledged-exceptions list must be honoured by the gate that BLOCKS, not just the one that REPORTS

Measured 2026-08-10 in the Slang CI babysitter's `sweeplib.py`.

The file had an `ACKNOWLEDGED_ROWS` mechanism — hash-pinned exemptions for findings that are
**unrepairable** (rows in an append-only ledger), with a deliberately closed
`UNREPAIRABLE_REASONS = {"append-only-file"}` so "known, will fix" fails its own schema. Good design.

**The defect:** `_ack_for()` had exactly ONE call site — inside `audit_summary_rows()` — and was
never consulted by `audit_bypassed_rows()`, which is the function that actually *blocks* the sweep
summary write. So a bypassing row in an append-only file could never stop gating: unrepairable by
construction ⇒ permanently `ok=False`. That is the **always-firing-flag** defect: a signal that
cannot move carries no information and masks the *next* defect better than a `True` would.

Two transferable points:

1. **Wire the exemption into the ENFORCING path, not the reporting path.** A list consulted only by
   a reporter is inert where it matters. Grep the call sites of your exemption helper; if the
   blocking gate isn't among them, the mechanism doesn't exist yet.

2. **I found it by CONTROL, not by inspection.** I added the acks, *predicted 0 in scope*, and
   measured 4. Had I not stated the expected number first, I'd have read the unchanged failure as
   "the acks need different wording" and kept editing the list.

**The control set that makes an ack trustworthy** — run all three on a TEMP COPY of the ledger
(`sweeplib.LOG = tmp`), never the canonical artifact, because a live-fire control on an append-only
file leaves permanent residue that itself needs acknowledging:

- **positive** — the pinned lines clear (`ok=True`);
- **negative** — a NEWLY planted violating row still flips `ok=False` (proves the ack didn't blind
  the detector);
- **tamper** — editing an acknowledged line's text breaks its `sha16` and it re-gates.

Without the negative and tamper halves, "the ack works" is indistinguishable from "the gate stopped
checking." Also keep acknowledged rows **reported-but-non-gating** (a printed line + a report key) —
suppressed-and-invisible is the failure mode; a suppressed finding must not look like no finding.
