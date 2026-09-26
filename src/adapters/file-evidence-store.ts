// ──────────────────────────────────────────────────────────────
// File Evidence Store Adapter
//
// Port: IEvidenceStore
// Persists qualification evidence through IStorageAdapter.
// ──────────────────────────────────────────────────────────────

import type { IEvidenceStore, IStorageAdapter } from '../ports/index.js';
import type { QualificationEvidence } from '../domain/types.js';

const COLLECTION = 'evidence';

export class FileEvidenceStore implements IEvidenceStore {
  constructor(private readonly storage: IStorageAdapter) {}

  async store(evidence: QualificationEvidence): Promise<void> {
    await this.storage.write(COLLECTION, evidence.id, evidence);
  }

  async getByConfigId(configId: string): Promise<QualificationEvidence[]> {
    return this.storage.query<QualificationEvidence>(
      COLLECTION,
      (e) => e.configId === configId,
    );
  }

  async getById(id: string): Promise<QualificationEvidence | null> {
    return this.storage.read<QualificationEvidence>(COLLECTION, id);
  }

  async getLatest(configId: string): Promise<QualificationEvidence | null> {
    const all = await this.getByConfigId(configId);
    if (all.length === 0) return null;

    return all.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];
  }

  async listAll(): Promise<QualificationEvidence[]> {
    return this.storage.list<QualificationEvidence>(COLLECTION);
  }
}
