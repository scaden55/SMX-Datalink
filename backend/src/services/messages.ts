import { getDb } from '../db/index.js';

interface MessageRow {
  id: number;
  bid_id: number;
  sender_id: number;
  type: string;
  content: string;
  source: string;
  created_at: string;
  sender_name: string;
}

export interface MessageResult {
  id: string;
  bidId: number;
  senderId: number;
  senderName: string;
  type: string;
  content: string;
  source: string;
  timestamp: string;
}

export class MessageService {
  createMessage(bidId: number, senderId: number, type: string, content: string): MessageResult {
    // Single transaction: lookup sender name + insert — avoids N+1 pattern
    const user = getDb().prepare(
      'SELECT first_name, last_name FROM users WHERE id = ?'
    ).get(senderId) as { first_name: string; last_name: string } | undefined;

    const result = getDb().prepare(
      `INSERT INTO acars_messages (bid_id, sender_id, type, content) VALUES (?, ?, ?, ?)`
    ).run(bidId, senderId, type, content);

    return {
      id: String(result.lastInsertRowid),
      bidId,
      senderId,
      senderName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
      type,
      content,
      source: 'manual',
      timestamp: new Date().toISOString(),
    };
  }

  getMessages(bidId: number, limit = 100): MessageResult[] {
    const rows = getDb().prepare(
      `SELECT m.id, m.bid_id, m.sender_id, m.type, m.content, m.source, m.created_at,
              (u.first_name || ' ' || u.last_name) AS sender_name
       FROM acars_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.bid_id = ?
       ORDER BY m.created_at ASC
       LIMIT ?`
    ).all(bidId, limit) as MessageRow[];

    return rows.map((r) => ({
      id: String(r.id),
      bidId: r.bid_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      type: r.type,
      content: r.content,
      source: r.source,
      timestamp: r.created_at,
    }));
  }
}
