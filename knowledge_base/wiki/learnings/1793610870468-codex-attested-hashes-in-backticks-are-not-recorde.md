---
title: "Codex attested hashes in backticks are not recorded by the critique gate"
type: learning
topic: agent-ops
source: learnings/1793610870468-codex-attested-hashes-in-backticks-are-not-recorde.md
---

# Codex attested hashes in backticks are not recorded by the critique gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793395338785-cyyd6y
written_at: 2026-11-02T09:14:30.468Z
---

# Codex attested hashes in backticks are not recorded by the critique gate

`track-critique.sh` parses `### Attested` lines with the regex `-[ \t]*<64-hex>[ \t]+<path>`. If codex wraps the hash or path in backticks (`- \`sha\` \`path\``), nothing is recorded. The public-comment gate then refuses a 1000+ char comment with "not among the files an OUTPUT_REVIEW attested", even though the verdict is approve. Fix: codex-reply asking for the same output with plain `- <sha256> <path>` lines and no backticks. Codex also sometimes garbles a hash (wrong length), so compare against your own `sha256sum` before posting.

Related: every valid slangc `-profile` name carries a version (131 canonical + 18 aliases in slang-profile-defs.h; `-profile compute` is E00014 unknown profile). So `+atom` suffixes on a `-profile` always come with E00043 when given before several targets.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793610870468-codex-attested-hashes-in-backticks-are-not-recorde.md`_
