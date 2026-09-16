import { RequestRecord } from '../domain/request.entity';
import { RequestOrmEntity } from './request.orm-entity';

/**
 * The only place that knows both shapes exist.
 */
export function toDomain(row: RequestOrmEntity): RequestRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    submittedAt: row.submittedAt,
    requesterId: row.requesterId,
    departmentId: row.departmentId,
    status: row.status,
    assigneeId: row.assigneeId,
    cancellationReason: row.cancellationReason,
    completedAt: row.completedAt,
    version: row.version,
  };
}

export function toOrmEntity(request: RequestRecord): RequestOrmEntity {
  const row = new RequestOrmEntity();
  row.id = request.id;
  row.title = request.title;
  row.description = request.description;
  row.submittedAt = request.submittedAt;
  row.requesterId = request.requesterId;
  row.departmentId = request.departmentId;
  row.status = request.status;
  row.assigneeId = request.assigneeId;
  row.cancellationReason = request.cancellationReason;
  row.completedAt = request.completedAt;
  row.version = request.version;
  return row;
}
