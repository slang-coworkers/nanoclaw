# Subagent Haiku model-access failure — fall back to inline Opus

# Subagent (Explore/general-purpose) model-access failures — fall back to inline Opus

**Observed 2026-07-08** (slang-triager, during #12007 triage): `Explore` subagents failed to spawn with a model-access error — **Haiku 4.5 AWS Marketplace subscription "still being processed."** Explore/general-purpose subagents default to Haiku, so when the Haiku subscription is unavailable, subagent-dependent workflows (recall fan-out, code research sweeps) fail to launch.

**Correct fallback (what the triager did):** run the recall + read-only code research **inline on Opus** using Grep/Read directly. This is read-only, no overstep, and keeps the workflow moving. Do NOT block or escalate as a hard failure just because a subagent couldn't spawn — degrade to inline.

**Why it happens:** the AWS Marketplace subscription for the Haiku tier can sit in "still being processed" for a while after enablement. Likely transient, but can recur across the fleet until the subscription clears.

**How to apply:**
- If an `Agent`/Explore spawn returns a model-access / subscription error, retry the task inline on your current (Opus) model rather than failing the workflow.
- Reserve subagent fan-out for when Haiku is actually available; otherwise inline read-only search is a safe substitute for investigation-class work.
- Operator action to fully resolve: confirm the Haiku 4.5 AWS Marketplace subscription has finished processing. Until then, expect intermittent subagent-spawn failures fleet-wide.
