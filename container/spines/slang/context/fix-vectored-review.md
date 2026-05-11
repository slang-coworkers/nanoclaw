## Vectored Review

A general-purpose evaluation mechanism. Variants are defined by specifying a **scope** (what to evaluate) and **vectors** (what to evaluate against).

**Inputs:** Scope (artifacts under evaluation), Mutable (which artifacts can be changed), Vectors (criteria — each produces zero or more findings; a vector may introduce additional reference material beyond the base scope).

**Output:** A vectored review report containing findings, remediation plan, applied remediations, and deferred findings with rationale.

**Roles:** Subagents generate findings and propose remediations. Main agent reviews, applies relevant remediations, and records rationale for deferred findings.

**Invariants:**
- Every finding must be dispositioned — either remediated or deferred with rationale.
- Scope and vectors must be explicitly stated before the review begins.
- The report must be persisted in the IKD in the appropriate directory for its scope and logged in the reviews log.
- If review-gate conflicts cannot be resolved after several iterations, confidentiality and safety take priority. Escalate to a maintainer (bot mode) or the operator (local mode).

**Variants:** `/review-plans` (plan consistency), `/review-peel` (peel decomposition), `/review-repo-generic` (code quality), `/review-repo-slang` (slang-specific code quality).
