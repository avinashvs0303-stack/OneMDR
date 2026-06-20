import { Module } from '@nestjs/common';
import { DetectionsController } from './detections.controller';
import { DetectionsService } from './detections.service';

@Module({
  controllers: [DetectionsController],
  providers: [DetectionsService],
  exports: [DetectionsService],
})
export class DetectionsModule {}
