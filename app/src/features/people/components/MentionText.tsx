import React from 'react';
import { Text as RNText, StyleProp, TextStyle } from 'react-native';
import { AppText } from '@/components/ui';
import { Colors } from '@/theme';
import { useThemeColors } from '@/hooks/use-mood-theme';
import type { Person } from '@/services/people.service';
import { parseMentionSegments } from '../utils/mentions';

interface MentionTextProps {
  text: string;
  people: Person[];
  variant?: React.ComponentProps<typeof AppText>['variant'];
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  tagStyle?: StyleProp<TextStyle>;
  onPressMention?: (person: Person) => void;
  onPressTag?: (tag: string) => void;
}

interface RichSegment {
  text: string;
  person?: Person;
  tag?: string;
}

function splitHashtags(segmentText: string): RichSegment[] {
  if (!segmentText || !segmentText.includes('#')) {
    return [{ text: segmentText }];
  }

  const parts: RichSegment[] = [];
  const regex = /(^|[\s(\[{"'])#([a-zA-Z0-9_]{1,40})(?=$|[\s.,!?;:)\]}"'])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(segmentText)) !== null) {
    const hashStart = match.index + match[1].length;
    const tagToken = match[2];
    const hashEnd = hashStart + 1 + tagToken.length;

    if (hashStart > lastIndex) {
      parts.push({ text: segmentText.slice(lastIndex, hashStart) });
    }
    parts.push({
      text: segmentText.slice(hashStart, hashEnd),
      tag: tagToken.toLowerCase(),
    });
    lastIndex = hashEnd;
  }

  if (lastIndex < segmentText.length) {
    parts.push({ text: segmentText.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ text: segmentText }];
}

export function MentionText({
  text,
  people,
  variant = 'body',
  color = Colors.text,
  numberOfLines,
  style,
  mentionStyle,
  tagStyle,
  onPressMention,
  onPressTag,
}: MentionTextProps) {
  const mentionSegments = parseMentionSegments(text, people);
  const richSegments: RichSegment[] = [];

  for (const seg of mentionSegments) {
    if (seg.person) {
      richSegments.push({ text: seg.text, person: seg.person });
    } else {
      richSegments.push(...splitHashtags(seg.text));
    }
  }

  return (
    <AppText
      variant={variant}
      color={color}
      numberOfLines={numberOfLines}
      style={style}
    >
      {richSegments.map((seg, idx) => {
        if (seg.person) {
          return (
            <RNText
              key={`${seg.person.id}-${idx}`}
              onPress={onPressMention ? () => onPressMention(seg.person!) : undefined}
              style={[
                {
                  color: useThemeColors().primary,
                },
                mentionStyle,
              ]}
            >
              {seg.text}
            </RNText>
          );
        }
        if (seg.tag) {
          return (
            <RNText
              key={`tag-${seg.tag}-${idx}`}
              onPress={onPressTag ? () => onPressTag(seg.tag!) : undefined}
              style={[
                {
                  color: Colors.tagPurpleText,
                  backgroundColor: 'rgba(110, 90, 171, 0.12)',
                },
                tagStyle,
              ]}
            >
              {seg.text}
            </RNText>
          );
        }
        return <RNText key={`plain-${idx}`}>{seg.text}</RNText>;
      })}
    </AppText>
  );
}
