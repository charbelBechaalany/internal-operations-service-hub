import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { DepartmentsRepository } from '../departments/departments.repository';
import { InvalidTransitionError } from '../common/invalid-transition.error';
import { NotDepartmentHeadError } from '../common/not-department-head.error';
import { RequestConflictError } from '../common/request-conflict.error';
import { RequestNotFoundError } from '../common/request-not-found.error';
import { RequestAction } from './domain/request-action.enum';
import { RequestStatus } from './domain/request-status.enum';
import { RequestRecord } from './domain/request.entity';
import { explainRefusal, resolveTransition } from './domain/transitions';
import { RequestsRepository, StaleWriteError } from './requests.repository';

@Injectable()
export class RequestsService {
  constructor(
    private readonly repository: RequestsRepository,
    private readonly departments: DepartmentsRepository,
  ) {}

  /**
   * Creates a request. It enters Submitted, which the specification names as
   * the only state a new request can hold.
   *
   * Creation is not a transition: there is no prior state to move from, which
   * is why it does not go through the transition table.
   */
  async create(
    title: string,
    description: string,
    departmentId: string,
    requesterId: string,
  ): Promise<RequestRecord> {
    const request: RequestRecord = {
      id: randomUUID(),
      title,
      description,
      submittedAt: new Date(),
      requesterId,
      departmentId,
      status: RequestStatus.Submitted,
      assigneeId: null,
      cancellationReason: null,
      completedAt: null,
      version: 0,
    };

    await this.repository.save(request);
    return request;
  }

  async findById(id: string): Promise<RequestRecord> {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new RequestNotFoundError(id);
    }
    return request;
  }

  async findAll(): Promise<RequestRecord[]> {
    return this.repository.findAll();
  }

  async approve(id: string, actorId: string): Promise<RequestRecord> {
    await this.assertIsDepartmentHead(id, actorId);
    return this.applyTransition(id, RequestAction.Approve);
  }

  /**
   * Assigns or reassigns. Both use the same action, because the data model
   * treats reassignment as a change of owner rather than a change of state:
   * the request is InProgress either way.
   */
  async assign(id: string, assigneeId: string, actorId: string): Promise<RequestRecord> {
    await this.assertIsDepartmentHead(id, actorId);
    return this.applyTransition(id, RequestAction.Assign, (request) => {
      request.assigneeId = assigneeId;
    });
  }

  async complete(id: string): Promise<RequestRecord> {
    return this.applyTransition(id, RequestAction.Complete, (request) => {
      request.completedAt = new Date();
    });
  }

  async cancel(id: string, reason: string): Promise<RequestRecord> {
    return this.applyTransition(id, RequestAction.Cancel, (request) => {
      request.cancellationReason = reason;
    });
  }

  /**
   * The single path through which a request's status can change.
   *
   * Every action loads the current state, asks the transition table whether
   * the move is legal, and refuses if it is not. Nothing is written unless the
   * domain allows it, so an illegal move leaves no trace and no partial state.
   *
   * Keeping this in one method is what makes the invariant enforceable rather
   * than merely intended: there is no second path that could skip the check.
   *
   * The save is conditional on the version this method read. If someone
   * else's write landed first, the repository rejects it with
   * StaleWriteError instead of overwriting; this method reloads the row and
   * turns that into RequestConflictError, carrying what is actually stored
   * now rather than what this caller assumed. That is a different failure
   * from an illegal move: the transition above was legal against the state
   * this method read, it just lost the race to reach storage first.
   */
  private async applyTransition(
    id: string,
    action: RequestAction,
    mutate?: (request: RequestRecord) => void,
  ): Promise<RequestRecord> {
    const request = await this.findById(id);

    const nextStatus = resolveTransition(request.status, action);
    if (nextStatus === null) {
      throw new InvalidTransitionError(
        request.status,
        action,
        explainRefusal(request.status, action),
      );
    }

    request.status = nextStatus;
    mutate?.(request);

    try {
      await this.repository.save(request);
    } catch (error) {
      if (error instanceof StaleWriteError) {
        const current = await this.findById(id);
        throw new RequestConflictError(id, current);
      }
      throw error;
    }

    return request;
  }

  /**
   * Only the head of the request's owning department may approve or assign
   * (reassignment included, since it shares the Assign action). Reads the
   * department the request already points to and compares its stored
   * headId to the actor - the two stored fields the data model says answer
   * this question, nothing derived or looked up further.
   */
  private async assertIsDepartmentHead(requestId: string, actorId: string): Promise<void> {
    const request = await this.findById(requestId);
    const department = await this.departments.findById(request.departmentId);

    if (!department || department.headId !== actorId) {
      throw new NotDepartmentHeadError(request.id, request.departmentId);
    }
  }
}