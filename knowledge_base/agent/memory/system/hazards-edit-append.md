---
type: system
title: Edit-tool append technique
description: Never anchor a memory-file append on a bullet's opening line — anchor on the final line so new bullets insert before it.
---

# Edit-tool append technique

⛔ **Edit-tool append mistake, 4× in one chain (11-16/17, #14493): replacing a bullet's OPENING line instead
of inserting before it.** Each time I "appended" a new dated bullet to a chain record by using the existing
bullet's bold opening line as `oldString`, the edit consumed that opening line and orphaned the old bullet's
continuation text under the new bullet — then required a follow-up repair edit. Recurred despite two
in-chain corrections (R1, Fix Report, R3, approval bullets).

⇒ **To append a bullet to a memory file: anchor the edit on the file's FINAL line or a unique LATER
anchor, and make the new bullet the `newString` prefix** (`oldString` = final-line/anchor,
`newString` = anchor with new bullet inserted before it). Never use a bullet's opening line as the anchor
for an append. Repair symptom: a bullet whose first sentence reads as a fragment of the previous bullet.
