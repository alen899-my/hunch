import { apiRequest } from './api';

export type ThoughtCategory = string;

export interface Thought {
  id: string;
  user_id?: string;
  day_date: string;
  content: string;
  category?: ThoughtCategory;
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

export const getDays = (token?: string | null) =>
  apiRequest<{ days: DaySummary[] }>('/thoughts/days', { token });

export const getDayThoughts = (dayDate: string, token?: string | null) =>
  apiRequest<{ dayDate: string; thoughts: Thought[] }>(`/thoughts/${dayDate}`, { token });

export const createThought = (
  data: { dayDate?: string; content: string; category?: ThoughtCategory },
  token?: string | null
) =>
  apiRequest<{ thought: Thought }>('/thoughts', {
    method: 'POST',
    body: data,
    token,
  });

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
