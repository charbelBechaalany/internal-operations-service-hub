import { RequestRecord } from './domain/request.entity';

/**
 * The port the service talks to.
 *
 * The architecture calls storage a seam: the in-memory implementation below
 * is a decision with an exit, not a shortcut. Swapping it for a database means
 * writing a second class against this interface and changing one line in the
 * module, with no business logic moving.
 */
export abstract class RequestsRepository {
  abstract save(request: RequestRecord): Promise<void>;
  abstract findById(id: string): Promise<RequestRecord | null>;
  abstract findAll(): Promise<RequestRecord[]>;
}