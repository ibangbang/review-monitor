import { Injectable } from '@nestjs/common';
import { StoreAdapter, ValidationResult } from './store-adapter.types';

/**
 * Local development adapter. It never contacts a real store and lets the whole
 * pipeline be exercised without production credentials.
 */
@Injectable()
export class MockStoreAdapter implements StoreAdapter {
  readonly storeType = 'mock' as const;
  readonly version = 'mock-v1';
  readonly capabilities = ['reviews.fetch'];

  validateCredentialShape(): string[] {
    return [];
  }

  async validateConnection(): Promise<ValidationResult> {
    return { valid: true, metadata: { mock: true } };
  }
}
