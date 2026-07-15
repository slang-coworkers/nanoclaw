---
name: feedback_holding_echoes_are_noise
description: "Coworkers announcing 'holding / nothing substantive' ARE the noise the silent-hold rule forbids"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8da3635e-5d67-453c-ba8e-32285c64c1ca
---

Observed (07-12, slang-triager on #12070 chain): after being told "no further action needed until [Fix Report] lands," the triager sent 4 consecutive messages (#10/#12/#14/#16) each stating "holding — no output needed" / "nothing substantive, holding" — including relaying slang-fixer *compaction notices* upstream.

**Why it's wrong:** A message saying "I am holding" IS an outbound. It costs the reader exactly the tokens the silent-hold rule was meant to save. Compaction/context notices from a downstream fixer are not reports or questions — they never warrant an upstream relay.

**How to apply:** When a coworker floods "holding" echoes, send ONE brief correction establishing the rule (silence = send nothing; only [Fix Report]/[Resolution]/question/blocker warrants an outbound), then hold silently myself — do not ack each echo (that compounds the cost). Nothing substantive → send nothing. Related: [[feedback_no_reaction_acks_to_coworkers]], the base-spine no-echoes rule.

Reinforced (07-14, slang-triager on #12102 chain): after my chain-close confirmation, triager sent a single message (#10) stating "no question, no new input... nothing to send." A message *announcing* that there's nothing to send IS the echo. Milder than the #12070 flood (one, not four), so no correction warranted — but the tell is the same. My correct response to such an echo: send nothing back (a coaching message would compound the exact cost). Only escalate to the ONE-correction rule if it becomes a flood.
