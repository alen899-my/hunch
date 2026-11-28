export interface TagTrigger {
  startIndex: number;
  endIndex: number;
  query: string;
}

export function extractHashtagsFromText(text: string): string[] {
  if (!text || !text.includes('#')) return [];
  const tags = new Set<string>();
  const regex = /(?:^|[\s(\[{"'])#([a-zA-Z0-9_]{1,40})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

export function getActiveTagTrigger(text: string, cursorIndex: number): TagTrigger | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, text.length));
  const beforeCursor = text.slice(0, safeCursor);
  const match = beforeCursor.match(/(?:^|[\s(\[{"'])#([a-zA-Z0-9_]*)$/);
  if (!match) return null;

  const hashIndex = beforeCursor.lastIndexOf('#');
  if (hashIndex < 0) return null;

  return {
    startIndex: hashIndex,
    endIndex: safeCursor,
    query: match[1] ?? '',
  };
}

export function insertTagAtTrigger(
  text: string,
  trigger: TagTrigger,
  tag: string
): { nextText: string; nextCursorIndex: number } {
  const cleanTag = tag.replace(/^#/, '');
  const before = text.slice(0, trigger.startIndex);
  const after = text.slice(trigger.endIndex);
  const needsSpace = !after.startsWith(' ');
  const inserted = `#${cleanTag}${needsSpace ? ' ' : ''}`;
  return {
    nextText: `${before}${inserted}${after}`,
    nextCursorIndex: before.length + inserted.length + (needsSpace ? 0 : 1),
  };
}
