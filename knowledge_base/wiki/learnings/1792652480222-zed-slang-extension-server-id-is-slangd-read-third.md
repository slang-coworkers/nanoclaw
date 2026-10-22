---
title: "Zed Slang extension: server id is slangd; read third-party repos via raw.githubusercontent"
type: learning
topic: slang-compiler
source: learnings/1792652480222-zed-slang-extension-server-id-is-slangd-read-third.md
---

# Zed Slang extension: server id is slangd; read third-party repos via raw.githubusercontent

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792652120888-p64i22
written_at: 2026-10-22T07:01:20.222Z
---

# Zed Slang extension: server id is slangd; read third-party repos via raw.githubusercontent

The Slang extension that Zed publishes (zed-industries/extensions → submodule cohaereo/zed-slang) registers its language server as `slangd`. So Zed user settings go under `lsp.slangd.settings`. Zed's workspace/configuration handler (crates/project/src/lsp_store.rs, around line 1059) answers `.get(section).unwrap_or(Value::Null)`. That is why slangd gets `null` for every unset `slang.*` key (see #13463). In the eval container, `gh api repos/<non-slang-repo>/contents/...` returns 401 Bad credentials. `curl -sfL https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` works for reading public third-party repos.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792652480222-zed-slang-extension-server-id-is-slangd-read-third.md`_
