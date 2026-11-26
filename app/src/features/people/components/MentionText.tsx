import React from 'react';
import { Text as RNText, StyleProp, TextStyle } from 'react-native';
import { AppText } from '@/components/ui';
import { Colors } from '@/theme';
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
  onPressMention?: (person: Person) => void;
}

export function MentionText({
  text,
  people,
  variant = 'body',
  color = Colors.text,
  numberOfLines,
  style,
  mentionStyle,
  onPressMention,
}: MentionTextProps) {
  const segments = parseMentionSegments(text, people);

  return (
    <AppText
      variant={variant}
      color={color}
      numberOfLines={numberOfLines}
      style={style}
    >
      {segments.map((seg, idx) =>
        seg.person ? (
          <RNText
            key={`${seg.person.id}-${idx}`}
            onPress={onPressMention ? () => onPressMention(seg.person!) : undefined}
            style={[
              {
                color: Colors.primaryDark,
                backgroundColor: 'rgba(245, 166, 35, 0.16)',
              },
              mentionStyle,
            ]}
          >
            {seg.text}
          </RNText>
        ) : (
          <RNText key={`plain-${idx}`}>{seg.text}</RNText>
        )
      )}
    </AppText>
  );
}
