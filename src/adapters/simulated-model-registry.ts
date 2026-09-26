// ──────────────────────────────────────────────────────────────
// Simulated Model Registry Adapter
//
// Port: IModelRegistry
// Persists models through the injected IStorageAdapter.
// ──────────────────────────────────────────────────────────────

import type { IModelRegistry, IStorageAdapter } from '../ports/index.js';
import type { Model } from '../domain/types.js';

const COLLECTION = 'models';

export class SimulatedModelRegistry implements IModelRegistry {
  constructor(private readonly storage: IStorageAdapter) {}

  async getAll(): Promise<Model[]> {
    return this.storage.list<Model>(COLLECTION);
  }

  async getById(id: string): Promise<Model | null> {
    return this.storage.read<Model>(COLLECTION, id);
  }

  async register(model: Model): Promise<void> {
    await this.storage.write(COLLECTION, model.id, model);
  }

  async remove(id: string): Promise<void> {
    await this.storage.delete(COLLECTION, id);
  }
}
