/**
 * The five request states from the product specification.
 *
 * Completed and Cancelled are terminal: the specification states that the
 * system rejects any attempt to move a request out of either one.
 */
export enum RequestStatus {
  Submitted = 'Submitted',
  Approved = 'Approved',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

const TERMINAL_STATUSES: readonly RequestStatus[] = [
  RequestStatus.Completed,
  RequestStatus.Cancelled,
];

export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}