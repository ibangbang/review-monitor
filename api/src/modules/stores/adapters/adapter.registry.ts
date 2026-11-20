import { Injectable } from '@nestjs/common';
import type { StoreType } from '../../../database/entities/store.entities';
import { AppleStoreAdapter } from './apple.adapter';
import { GoogleStoreAdapter } from './google.adapter';
import { HuaweiStoreAdapter } from './huawei.adapter';
import { MockStoreAdapter } from './mock.adapter';
import { StoreAdapter } from './store-adapter.types';

@Injectable()
export class StoreAdapterRegistry {
  private readonly adapters = new Map<StoreType, StoreAdapter>();

  constructor(
    apple: AppleStoreAdapter,
    google: GoogleStoreAdapter,
    huawei: HuaweiStoreAdapter,
    mock: MockStoreAdapter,
  ) {
    for (const adapter of [apple, google, huawei, mock]) {
      this.adapters.set(adapter.storeType, adapter);
    }
  }

  get(storeType: StoreType): StoreAdapter | undefined {
    return this.adapters.get(storeType);
  }

  list(): StoreAdapter[] {
    return [...this.adapters.values()];
  }
}
