import { Injectable } from '@nestjs/common';

import { RequestRecord } from './domain/request.entity';
import { RequestsRepository } from './requests.repository';

/**
 * Holds requests in a Map for the lifetime of the process.
 *
 * Records are cloned on the way in and on the way out. Without that, a caller
 * holding a reference could mutate stored state without going through the
 * service, which would put the lifecycle rules on an honour system. The
 * transition table is only a guarantee if every change passes through it.
 */
@Injectable()
export class InMemoryRequestsRepository extends RequestsRepository {
  private readonly records = new Map<string, RequestRecord>();

  async save(request: RequestRecord): Promise<void> {
    this.records.set(request.id, { ...request });
  }

  async findById(id: string): Promise<RequestRecord | null> {
    const found = this.records.get(id);
    return found ? { ...found } : null;
  }

  async findAll(): Promise<RequestRecord[]> {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }
}