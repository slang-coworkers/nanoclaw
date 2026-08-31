/**
 * A hard byte cap on the composed document, and the reason one is needed at all.
 *
 * Claude Code "loads a CLAUDE.md file of up to 4 MiB in full and skips a larger
 * file" (code.claude.com/docs/en/memory). Over the cliff the agent receives NO
 * instructions — no persona, no invariants, no gate protocol — silently. A group
 * that quietly stops following its own safety rules is a worse failure than one
 * that refuses to start, which is what makes this loud rather than degrading.
 *
 * MEASURED, not assumed: the only unbounded input is the persona
 * (`instructions.prepend.md`), and it lives in the group directory, which is
 * mounted READ-WRITE at `/workspace/agent`. So an agent editing its own standing
 * instructions can cross the cliff by itself — a 5 MiB persona composes to
 * 5,259,196 bytes today. Reachable, not theoretical.
 *
 * Why this REFUSES instead of evicting sections, diverging from upstream's
 * `fitToCap`:
 *
 *   - Upstream drops the largest droppable section repeatedly until the document
 *     fits. That works when droppable sections hold the bulk. On this fork they
 *     hold nothing: §4.3's droppable rows are module instructions (present on
 *     disk but with no reader), resident-skill instructions (one file, no
 *     reader), and external-MCP instructions (not wired yet). Measured on the
 *     overflow case, the section ranking is `Additional Instructions` at
 *     5,242,909 bytes and every other section under 12 KB.
 *   - `Additional Instructions` IS the persona — `extraInstructions` comes from
 *     `readStandingInstructions` → `readGroupPersona` → `instructions.prepend.md`.
 *     §4.3 marks the persona core precisely because a group whose persona is
 *     evicted stops being that group. Evicting it to fit would silently discard
 *     the operator's own instructions, which is the failure mode the cap exists
 *     to prevent, relocated.
 *
 * So there is nothing safe to evict, and degrading would mean either dropping
 * sections that carry mandatory gates or dropping the persona. Refusing lets
 * `assertComposedDocUsable` do its job: an existing group keeps spawning on its
 * previous document while an operator fixes the input, and a fresh group with no
 * usable document is refused loudly instead of started blind.
 *
 * Add largest-first eviction here if and when the fork wires droppable sections
 * that can actually absorb the overflow (GAP-4, step 6). The cap is the
 * prerequisite for that, not a replacement for it.
 */
import { log } from '../log.js';

/**
 * Claude Code's documented limit. Not configurable: it is a property of the
 * consumer, not a policy knob, and a per-install override would only let someone
 * raise it past the point where the CLI stops reading the file.
 */
export const PROJECT_DOC_MAX_BYTES = 4 * 1024 * 1024;

/** Warn while there is still headroom, so pressure is visible before it is fatal. */
const WARN_BYTES = PROJECT_DOC_MAX_BYTES - PROJECT_DOC_MAX_BYTES / 8;

export class ProjectDocTooLargeError extends Error {
  constructor(
    readonly bytes: number,
    readonly maxBytes: number,
    readonly sections: { section: string; bytes: number }[],
    /**
     * Sections the cap ladder already evicted before giving up. Carried on the
     * error because that is the only path it can travel: on
     * drop-some-then-still-fail the eviction list exists solely inside
     * `renderProjectDoc`, which throws, so a caller wanting to report what was
     * attempted has nowhere else to read it from.
     */
    readonly dropped: readonly string[] = [],
  ) {
    super(
      `Composed document is ${bytes} bytes, over the ${maxBytes}-byte cap. ` +
        `Claude Code skips a file this large entirely, so the agent would receive no instructions. ` +
        `Largest sections: ${sections
          .slice(0, 3)
          .map((s) => `${s.section} (${s.bytes}B)`)
          .join(', ')}.`,
    );
    this.name = 'ProjectDocTooLargeError';
  }
}

/**
 * Split a rendered document into its `##` sections for diagnostics only. Good
 * enough to name the culprit in a log line; not used to decide anything, so a
 * `## …` inside a fenced block only mislabels a byte count.
 */
function sectionBytes(content: string): { section: string; bytes: number }[] {
  return content
    .split(/\n(?=## )/)
    .map((chunk) => ({
      section: chunk.startsWith('## ') ? chunk.slice(3, chunk.indexOf('\n')) : '(preamble)',
      bytes: Buffer.byteLength(chunk, 'utf-8'),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/**
 * Throw if `content` would be silently ignored by the consumer; warn when it is
 * within an eighth of the cap.
 *
 * Called before publication, deliberately: the caller's `catch` routes to
 * `assertComposedDocUsable`, which keeps an existing group on its previous
 * document and refuses a fresh spawn that has none. Checking after the atomic
 * write would publish the unusable document first and defeat both.
 *
 * Pure with respect to `content`, which the staleness sweep depends on: spawn and
 * `detectStaleContainers` hash the same composed string through
 * `renderComposedDocument`, so a size decision that varied between the two calls
 * would make the digests disagree forever and respawn the container every 60s.
 */
export function assertWithinDocSizeCap(content: string, folder: string): void {
  const bytes = Buffer.byteLength(content, 'utf-8');
  if (bytes > PROJECT_DOC_MAX_BYTES) {
    const sections = sectionBytes(content);
    log.error('Composed document exceeds the size cap — refusing to publish it', {
      folder,
      bytes,
      maxBytes: PROJECT_DOC_MAX_BYTES,
      sections: sections.slice(0, 5),
    });
    throw new ProjectDocTooLargeError(bytes, PROJECT_DOC_MAX_BYTES, sections);
  }

  if (bytes >= WARN_BYTES) {
    log.warn('Composed document is near its size cap', {
      folder,
      bytes,
      warnBytes: WARN_BYTES,
      maxBytes: PROJECT_DOC_MAX_BYTES,
      sections: sectionBytes(content).slice(0, 5),
    });
  }
}
