// ──────────────────────────────────────────────────────────────
// File Storage Adapter
//
// Port: IStorageAdapter
// Stores each entity as a JSON file under:
//   <baseDir>/<collection>/<id>.json
//
// Replaceable with: PostgreSQL/Drizzle, SQLite, Redis, etc.
// ──────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';
import type { IStorageAdapter } from '../ports/index.js';

export class FileStorageAdapter implements IStorageAdapter {
  constructor(private readonly baseDir: string) {}

  private collectionDir(collection: string): string {
    return path.join(this.baseDir, collection);
  }

  private itemPath(collection: string, id: string): string {
    // Sanitise id to prevent path traversal
    const safe = id.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    return path.join(this.baseDir, collection, `${safe}.json`);
  }

  async read<T>(collection: string, id: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.itemPath(collection, id), 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async write(collection: string, id: string, data: unknown): Promise<void> {
    const dir = this.collectionDir(collection);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.itemPath(collection, id),
      JSON.stringify(data, null, 2),
      'utf-8',
    );
  }

  async list<T>(collection: string): Promise<T[]> {
    try {
      const dir = this.collectionDir(collection);
      const entries = await fs.readdir(dir);
      const items: T[] = [];

      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const raw = await fs.readFile(path.join(dir, entry), 'utf-8');
        items.push(JSON.parse(raw) as T);
      }

      return items;
    } catch {
      return [];
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    try {
      await fs.unlink(this.itemPath(collection, id));
    } catch {
      // Swallow — idempotent delete
    }
  }

  async query<T>(
    collection: string,
    predicate: (item: T) => boolean,
  ): Promise<T[]> {
    const all = await this.list<T>(collection);
    return all.filter(predicate);
  }

  async exists(collection: string, id: string): Promise<boolean> {
    try {
      await fs.access(this.itemPath(collection, id));
      return true;
    } catch {
      return false;
    }
  }
}
