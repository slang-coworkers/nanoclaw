---
type: project
name: project_13457_discord_moderation_policy
description: "slang#13457 (jkwak-work, 10-06): write a Discord community/moderation policy consistent with the Khronos CoC. Human governance work. jkwak reassigned it to swoods-nv 2 min after filing ('start the discussion when she is back') and said the LLM-written subtasks are optional -> NO dispatch, NO bot post."
---

# slang#13457: Discord community/moderation policy

**10-06 16:16Z, `issue_opened` + 16:18Z `pr_mention`.** Live read: open, human author `jkwak-work`,
label `Dev Opened`. Comment [6020567751](https://github.com/shader-slang/slang/issues/13457#issuecomment-6020567751)
reassigned it to `swoods-nv`: *"Assigning to @swoods-nv for now so that we can start the discussion when she is
back. The issue description is written by LLM and feel free to ignore/modify any sub tasks."* The comment
@-mentions a human, not @nv-slang-bot.

**Disposition: not actionable for the bot. Nothing dispatched, nothing posted.**
- The work is governance: Khronos enforcement contact, moderator roster, Discord AutoMod/verification settings.
  None of it is compiler work, and none of it is ours to decide.
- The comment hands off to a named human for a discussion that hasn't started. A bot triage comment would be noise.
  Same rule as #13411: a `pr_mention` that names another human is a hold.
- The repo half (link the policy from `CODE_OF_CONDUCT.md` / `CONTRIBUTING.md`) depends on a policy that doesn't exist yet.

Repo facts checked at dispatch time, for whoever picks it up: `CODE_OF_CONDUCT.md` is a one-paragraph pointer to
the Khronos CoC. `CONTRIBUTING.md` "### Discord" (around line 400) already says the CoC "applies there just as it
does on GitHub" and gives the invite `khr.io/slangdiscord`. No open PR touches either file.

**10-06 16:21Z, `pr_mention` from jkiviluoto-nv ([6020623154](https://github.com/shader-slang/slang/issues/13457#issuecomment-6020623154)).**
They say joining the Discord already requires accepting the CoC by thumbs-up on a rules message (channel
`1303741100544229376`, msg `1306725186640281600`), but they're not sure a moderator policy exists. This is their claim;
I didn't check it in Discord. It confirms the gap the issue names: there's acceptance, but no enforcement process.
No @nv-slang-bot mention, so it's maintainer discussion. Held again, nothing dispatched or posted.

**10-06 16:34Z, jkwak-work ([6020845748](https://github.com/shader-slang/slang/issues/13457#issuecomment-6020845748)):**
*"Well.. It looks like what already have what we need."* The filer now reads the existing CoC gate as enough. The issue
is still open and assigned to swoods-nv, and nobody has asked the bot for anything. Likely outcome: a maintainer closes it.
Held, nothing dispatched or posted.

**Resume** on a comment that mentions @nv-slang-bot (for example, asking for the doc-link PR once the policy exists).
That arrives as a `pr_mention` webhook, so no re-chase timer is needed.
