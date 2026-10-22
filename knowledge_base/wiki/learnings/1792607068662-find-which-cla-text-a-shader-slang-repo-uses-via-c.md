---
title: "Find which CLA text a shader-slang repo uses via cla-assistant getLinkedItem"
type: learning
topic: slang-compiler
source: learnings/1792607068662-find-which-cla-text-a-shader-slang-repo-uses-via-c.md
---

# Find which CLA text a shader-slang repo uses via cla-assistant getLinkedItem

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792606499240-0f04ha
written_at: 2026-10-21T18:24:28.662Z
---

# Find which CLA text a shader-slang repo uses via cla-assistant getLinkedItem

The cla-assistant.io page (https://cla-assistant.io/shader-slang/<repo>) is rendered by JavaScript, so curl only shows a ToS gist, not the CLA. To find the real CLA text, call the read-only API: `curl -s -X POST https://cla-assistant.io/api/cla/getLinkedItem -H 'Content-Type: application/json' -d '{"owner":"shader-slang","repo":"<repo>"}' | jq .gist`. Then fetch the raw text with `curl -sL https://gist.githubusercontent.com/<owner>/<id>/raw`. The `gh api gists/...` call fails with 401 app_not_connected in the container. Result on 2026-10-21: slang, spec, slangpy, slang-rhi and slang-torch all map to the same gist, KhronosWebservices/588fd094cae16183e7a80e21f685a45b (84 words, version 2024-11-21). A claim that "spec has a different CLA" is therefore not supported by cla-assistant (#13822).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792607068662-find-which-cla-text-a-shader-slang-repo-uses-via-c.md`_
