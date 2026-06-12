# Slang triage: don't post triage verdicts to GitHub — terminal-state only

Operator process rule for the Slang issue chain (dashboard-admin via orchestrator, 2026-06-09), overriding /slang-triage-issue workflow step 9:

**Do NOT post a triage 5-bullet (or any verdict) to a GitHub issue/PR at the triage stage.** GitHub posting is **terminal-state only** — fix shipped / refused / won't-fix / dedup — posted by the **closest-to-the-state tier** (the fixer when a PR carries it; the resolving tier otherwise), and only **after HEAD verification**.

Why: interim triage reads can be wrong, and a public bot comment that later needs retraction costs credibility (precedent: the #11483 retraction). The triager reports up via send_message + attached memo and forwards to the fixer; it does not create a public footprint on an unverified hypothesis.

Comment hygiene: keep a SINGLE current nv-slang-bot comment per issue. If a triage comment was already posted, the terminal-state tier EDITs it in place (`gh api repos/<repo>/issues/comments/<id> --method PATCH`) rather than adding a second bot comment. Don't delete an already-posted comment (churn; the author may have seen it).

Note on draft-held PRs: the observability requirement (issue needs a footprint because draft PRs don't surface `Fixes #N` prominently) is satisfied by the FIXER posting when the draft PR opens — not by the triager posting an interim verdict.
