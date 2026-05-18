import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RoutineItem } from './entities/routine-item.entity';
import { Routine } from './entities/routine.entity';
import { RoutinesController } from './routines.controller';
import { RoutinesRepository } from './routines.repository';
import { RoutinesService } from './routines.service';

@Module({
  imports: [TypeOrmModule.forFeature([Routine, RoutineItem])],
  controllers: [RoutinesController],
  providers: [RoutinesService, RoutinesRepository],
  exports: [RoutinesService],
})
export class RoutinesModule {}
