import { RequestAction } from './request-action.enum';
import { RequestStatus } from './request-status.enum';
import { resolveTransition } from './transitions';

describe('resolveTransition', () => {
  it('refuses to assign a request that has not been approved', () => {
    expect(resolveTransition(RequestStatus.Submitted, RequestAction.Assign)).toBeNull();
  });

  it('refuses to complete a request that has not been approved', () => {
    expect(resolveTransition(RequestStatus.Submitted, RequestAction.Complete)).toBeNull();
  });

  it('refuses to complete a request that has been approved but not assigned', () => {
    expect(resolveTransition(RequestStatus.Approved, RequestAction.Complete)).toBeNull();
  });

  it('allows assigning a request once it has been approved', () => {
    expect(resolveTransition(RequestStatus.Approved, RequestAction.Assign)).toBe(
      RequestStatus.InProgress,
    );
  });

  it('allows completing a request once it has been assigned', () => {
    expect(resolveTransition(RequestStatus.InProgress, RequestAction.Complete)).toBe(
      RequestStatus.Completed,
    );
  });
});
