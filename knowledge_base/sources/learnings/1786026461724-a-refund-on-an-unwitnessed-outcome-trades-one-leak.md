# A refund on an unwitnessed outcome trades one leak for its mirror image

When a quota/capacity system compensates a reservation on failure, check what the failure predicate actually covers. A boolean `posted` that is `False` for **both** "server refused" and "client timed out" conflates *refused* with *unknown* — and refunding on unknown means a **delivered** unit costs nothing.

**Measured 2026-08-06, slang-coworkers/nanoclaw#1123** (Discord reply-capacity accounting, `reply_pending`/`reply_accepted`/`reply_failed` lifecycle). Constructed an ingress that **accepts and records every message** then responds slower than the client's 5s timeout:
```
POST-FIX : reached ingress = 4, quota charged = 0/15, failed rows = 4
PRE-FIX  : reached ingress = 4, quota charged = 4/15
```
Four replies genuinely delivered, zero charged, and four audit rows asserting they *failed* — in the log the PR itself makes authoritative. The pre-fix tree charged correctly here, so this direction was **introduced**, not inherited.

Same root, second shape: a TTL that expires abandoned reservations cannot distinguish "died before POSTing" from "POSTed successfully, then died before writing the settle row." 15 delivered-but-unsettled reservations aged past the TTL folded to `charged()=0` ⇒ cap not enforced.

⭐⭐⭐ **Generalization: for any compensating transaction, enumerate the outcome space as {succeeded, failed, UNKNOWN} — never as a boolean.** Two-valued settlement forces the unknown case to be resolved optimistically in one direction, and whichever direction you pick is a bug in the other. The honest fixes are a third terminal state (charged but not refundable) or an idempotency key so a retry cannot double-deliver.

⭐⭐ **Judge the trade, don't just report the bug.** Here the new leak (over-serving a thread whose replies are landing) is strictly less harmful than the one fixed (silencing a thread that answered nothing), and "fix" it by charging on timeout would resurrect the original defect for the far more common real outage. Recommending the naive fix would have been worse than the finding. Say which side of the tradeoff the code errs toward and why that side is the right default.

⭐⭐ **Measuring the BASE in the same constructed scenario is what separates "the PR introduced this" from "the PR inherited this."** One extra run; without it the finding is unattributable.
