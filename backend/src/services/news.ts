import { getDb } from '../db/index.js';
import type { NewsPost, NewsListResponse, CreateNewsRequest, UpdateNewsRequest } from '@acars/shared';

interface NewsRow {
  id: number;
  author_id: number;
  author_callsign: string;
  author_name: string;
  title: string;
  body: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

const BASE_SELECT = `
  SELECT
    n.id, n.author_id, n.title, n.body, n.pinned,
    n.created_at, n.updated_at,
    u.callsign AS author_callsign,
    u.first_name || ' ' || u.last_name AS author_name
  FROM news n
  LEFT JOIN users u ON u.id = n.author_id
`;

export class NewsService {

  findAll(page = 1, pageSize = 10): NewsListResponse {
    const offset = (page - 1) * pageSize;

    const total = (getDb().prepare('SELECT COUNT(*) AS count FROM news').get() as { count: number }).count;

    const rows = getDb().prepare(`
      ${BASE_SELECT}
      ORDER BY n.pinned DESC, n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(pageSize, offset) as NewsRow[];

    return {
      posts: rows.map(this.toNewsPost),
      total,
      page,
      pageSize,
    };
  }

  findById(id: number): NewsPost | undefined {
    const row = getDb().prepare(`${BASE_SELECT} WHERE n.id = ?`).get(id) as NewsRow | undefined;
    return row ? this.toNewsPost(row) : undefined;
  }

  create(authorId: number, data: CreateNewsRequest): NewsPost {
    const now = new Date().toISOString();
    const result = getDb().prepare(`
      INSERT INTO news (author_id, title, body, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(authorId, data.title, data.body, data.pinned ? 1 : 0, now, now);

    return this.findById(result.lastInsertRowid as number)!;
  }

  update(id: number, data: UpdateNewsRequest): NewsPost | undefined {
    const existing = getDb().prepare('SELECT id FROM news WHERE id = ?').get(id);
    if (!existing) return undefined;

    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
    if (data.body !== undefined)  { sets.push('body = ?');  params.push(data.body); }
    if (data.pinned !== undefined){ sets.push('pinned = ?');params.push(data.pinned ? 1 : 0); }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    getDb().prepare(`UPDATE news SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  delete(id: number): boolean {
    const result = getDb().prepare('DELETE FROM news WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private toNewsPost(row: NewsRow): NewsPost {
    return {
      id: row.id,
      authorId: row.author_id,
      authorCallsign: row.author_callsign ?? 'Unknown',
      authorName: row.author_name ?? 'Unknown',
      title: row.title,
      body: row.body,
      pinned: row.pinned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
