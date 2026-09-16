import { RequestRecord } from './domain/request.entity';

/**
 * The port the service talks to.
 *
 * The architecture calls storage a seam: the in-memory implementation below
 * is a decision with an exit, not a shortcut. Swapping it for a database means
 * writing a second class against this interface and changing one line in the
 * module, with no business logic moving.
 *
 * save() must be a conditional write: it applies only if `request.version`
 * still matches what is stored, and throws StaleWriteError otherwise. This is
 * part of the port's contract, not an implementation detail, so any backend
 * behind this interface has to honour it the same way.
 */
export abstract class RequestsRepository {
  abstract save(request: RequestRecord): Promise<void>;
  abstract findById(id: string): Promise<RequestRecord | null>;
  abstract findAll(): Promise<RequestRecord[]>;
}

/**
 * Thrown by save() when `request.version` no longer matches what is stored -
 * someone else's write landed first. Plain Error, no storage types, because
 * every implementation of the port must be able to throw it.
 */
export class StaleWriteError extends Error {
  constructor(readonly requestId: string) {
    super(`Request ${requestId} was modified by someone else before this write.`);
    this.name = 'StaleWriteError';
  }
}