import { Module } from '@nestjs/common';
import { SocController } from './soc.controller';
import { SocService } from './soc.service';

@Module({
  controllers: [SocController],
  providers: [SocService],
  exports: [SocService],
})
export class SocModule {}
