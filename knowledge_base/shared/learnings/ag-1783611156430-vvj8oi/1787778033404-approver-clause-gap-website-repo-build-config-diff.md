---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787777490740-8cr5yy
written_at: 2026-08-26T21:00:33.404Z
---

# [approver/clause-gap] website repo BUILD-CONFIG diff (conf.py) is still OUT_OF_SCOPE, not a challenger pass to WOULD_APPROVE

**Symptom:** shader-slang.github.io#193 ("Skip adding orphan directive when page is root") touched `docs/conf.py` (+6/-0) — Sphinx docs-build config (Python `source-read` hook), NOT prose/asset content. harvest exit 20 (`{found:false}`, no bot review on the website repo), Devin-only tier (exit 0, no findings), all 6 eval-clauses PASS, human jkwak-work already APPROVED @ head (mode=live_late).

**Root cause / tension:** The website out-of-scope precedent (gh.io #204/#207/#208/#209) conditions the `OUT_OF_SCOPE:website-content` class on the diff being *content-only* and warns that a `_config`/build-affecting diff means "the out-of-scope framing may not hold and the normal challenger probes apply." A build-config diff on the website repo sits in the seam: it is NOT prose (so not `website-content`), but it is ALSO not compiler code the harness is built to judge. The challenger *can* read it and did find it correct/principled (guard uses canonical `app.config.root_doc`, prevents marking the toctree-owning root as orphan + prevents YAML frontmatter being prepended to `index.rst` RST where it renders literally). But a clean challenger read does NOT license WOULD_APPROVE here.

**How to catch it:** Repo-class predicate still fires first. On a non-compiler repo, the whole calibration loop (production bot review + compiler-domain challenger + human-verdict joins from compiler PRs) is out of domain — AND you typically cannot execute the docs build to confirm the intended TOC/render behavior, so your read is plausible-but-unverified. That is exactly the "any doubt / inability to complete the check => ABSTAIN" bar. Run the challenger (a build-config diff earns it, unlike pure prose — do not skip it as "Devin theater"), but the verdict still resolves to ABSTAIN, with a class code that records the sub-type.

**Fix:** Record `ABSTAIN_POLICY` / `reason_code=OUT_OF_SCOPE:website-build-config` (distinct from `:website-content` so the calibration data separates "prose we didn't judge" from "build-config we read-but-can't-run"). Never round up to WOULD_APPROVE on this repo even with all-6-clauses-PASS + a human approval + a clean Devin. On merge/close, record the human verdict as agreement (withhold vindicated) per the #207 pattern.
