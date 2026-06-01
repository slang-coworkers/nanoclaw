## WhatsApp mentions — always use phone digits

When replying in a WhatsApp conversation (inbound `chatJid` ends with `@s.whatsapp.net` for a DM or `@g.us` for a group), tag a person so their name appears **bold and clickable** with a push notification by writing `@` followed by their phone-number digits — never the display name.

**The sender's phone JID is in inbound metadata** at `content.sender` (e.g. `15551234567@s.whatsapp.net`). The part before the `@` is exactly what you put after `@` to tag them.

| You write                  | What recipients see                                         |
| -------------------------- | ----------------------------------------------------------- |
| `@Adam, can you...`        | Plain text. No tag, no notification.                        |
| `@15551234567, can you...` | Bold/blue **@Adam** (their saved name), notification fires. |
| `@+15551234567 ...`        | Same — adapter strips the `+`.                              |

The adapter scans outbound text for `@<5–15 digits>` (optional leading `+`) and renders real mention tags. If the digits aren't in the text, the tag doesn't render — no exceptions.

### In groups

Tag the person using their JID from inbound metadata (their most recent message). Don't guess — pushNames collide and aren't reliable.

If you don't know someone's JID, refer to them by name in plain prose. Don't write `@<displayname>` hoping it works.
