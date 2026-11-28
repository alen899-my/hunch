import type { Person } from '@/services/people.service';

export interface MentionTrigger {
  startIndex: number;
  endIndex: number;
  query: string;
}

export interface MentionSegment {
  text: string;
  person?: Person;
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildDefaultHandle(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Detects an active `@query` right before the cursor position.
 * Scans backwards from the cursor so multiple `@mentions` in one message
 * each get their own independent trigger.
 */
export function getActiveMentionTrigger(
  text: string,
  cursorIndex: number
): MentionTrigger | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, text.length));
  const beforeCursor = text.slice(0, safeCursor);
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex < 0) return null;

  if (atIndex > 0 && !/[\s(\[{"',]/.test(beforeCursor[atIndex - 1])) {
    return null;
  }

  const query = beforeCursor.slice(atIndex + 1);
  if (query.includes('\n')) return null;
  if (query.length > 0 && /^\s/.test(query)) return null;

  return {
    startIndex: atIndex,
    endIndex: safeCursor,
    query,
  };
}

/**
 * Filters people by name or handle only after at least one letter/character
 * is entered after `@`, prioritizing prefix matches first.
 */
export function filterPeopleForMention(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = people.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.handle.toLowerCase().includes(q)
  );

  return matches.sort((a, b) => {
    const aStarts =
      a.name.toLowerCase().startsWith(q) || a.handle.toLowerCase().startsWith(q);
    const bStarts =
      b.name.toLowerCase().startsWith(q) || b.handle.toLowerCase().startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Inserts `@PersonName ` at the active trigger span and computes the updated cursor index.
 */
export function insertMentionAtTrigger(
  text: string,
  trigger: MentionTrigger,
  person: Person
): { nextText: string; nextCursorIndex: number } {
  const before = text.slice(0, trigger.startIndex);
  const after = text.slice(trigger.endIndex);
  const needsTrailingSpace = !after.startsWith(' ');
  const inserted = `@${person.name}${needsTrailingSpace ? ' ' : ''}`;
  const nextText = `${before}${inserted}${after}`;
  const nextCursorIndex = before.length + inserted.length + (needsTrailingSpace ? 0 : 1);
  return { nextText, nextCursorIndex };
}

/**
 * Splits message text into plain and matched `@person` segments (longest match first).
 */
export function parseMentionSegments(text: string, people: Person[]): MentionSegment[] {
  if (!text || !text.includes('@') || people.length === 0) {
    return [{ text }];
  }

  const candidates: { person: Person; token: string }[] = [];
  for (const person of people) {
    const cleanName = person.name?.trim();
    const cleanHandle = person.handle?.trim();
    if (cleanName) {
      candidates.push({ person, token: cleanName });
    }
    if (cleanHandle && cleanHandle.toLowerCase() !== cleanName?.toLowerCase()) {
      candidates.push({ person, token: cleanHandle });
    }
  }

  candidates.sort((a, b) => b.token.length - a.token.length);

  const spans: { start: number; end: number; person: Person }[] = [];
  const isRangeFree = (start: number, end: number) =>
    !spans.some((s) => Math.max(s.start, start) < Math.min(s.end, end));

  for (const { person, token } of candidates) {
    const regex = new RegExp(
      `(^|[\\s(\\[{"',])@${escapeRegex(token)}(?=$|[\\s.,!?;:)\\]}"'])`,
      'gi'
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index + match[1].length;
      const end = start + 1 + token.length;
      if (isRangeFree(start, end)) {
        spans.push({ start, end, person });
      }
    }
  }

  if (spans.length === 0) return [{ text }];

  spans.sort((a, b) => a.start - b.start);

  const segments: MentionSegment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ text: text.slice(cursor, span.start) });
    }
    segments.push({
      text: text.slice(span.start, span.end),
      person: span.person,
    });
    cursor = span.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}
