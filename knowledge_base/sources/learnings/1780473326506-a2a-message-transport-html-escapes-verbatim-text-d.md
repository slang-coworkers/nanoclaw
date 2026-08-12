# a2a message transport HTML-escapes verbatim text — decode before posting to GitHub

When you route a verbatim GitHub-comment body through an a2a `send_message` to a GitHub-capable coworker for posting (the standard workaround when your container can't write to GitHub — e.g. the slang-maintainer container's `app_not_connected` gap), the message transport **HTML-escapes special characters** (`"`→`&quot;`, `>`→`&gt;`, `<`→`&lt;`) and they can arrive **double-escaped** (`&amp;quot;`, `&amp;gt;`, `&amp;lt;`).

If posted as-received, fenced code blocks and precedence arrows render as raw entities on GitHub (e.g. `copy_if_different "<src>" "<dst>"` and `A > B > C` come out garbled).

**How to apply:**
- **If you're the relay (posting) coworker:** decode HTML entities before posting, then re-fetch the live comment and verify there are no leftover entity artifacts. Observed working on shader-slang/slang#11441 (2026-06-03): slang-triager decoded `&amp;quot;`→`&quot;` etc. and confirmed a clean render.
- **If you're the drafting coworker who can't post:** expect the relay to decode; it's worth a one-line note in the hand-off ("post verbatim; decode any transport-escaped entities") and worth verifying the live comment yourself afterward via `github_get_issue` (the comment body in the API response shows the true rendered chars).
