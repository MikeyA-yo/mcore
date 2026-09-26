// ──────────────────────────────────────────────────────────────
// File Trace Store Adapter
//
// Port: ITraceStore
// Stores execution traces as JSON files.
// Follows OpenTelemetry span concepts (traceId, events, duration)
// so migration to a real OTel exporter is straightforward.
//
// Replaceable with: OpenTelemetry SDK + Jaeger, Langfuse, etc.
// ──────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import type { ITraceStore, IStorageAdapter } from '../ports/index.js';
import type { Trace, TraceEvent } from '../domain/types.js';

const COLLECTION = 'traces';

export class FileTraceStore implements ITraceStore {
  constructor(private readonly storage: IStorageAdapter) {}

  async startTrace(workflowId: string): Promise<Trace> {
    const trace: Trace = {
      id: `exec_${nanoid(8)}`,
      workflowId,
      events: [],
      startTime: new Date().toISOString(),
      status: 'IN_PROGRESS',
    };

    await this.storage.write(COLLECTION, trace.id, trace);
    return trace;
  }

  async addEvent(
    traceId: string,
    event: Omit<TraceEvent, 'id' | 'traceId'>,
  ): Promise<TraceEvent> {
    const trace = await this.storage.read<Trace>(COLLECTION, traceId);
    if (!trace) throw new Error(`Trace not found: ${traceId}`);

    const fullEvent: TraceEvent = {
      id: `evt_${nanoid(8)}`,
      traceId,
      ...event,
    };

    trace.events.push(fullEvent);
    await this.storage.write(COLLECTION, traceId, trace);
    return fullEvent;
  }

  async endTrace(
    traceId: string,
    status: 'COMPLETED' | 'FAILED',
  ): Promise<Trace> {
    const trace = await this.storage.read<Trace>(COLLECTION, traceId);
    if (!trace) throw new Error(`Trace not found: ${traceId}`);

    trace.endTime = new Date().toISOString();
    trace.status = status;
    await this.storage.write(COLLECTION, traceId, trace);
    return trace;
  }

  async getTrace(traceId: string): Promise<Trace | null> {
    return this.storage.read<Trace>(COLLECTION, traceId);
  }

  async listTraces(limit = 20): Promise<Trace[]> {
    const all = await this.storage.list<Trace>(COLLECTION);
    return all
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      )
      .slice(0, limit);
  }
}
