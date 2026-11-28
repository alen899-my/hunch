import { apiRequest } from './api';
import type { Thought } from './thoughts.service';

export interface Person {
  id: string;
  user_id?: string;
  name: string;
  handle: string;
  avatar_url?: string | null;
  avatar_key?: string | null;
  relationship?: string | null;
  notes?: string | null;
  birthday?: string | null;
  mention_count: number;
  last_mentioned_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface PersonMentionThought extends Thought {
  mentioned_at?: string;
  co_mentioned_ids?: string[];
}

export const getPeople = (token?: string | null) =>
  apiRequest<{ people: Person[] }>('/people', { token });

export const searchPeople = (q: string, limit = 15, token?: string | null) =>
  apiRequest<{ people: Person[] }>(
    `/people?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`,
    { token }
  );

export const getPersonDetails = (id: string, token?: string | null) =>
  apiRequest<{ person: Person; mentions: PersonMentionThought[] }>(`/people/${id}`, { token });

export const createPerson = (
  data: {
    name: string;
    handle?: string;
    avatarUrl?: string | null;
    avatarKey?: string | null;
    relationship?: string | null;
    notes?: string | null;
    birthday?: string | null;
  },
  token?: string | null
) =>
  apiRequest<{ person: Person }>('/people', {
    method: 'POST',
    body: data,
    token,
  });

export const updatePerson = (
  id: string,
  data: {
    name?: string;
    handle?: string;
    avatarUrl?: string | null;
    avatarKey?: string | null;
    relationship?: string | null;
    notes?: string | null;
    birthday?: string | null;
  },
  token?: string | null
) =>
  apiRequest<{ person: Person }>(`/people/${id}`, {
    method: 'PATCH',
    body: data,
    token,
  });

export const deletePerson = (id: string, token?: string | null) =>
  apiRequest<{ id: string }>(`/people/${id}`, {
    method: 'DELETE',
    token,
  });
