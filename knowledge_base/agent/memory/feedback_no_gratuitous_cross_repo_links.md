---
type: feedback
description: Bot GitHub posts must not link other repos' issues/PRs unless the reader needs the link; cross-repo refs notify outsiders.
---

# No gratuitous cross-repo links in GitHub posts

**Operator, 2026-10-22 02:04Z (dashboard msg 507066):** "please don't randomly link to other
repositories as it causes a notification to be sent to people uninvolved in the Slang project.
microsoft/mimalloc specifically. Please use your judgment on when it is appropriate to link to
other repository's issues and PRs."

- **Mechanism:** writing `owner/repo#N` or a github.com issue/PR URL in a body creates a
  cross-reference on that thread and notifies its participants. Auto-refreshed artifacts such as
  explanation comments re-send the reference on every refresh.
- **Rule for relays:** when I forward work that will post to GitHub, external issues and PRs are
  cited as plain text or inline code (code spans are not autolinked), and linked only when
  needed. `shader-slang/*` links are fine.
- **Incident:** slang#13827's triage comment linked microsoft/mimalloc#1075, and so did the PR
  #13850 explanation comment. pdeayton-nv deleted the explanation comment, and the triager
  edited the triage comment to plain text (02:13:39Z, verified 0 refs left). Sweep (bot comments 10-20..22, 64 threads): the only other external
  link is KhronosGroup/SPIRV-Cross#2153 in slang#13771. It is a substantive citation, so I left it.
- Shared learning: "GitHub posts: don't link other repos' issues/PRs unless needed".
