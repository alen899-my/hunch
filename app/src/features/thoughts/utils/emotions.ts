import { Colors } from '@/theme';
import type { ThoughtMood } from '@/services/thoughts.service';

export interface EmotionDef {
  key: ThoughtMood;
  label: string;
  emoji: string;
  color: string;
  tint: string;
}

export const EMOTION_LIST: EmotionDef[] = [
  { key: 'happy', label: 'Happy', emoji: '😊', color: Colors.emotionHappy, tint: '#FFF5E3' },
  { key: 'grateful', label: 'Grateful', emoji: '🙏', color: '#D17B3A', tint: '#FDF1E7' },
  { key: 'calm', label: 'Calm', emoji: '😌', color: Colors.emotionCalm, tint: Colors.primaryLight },
  { key: 'excited', label: 'Excited', emoji: '🤩', color: '#E0653F', tint: '#FDEEE8' },
  { key: 'loved', label: 'Loved', emoji: '🥰', color: '#D15B76', tint: '#FCECEF' },
  { key: 'tired', label: 'Tired', emoji: '😴', color: '#6D738C', tint: '#EFF1F6' },
  { key: 'sad', label: 'Sad', emoji: '😢', color: Colors.emotionSad, tint: '#EBF2F8' },
  { key: 'anxious', label: 'Anxious', emoji: '😰', color: Colors.emotionAnxious, tint: '#F2F0EC' },
  { key: 'angry', label: 'Angry', emoji: '😠', color: '#C9544D', tint: '#FBECEB' },
];

export const EMOTION_MAP: Record<string, EmotionDef> = Object.fromEntries(
  EMOTION_LIST.map((e) => [e.key, e])
);

export interface EmotionThoughtPayload {
  type: 'emotion';
  mood: ThoughtMood;
  emoji: string;
  label: string;
}

export function serializeEmotionThought(emotion: EmotionDef): string {
  return JSON.stringify({
    type: 'emotion',
    mood: emotion.key,
    emoji: emotion.emoji,
    label: emotion.label,
  });
}

export function parseEmotionThought(content?: string): EmotionThoughtPayload | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const data = JSON.parse(trimmed);
    if (data?.type === 'emotion' && data.mood && data.emoji && data.label) {
      return data as EmotionThoughtPayload;
    }
  } catch {
    // ignore
  }
  return null;
}

export function formatEmotionPreview(content: string): string | null {
  const parsed = parseEmotionThought(content);
  if (!parsed) return null;
  return `${parsed.emoji} Feeling ${parsed.label}`;
}
