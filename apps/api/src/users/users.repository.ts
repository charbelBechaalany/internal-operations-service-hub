import { UserRecord } from './domain/user.entity';

/**
 * The port the rest of the app talks to. Read-only: nothing in the app
 * writes a user yet, since there is no admin feature that owns that write.
 * The seed script writes rows directly through TypeORM, the same layer
 * this repository itself is built on.
 */
export abstract class UsersRepository {
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract findAll(): Promise<UserRecord[]>;
}
