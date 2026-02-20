export interface NewsPost {
  id: number;
  authorId: number;
  authorCallsign: string;
  authorName: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewsListResponse {
  posts: NewsPost[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateNewsRequest {
  title: string;
  body: string;
  pinned?: boolean;
}

export interface UpdateNewsRequest {
  title?: string;
  body?: string;
  pinned?: boolean;
}
