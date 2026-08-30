/**
 * `append_learning` delivery-action handler.
 *
 * Persists a shared learning to the shared learnings directory
 * (data/shared/learnings/) and rebuilds the INDEX.md file. Any agent
 * can contribute learnings via the MCP tool; the file is mounted at
 * /workspace/shared/learnings/ inside the container.
 *
 * ## Provenance
 *
 * This directory is mounted into EVERY container, so a learning one group
 * writes lands in every other group's context. That is the point of a shared
 * knowledge base, and it is also an unauthenticated cross-group write: nothing
 * stops a group from filing a "learning" that instructs its readers.
 *
 * The write stays open — restricting it would break the feature — but it is no
 * longer anonymous. Each file records the agent group and session that wrote
 * it, in front-matter a reader can see, and the index shows the author beside
 * every entry. A reader can weigh a claim by who made it, and an operator can
 * trace one back.
 *
 * Files are written under a per-group subdirectory so authorship survives even
 * if the front-matter is edited later. Existing flat files are still indexed
 * and still readable at their old paths — nothing moves.
 */
import fs from 'fs';
import path from 'path';

import { SHARED_DIR } from '../../config.js';
import { getSession } from '../../db/sessions.js';
import { wakeContainer } from '../../container-runner.js';
import { log } from '../../log.js';
import { writeSessionMessage } from '../../session-manager.js';
import type { Session } from '../../types.js';

async function notifyAgent(session: Session, text: string): Promise<void> {
  await writeSessionMessage(session.agent_group_id, session.id, {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    platformId: null,
    channelType: 'system',
    threadId: null,
    content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
  });
  const fresh = await getSession(session.id);
  if (fresh) {
    wakeContainer(fresh).catch((err) => log.error('Failed to wake container after notification', { err }));
  }
}

/**
 * Render one learning atom as a file that ends with exactly one newline and
 * carries no trailing whitespace.
 *
 * `body` is agent-authored markdown and almost always already ends with a
 * newline, so the previous `` `# ${title}\n\n${body}\n` `` produced a blank
 * line at EOF. `git diff --check` reports that as an error, and because these
 * atoms are the L1 source the wiki builder copies into `sources/`, the single
 * extra byte was duplicated across the whole knowledge base — ~2,600 of the
 * diagnostics on the KB tree trace back to this one template.
 *
 * Exported for the test; there is no other caller.
 */
export function renderLearning(title: string, body: string, provenance?: LearningProvenance): string {
  const head = provenance
    ? [
        '---',
        `author_agent_group: ${provenance.agentGroupId}`,
        `author_session: ${provenance.sessionId}`,
        `written_at: ${provenance.writtenAt}`,
        '---',
        '',
      ]
    : [];
  const lines = [...head, `# ${title}`, '', ...body.split('\n')].map((line) => line.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => `${line}\n`).join('');
}

/** Who wrote a learning. Recorded in the file, shown in the index. */
export interface LearningProvenance {
  agentGroupId: string;
  sessionId: string;
  writtenAt: string;
}

/**
 * Directory-name form of an agent group id — one path segment, no traversal.
 *
 * Dots are NOT in the allowed set. Group ids are `ag-<uuid>`, so a dot is
 * never legitimate, and excluding them means no input can produce `.` or `..`
 * rather than relying on a separate check to catch those afterwards. A name
 * that sanitizes to nothing meaningful becomes `unknown` — a directory called
 * `___` would be indistinguishable from a real one.
 */
export function learningAuthorDir(agentGroupId: string): string {
  const safe = agentGroupId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return /[a-zA-Z0-9]/.test(safe) ? safe : 'unknown';
}

/**
 * Rebuild INDEX.md over both layouts: per-author subdirectories (current) and
 * flat files at the root (written before authorship was recorded).
 *
 * Flat entries are listed as `unattributed` rather than dropped or silently
 * blended in — "we don't know who wrote this" is the honest label for a file
 * from before the provenance existed, and it distinguishes them from entries
 * an agent can vouch for.
 *
 * Exported for the test; there is no other caller.
 */
export function renderLearningsIndex(sharedDir: string): string {
  const entries: { author: string; relPath: string; display: string }[] = [];
  for (const item of fs.readdirSync(sharedDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (item.isDirectory()) {
      for (const f of fs.readdirSync(path.join(sharedDir, item.name)).sort()) {
        if (!f.endsWith('.md')) continue;
        entries.push({ author: item.name, relPath: `${item.name}/${f}`, display: displayNameOf(f) });
      }
      continue;
    }
    if (!item.name.endsWith('.md') || item.name === 'INDEX.md') continue;
    entries.push({ author: 'unattributed', relPath: item.name, display: displayNameOf(item.name) });
  }

  const lines = ['# Shared Learnings Index', ''];
  for (const e of entries) {
    lines.push(`- [${e.display}](${e.relPath}) — _${e.author}_`);
  }
  return lines.join('\n');
}

function displayNameOf(filename: string): string {
  return filename.replace(/^\d+-/, '').replace(/\.md$/, '').replace(/-/g, ' ');
}

export async function handleAppendLearning(content: Record<string, unknown>, session: Session): Promise<void> {
  const title = content.title as string;
  const body = content.content as string;
  if (!title || !body) {
    await notifyAgent(session, 'append_learning failed: title and content are required.');
    return;
  }
  const sharedDir = path.join(SHARED_DIR, 'learnings');
  const authorDir = learningAuthorDir(session.agent_group_id);
  fs.mkdirSync(path.join(sharedDir, authorDir), { recursive: true });

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const relPath = path.join(authorDir, `${Date.now()}-${slug}.md`);
  fs.writeFileSync(
    path.join(sharedDir, relPath),
    renderLearning(title, body, {
      agentGroupId: session.agent_group_id,
      sessionId: session.id,
      writtenAt: new Date().toISOString(),
    }),
  );

  fs.writeFileSync(path.join(sharedDir, 'INDEX.md'), renderLearningsIndex(sharedDir) + '\n');

  await notifyAgent(session, `Learning saved: ${title}`);
  log.info('Shared learning appended', { title, file: relPath, agentGroup: session.agent_group_id });
}
