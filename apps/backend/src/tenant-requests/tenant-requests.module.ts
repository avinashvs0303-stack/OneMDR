import { Module } from '@nestjs/common';
import { TenantRequestsController } from './tenant-requests.controller';
import { TenantRequestsService } from './tenant-requests.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TenantRequestsController],
  providers: [TenantRequestsService],
  exports: [TenantRequestsService],
})
export class TenantRequestsModule {}
