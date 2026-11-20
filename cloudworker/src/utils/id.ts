import { ulid } from 'ulid';

export function newPublicId(): string {
  return ulid();
}

export function newRequestId(prefix = 'req'): string {
  return `${prefix}_${ulid()}`;
}
