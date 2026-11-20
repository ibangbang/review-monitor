import { AppleStoreAdapter } from './apple.adapter';
import { GoogleStoreAdapter } from './google.adapter';
import { HuaweiStoreAdapter } from './huawei.adapter';
import { MockStoreAdapter } from './mock.adapter';
import { StoreReviewAdapter, StoreType } from './types';
import { WorkerError } from '../utils/errors';

export class AdapterRegistry {
  private readonly adapters = new Map<StoreType, StoreReviewAdapter>();

  constructor(adapters: StoreReviewAdapter[] = [
    new AppleStoreAdapter(),
    new GoogleStoreAdapter(),
    new HuaweiStoreAdapter(),
    new MockStoreAdapter(),
  ]) {
    for (const adapter of adapters) {
      this.adapters.set(adapter.storeType, adapter);
    }
  }

  get(storeType: string): StoreReviewAdapter {
    const adapter = this.adapters.get(storeType as StoreType);
    if (!adapter) {
      throw WorkerError.permanent('STORE_TYPE_UNSUPPORTED', `暂不支持采集该市场: ${storeType}`);
    }
    return adapter;
  }

  has(storeType: string): boolean {
    return this.adapters.has(storeType as StoreType);
  }

  list(): Array<{ storeType: StoreType; version: string }> {
    return [...this.adapters.values()].map((adapter) => ({
      storeType: adapter.storeType,
      version: adapter.version,
    }));
  }
}

export const adapterRegistry = new AdapterRegistry();
