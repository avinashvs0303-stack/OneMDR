import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HuntsController } from './hunts.controller';
import { HuntsService } from './hunts.service';
import { HuntSchedulerService } from './hunt-scheduler.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [ScheduleModule.forRoot(), IntegrationsModule],
  controllers: [HuntsController],
  providers: [HuntsService, HuntSchedulerService],
  exports: [HuntsService],
})
export class HuntsModule {}
