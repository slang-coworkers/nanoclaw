# postmortem: slang#11330 superseded by maintainer PR #11696

**Issue:** shader-slang/slang#11330 (default values on extension generic params) — closed COMPLETED 2026-06-25 by maintainer PR **#11696** ("Reject default value on extension generic param", head `gh-11330-extension-default`, MERGED). Closers list: #11334, #11341, #11696.

**Our chain:** tracked `watch-only: B-side #11334` — our draft PR **#11334** ("[draft] Fix #11330: diagnose default values…", `fix/issue-11330`) sat OPEN+draft, stale since 2026-05-28, never advanced past draft.

**Gap / what happened:** we split #11330 into an A-side (handled elsewhere) and a B-side draft, then left the B-side draft idle as "watch-only." A maintainer landed their own focused PR (#11696) that closed the umbrella issue. Our draft was neither rebased to a still-open scope nor closed — it became an orphaned stale draft against a closed issue.

**Transferable rule:** A `watch-only` B-side draft is not "parked forever." Each supervisor tick, re-confirm the parent issue is still OPEN; the instant a maintainer/other PR closes it, decide **close-our-draft-as-superseded** or **refile the remaining scope as a new issue** — don't let a draft rot against a closed issue. Closing our *own* superseded draft is authored by the owning fixer (closest-to-state), not force-closed from the supervisor session, per the operator "never unilaterally close" rule.
