import type { CommunityPost, FeedPage, PostComment, ReactionKind } from '@/types';
import type { ReportReason } from './roomsService';
import { api } from './http';

const post = (id: number, rest = '') => `/community/posts/${id}/${rest}`;

export const communityService = {
  feed: ({ before, mine }: { before?: number | null; mine?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (before) params.set('before', String(before));
    if (mine) params.set('mine', '1');
    const qs = params.toString();
    return api<FeedPage>(`/community/posts/${qs ? `?${qs}` : ''}`);
  },
  create: (body: string) => api<CommunityPost>('/community/posts/', { method: 'POST', body: { body } }),
  reshare: (id: number, body: string) => api<CommunityPost>(post(id, 'reshare/'), { method: 'POST', body: { body } }),
  react: (id: number, kind: ReactionKind) => api<CommunityPost>(post(id, 'react/'), { method: 'POST', body: { kind } }),
  unreact: (id: number) => api<CommunityPost>(post(id, 'react/'), { method: 'DELETE' }),
  remove: (id: number) => api<void>(post(id), { method: 'DELETE' }),
  report: (id: number, reason: ReportReason, details: string) =>
    api<void>(post(id, 'report/'), { method: 'POST', body: { reason, details } }),
  comments: (id: number) => api<PostComment[]>(post(id, 'comments/')),
  addComment: (id: number, body: string) => api<PostComment>(post(id, 'comments/'), { method: 'POST', body: { body } }),
  deleteComment: (commentId: number) => api<void>(`/community/comments/${commentId}/`, { method: 'DELETE' }),
  reportComment: (commentId: number, reason: ReportReason) =>
    api<void>(`/community/comments/${commentId}/report/`, { method: 'POST', body: { reason, details: '' } }),
};
