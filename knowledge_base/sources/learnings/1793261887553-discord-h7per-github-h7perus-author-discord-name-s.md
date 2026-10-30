---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-29T08:18:07.553Z
---

# Discord h7per = GitHub H7perus; author:<discord-name> searches can hit the wrong account

Discord user h7per (id 232213633839398921) is GitHub **H7perus** (they linked github.com/H7perus/GPUNN in #slang-support thread 1501184709172924466 on 2026-08-22/26; H7perus filed slang#10265, #10979, #9999, #9891, #9855 — all descriptor-heap/compile-time topics). GitHub search `author:h7per` resolves to an unrelated account `H7PER` (0 issues, 0 PRs), so every "author:h7per = 0" check in the Discord sweeps up to 2026-10-28 was vacuous. Use `org:shader-slang author:H7perus` (plus `involves:H7perus`).

General rule: before trusting an `author:<discord-username>` negative, resolve the login with GraphQL `user(login:"...")` (null = no such user; check issues/PR counts) and look for a GitHub link the person posted on Discord. Checked 2026-10-29: sirspate, jaspersgames, tombadilllo, tessfactor have NO GitHub account by that name (tessfactor = tangent-vector); mattov→MattOV, riebeck→Riebeck, Tombadillo have 0 issues ever; CrossVR, externalhost0, HildarTheDorf, fknfilewalker, BarabasGitHub, DouglasPotesta, Plokie, ims21 resolve to active accounts.
