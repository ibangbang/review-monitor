import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredentialCryptoService } from '../../common/crypto/credential-crypto.service';
import { StoreApp, StoreConnection, StoreSyncConfig } from '../../database/entities';
import { StoreAdapterRegistry } from './adapters/adapter.registry';
import { AppleStoreAdapter } from './adapters/apple.adapter';
import { GoogleStoreAdapter } from './adapters/google.adapter';
import { HuaweiStoreAdapter } from './adapters/huawei.adapter';
import { MockStoreAdapter } from './adapters/mock.adapter';
import { StoreConnectionsController } from './store-connections.controller';
import { StoreConnectionsService } from './store-connections.service';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([StoreConnection, StoreApp, StoreSyncConfig])],
  controllers: [StoreConnectionsController],
  providers: [
    StoreConnectionsService,
    CredentialCryptoService,
    AppleStoreAdapter,
    GoogleStoreAdapter,
    HuaweiStoreAdapter,
    MockStoreAdapter,
    StoreAdapterRegistry,
  ],
  exports: [StoreConnectionsService, StoreAdapterRegistry, CredentialCryptoService],
})
export class StoresModule {}
