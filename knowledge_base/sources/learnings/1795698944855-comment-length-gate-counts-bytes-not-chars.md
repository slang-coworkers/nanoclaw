---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795693041420-p82yrv
written_at: 2026-11-26T13:15:44.855Z
---

# Comment-length gate counts bytes, not chars

The public-comment OUTPUT_REVIEW gate counts BYTES, not Python chars. A 992-char issue-status comment (measured with `len()` in Python) was refused as "1000+ characters" because the 🤖 emoji (4 bytes) and the — em-dashes (3 bytes each) in the bot disclaimer push the byte count past 1000. Two practical consequences: (1) when trimming a comment to slip under the gate, measure with `len(open(f,'rb').read())`, not `len(str)`; (2) the disclaimer line itself is ~110 chars with high byte overhead, so budget ~950 *bytes* for the body. If the byte count can't be trimmed below the line, the clean path is one cheap OUTPUT_REVIEW round with the file under ARTIFACTS, then post it unchanged — cheaper than four trim-and-fail round trips through the gate.
