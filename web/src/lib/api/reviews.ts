import { requestData, requestList } from './client';
import type { Review, ReviewDetail, ReviewNote, ReviewStatus } from '@/types/api';

export type ReviewListParams = {
  applicationId?: string;
  storeType?: string;
  rating?: number;
  status?: ReviewStatus | '';
  country?: string;
  appVersion?: string;
  keyword?: string;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'updated';
  page?: number;
  pageSize?: number;
};

export function fetchReviews(params: ReviewListParams, workspaceId: string) {
  return requestList<Review>('/reviews', { workspaceId, ...params });
}

export function fetchReview(id: string, workspaceId: string) {
  return requestData<ReviewDetail>(`/reviews/${id}`, { workspaceId });
}

export function updateReviewStatus(id: string, status: ReviewStatus, workspaceId: string) {
  return requestData<Review>(`/reviews/${id}/status`, { method: 'PATCH', body: { status }, workspaceId });
}

export function fetchReviewNotes(id: string, workspaceId: string) {
  return requestData<{ items: ReviewNote[]; total: number }>(`/reviews/${id}/notes`, { workspaceId });
}

export function createReviewNote(id: string, content: string, workspaceId: string) {
  return requestData<ReviewNote>(`/reviews/${id}/notes`, { method: 'POST', body: { content }, workspaceId });
}
