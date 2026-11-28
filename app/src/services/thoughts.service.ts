import { apiRequest } from './api';
import type { Person } from './people.service';

export type ThoughtCategory = string;
export type ThoughtMood =
  | 'happy'
  | 'sad'
  | 'calm'
  | 'anxious'
  | 'grateful'
  | 'excited'
  | 'loved'
  | 'tired'
  | 'angry';

export interface Thought {
  id: string;
  user_id?: string;
  day_date: string;
  content: string;
  category?: ThoughtCategory;
  is_starred?: boolean;
  mood?: ThoughtMood | null;
  tags?: string[];
  reply_to_id?: string | null;
  reply_to_preview?: string | null;
  reply_to_category?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface DaySummary {
  day_date: string;
  thought_count: number;
  last_updated: string;
  latest_preview: string;
  latest_category?: ThoughtCategory;
}

export interface TagSummary {
  tag: string;
  count: number;
}

export interface ThoughtsStats {
  activeDays: { day_date: string; count: number }[];
  moodCounts: { mood: ThoughtMood; count: number }[];
  latestMood?: ThoughtMood | null;
  weeklyCount: number;
  activeDaysThisWeek: number;
  totalCount?: number;
  topWeekMood?: ThoughtMood | null;
  topPerson: {
    id: string;
    name: string;
    handle: string;
    avatar_url?: string | null;
    count: number;
  } | null;
  topTag: { tag: string; count: number } | null;
}

export const getDays = (token?: string | null) =>
  apiRequest<{ days: DaySummary[] }>('/thoughts/days', { token });

export const getDayThoughts = (dayDate: string, token?: string | null) =>
  apiRequest<{ dayDate: string; thoughts: Thought[]; mentionedPeople?: Person[] }>(
    `/thoughts/${dayDate}`,
    { token }
  );

export const createThought = (
  data: {
    dayDate?: string;
    content: string;
    category?: ThoughtCategory;
    mood?: ThoughtMood | null;
    replyToId?: string | null;
    mentionedPersonIds?: string[];
  },
  token?: string | null
) =>
  apiRequest<{ thought: Thought }>('/thoughts', {
    method: 'POST',
    body: data,
    token,
  });

export const updateThought = (
  id: string,
  data: {
    content?: string;
    mood?: ThoughtMood | null;
    isStarred?: boolean;
    mentionedPersonIds?: string[];
  },
  token?: string | null
) =>
  apiRequest<{ thought: Thought }>(`/thoughts/${id}`, {
    method: 'PATCH',
    body: data,
    token,
  });

export const searchThoughts = (
  params: {
    q?: string;
    type?: string;
    mood?: string;
    tag?: string;
    starred?: boolean;
    personId?: string;
    dayDate?: string;
    startDate?: string;
    endDate?: string;
  },
  token?: string | null
) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.type) qs.set('type', params.type);
  if (params.mood) qs.set('mood', params.mood);
  if (params.tag) qs.set('tag', params.tag);
  if (params.starred) qs.set('starred', 'true');
  if (params.personId) qs.set('personId', params.personId);
  if (params.dayDate) qs.set('dayDate', params.dayDate);
  if (params.startDate) qs.set('startDate', params.startDate);
  if (params.endDate) qs.set('endDate', params.endDate);
  const query = qs.toString();
  return apiRequest<{ thoughts: Thought[] }>(`/thoughts/search${query ? `?${query}` : ''}`, {
    token,
  });
};

export const getTags = (token?: string | null) =>
  apiRequest<{ tags: TagSummary[] }>('/thoughts/tags', { token });

export const getStats = (token?: string | null) =>
  apiRequest<{ stats: ThoughtsStats }>('/thoughts/stats', { token });

export const deleteThought = (id: string, token?: string | null) =>
  apiRequest<{ id: string }>(`/thoughts/${id}`, {
    method: 'DELETE',
    token,
  });

export const bulkDeleteThoughts = (ids: string[], token?: string | null) =>
  apiRequest<{ deletedIds: string[] }>('/thoughts/bulk-delete', {
    method: 'POST',
    body: { ids },
    token,
  });
