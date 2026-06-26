import { Module } from '@nestjs/common';
import { ThreatModelsController } from './threat-models.controller';
import { ThreatModelsService } from './threat-models.service';

@Module({
  controllers: [ThreatModelsController],
  providers: [ThreatModelsService],
})
export class ThreatModelsModule {}
