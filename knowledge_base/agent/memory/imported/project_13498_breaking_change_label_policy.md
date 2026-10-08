---
type: project
name: project_13498_breaking_change_label_policy
description: "slang#13498 (jkwak-work, 10-07, self-assigned): write a policy for what counts as a 'breaking change' for PR labels, prompted by the SHA1->SHA256 module-hash PR dispute. Maintainer governance decision with open questions; reassigned to swoods-nv 10-07 20:54Z -> held: NO dispatch, NO bot post. The issue misses that CONTRIBUTING.md already has a definition."
---

# slang#13498: breaking-change label policy

**10-07 20:35Z, `issue_opened`.** Live read at 20:36Z: open, human author `jkwak-work`, self-assigned,
label `Dev Opened`, 0 comments. The live body had been rewritten since the webhook payload (20:36:18Z edit).
It now has a broader "troubleshooting-oriented" perspective (for example, a build system that stores the
20-byte hash in a fixed-size DB column), source vs. binary breaks, severity and process (blog post or
Discord announcement, the language-proposal pipeline), and what the PR description must contain. Only my
own webhook session was on `gh-issue-shader-slang/slang-13498`, there was no task, and no conversation hit.

**Disposition: held. Nothing dispatched or posted.** Same reasoning as #13457: this is a policy decision for
maintainers, with open questions only they can settle (narrow vs. broad definition, single vs. split labels,
module-format compatibility). The filer self-assigned it and nobody asked the bot for anything.

**Repo fact the issue misses** (master `93a54974c1`, 10-07): `CONTRIBUTING.md` "### Labeling Breaking Changes"
(around line 322) already defines a break as *"an existing application that uses Slang may no longer compile or
behave the same way with the change"*. It gives three examples: `slang.h` binary-compat breaks, language
syntax/semantics changes (overload resolution), and removing or renaming a core-module intrinsic. The issue
says only `CLAUDE.md` / `copilot-instructions.md` define it. The CI gate is `.github/workflows/check-pr-label.yml`.
I offered this fact to the operator, not to GitHub.

**10-07 20:54Z, `pr_mention` ([6046663252](https://github.com/shader-slang/slang/issues/13498#issuecomment-6046663252)).**
jkwak-work: *"Assigning to @swoods-nv to discuss the topic when she is back."* Live re-read matched the payload
(no edit). Assignee is now swoods-nv only. The comment @-mentions a human, not @nv-slang-bot. Same handoff as #13457.
Held again, nothing dispatched or posted. The CONTRIBUTING.md pointer stays an operator-only offer.

**Resume** on a comment that mentions @nv-slang-bot (for example, asking for the doc PR once the policy is
agreed), or if the operator says to post the CONTRIBUTING.md pointer. A mention arrives as a webhook, so no
re-chase timer is needed.
