import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantRequestsModule } from '../tenant-requests/tenant-requests.module';

@Module({
  imports: [SupabaseModule, TenantRequestsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
