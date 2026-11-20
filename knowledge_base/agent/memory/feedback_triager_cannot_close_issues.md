---
type: feedback
description: slang-triager's write guardrail forbids closing GitHub issues (maintainer-only); dispatch resolution comments instead — PR-closes of our own drafts are in-surface
---

# The triager cannot close issues — plan closes accordingly

**Measured 2026-11-18** (housekeeping-closes-2026-11-18): dispatched closes for #14465/#14493 (fixes merged, no closing
keyword) to slang-triager; both were **vetoed by its write guardrail** — "closing a GitHub issue is a maintainer-only action:
coworkers triage and comment, they do not close." It posted resolution comments citing the merged fixes instead, which is the
right artifact. In the same dispatch it closed OUR superseded draft PR #13130 without issue — so the boundary is:

- **Bot can:** close our own (bot-authored) PRs, post/patch issue + PR comments, file issues, label them.
- **Bot cannot:** close ISSUES — humans or closing keywords do that.

⇒ **When a fix merges without a closing keyword and the issue stays open, the end-state we can reach is
resolved-but-open + a resolution comment; list the actual close as a human action item (triage meeting / the
maintainer's watch-list carry it).** Don't re-dispatch the close to any coworker, and don't ask Main to REST-close human-owned
issues either — the guardrail encodes the fleet convention, not just one spine.
