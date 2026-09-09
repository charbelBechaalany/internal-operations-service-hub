/**
 * Every command that can be attempted against an existing request.
 *
 * These are actions, not target states. The specification treats a transition
 * as something the server decides, not a field the client sets, so the API
 * accepts a verb and the domain decides what state it produces.
 */
export enum RequestAction {
  Approve = 'Approve',
  Assign = 'Assign',
  Complete = 'Complete',
  Cancel = 'Cancel',
}