/**
 * Ambient stubs for modules that are legitimately absent from a base install.
 *
 * DO NOT "helpfully" add these to package.json. They are not missing — they are
 * deliberately not installed, and declaring them as dependencies would make the
 * manifest claim something untrue about what a base install contains.
 *
 *   pino, qrcode, @whiskeysockets/baileys
 *     Installed by the channel skills, on demand, only once a user adds that
 *     channel. `.claude/skills/add-whatsapp/SKILL.md` states outright that
 *     "@whiskeysockets/baileys isn't installed (the import throws)" and that the
 *     code handles it; add-signal/SKILL.md says the same of qrcode ("purely for
 *     rendering the link during setup"). setup/whatsapp-auth.ts and
 *     setup/signal-auth.ts import them behind that guard.
 *
 * `any` is the honest type here: the gate cannot know these modules' shapes,
 * because in the environment it runs in they are not there. The point of the
 * stubs is DETERMINISM — an error that appears or vanishes depending on which
 * optional packages happen to be installed cannot be baselined, because the
 * baseline would go stale on one machine and not another.
 *
 * NOT stubbed here: `bun:sqlite`. It is reached transitively (scripts/test-v2-*.ts
 * and setup/migrate-v2/sessions.ts import container/agent-runner), and stubbing
 * it made things worse — the code uses `Database` as a TYPE, so an empty
 * `declare module` turned one clean TS2307 into eight TS2709 "cannot use
 * namespace as a type". A shaped stub would then shadow the real @types/bun
 * wherever `bun install` HAS run, making the result environment-dependent again.
 * container/agent-runner has its own tsconfig and its own CI step; the gate
 * scopes its errors out by path instead. See scripts/typecheck-gate.mjs.
 */

declare module 'pino';
declare module 'qrcode';
declare module '@whiskeysockets/baileys';
