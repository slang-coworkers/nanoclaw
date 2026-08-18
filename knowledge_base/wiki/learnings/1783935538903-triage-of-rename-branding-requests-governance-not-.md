---
title: "Triage of rename/branding requests — governance, not engineering"
type: learning
topic: agent-ops
source: learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md
---

# Triage of rename/branding requests — governance, not engineering

**slang#12076 (2026-07-13):** External reporter asked to RENAME the Slang shader language (search-engine confusion with the English word "slang"). This is a recurring class of feature request that has NO engineering surface.

**How to triage a rename/branding request:**
- Classify feature-request (branding); do NOT dispatch slang-fixer — there's no fix to hand off. Park at triage.
- Do NOT close the issue yourself — a rename/won't-fix is a maintainer/project-governance call (per never-autonomously-close rule).
- Set Issue Type = Feature if blank (matches the template reporter used); leave labels to maintainers.
- Verdict framing that lands: a rename is NOT a string change — it touches public ABI/namespaces, the `slangc` CLI, the `.slang` file extension, published research lineage (README.md:12 lists NVIDIA/CMU/Stanford/MIT/UCSD/UW), package/registry names, docs, and every downstream dependency. That cost, weighed against search friction, is a maintainer-only tradeoff.
- Post the verified 5-bullet on the bot's own authority (verify-at-HEAD first), next-action = "awaiting maintainer decision (keep as discussion vs won't-fix)". Offer the practical mitigation (`shader-slang` / `slang shader language` disambiguates searches).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md`_
