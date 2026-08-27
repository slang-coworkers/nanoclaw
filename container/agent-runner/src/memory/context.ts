import fs from 'fs';
import path from 'path';

export const MEMORY_FILE_BUDGET_CHARS = 16_000;
export const MEMORY_TRUNCATION_NOTICE = '[truncated: slim this file and move detail into linked memory files]';

/**
 * How this copy of the section reaches the agent. The agent is told which,
 * because the two differ in when the content refreshes: a session-start hook
 * re-reads the files for every new context window, while a system prompt is
 * pinned at the query that opened the turn.
 */
export type MemoryDelivery = 'session-start' | 'system-prompt';

const DELIVERY_LINE: Record<MemoryDelivery, string> = {
  'session-start': 'These files are loaded at startup, after clear, and after compaction:',
  'system-prompt': 'These files are copied below as of the start of this turn:',
};

/**
 * Render the two always-loaded memory files inside the container. Host-side
 * composers never read agent-controlled memory.
 */
export function renderMemorySection(baseDir = '/workspace/agent', delivery: MemoryDelivery = 'session-start'): string {
  const memoryDir = path.join(baseDir, 'memory');
  const index = readMemoryFile(path.join(memoryDir, 'index.md'));
  const definition = readMemoryFile(path.join(memoryDir, 'system', 'definition.md'));

  return [
    '## Memory',
    '',
    DELIVERY_LINE[delivery],
    '',
    '- `/workspace/agent/memory/index.md` - top-level memory index and Core Memory',
    '- `/workspace/agent/memory/system/definition.md` - memory system behavior',
    '',
    'The files on disk are authoritative. Edit them directly; follow links from',
    'the index when more detail is relevant.',
    '',
    '`memory/` is an Open Knowledge Format (OKF) v0.1 bundle: one Markdown',
    'concept per file, opened by a short YAML frontmatter with a `type`',
    '(`index.md` and `log.md` are exempt; see the definition).',
    '',
    '### memory/index.md',
    '',
    index,
    '',
    '### memory/system/definition.md',
    '',
    definition,
    '',
  ].join('\n');
}

/**
 * The system-prompt copy of the section, for providers whose harness has no
 * session-start mechanism to hook (`registerMemorySessionHook` returned false).
 *
 * Undefined when there is no memory tree yet: a heading promising two files
 * that do not exist is worse than no heading. Callers scaffold first, so in
 * practice this only returns undefined if the workspace is not writable.
 */
export function memoryContextForSystemPrompt(baseDir = '/workspace/agent'): string | undefined {
  if (!fs.existsSync(path.join(baseDir, 'memory', 'index.md'))) return undefined;
  return renderMemorySection(baseDir, 'system-prompt');
}

/**
 * Join the memory section onto a system-prompt addendum. Every rebuild of
 * `instructions` goes through this, so a refresh cannot drop memory.
 */
export function appendMemorySection(instructions: string, memorySection?: string): string {
  return memorySection ? `${instructions}\n\n${memorySection}` : instructions;
}

function readMemoryFile(filePath: string): string {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '(unavailable during this hook invocation)';
  }
  if (content.length <= MEMORY_FILE_BUDGET_CHARS) return content;

  let truncated = content.slice(0, MEMORY_FILE_BUDGET_CHARS);
  const last = truncated.charCodeAt(truncated.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) truncated = truncated.slice(0, -1);
  return `${truncated}\n${MEMORY_TRUNCATION_NOTICE}`;
}
