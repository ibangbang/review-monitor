import { ulid } from 'ulid';

/** External identifier: 26-char ULID, non-enumerable and time-sortable. */
export function newPublicId(): string {
  return ulid();
}
