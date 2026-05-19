import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PersonalRecord } from './entities/personal-record.entity';
import { PersonalRecordsController } from './personal-records.controller';
import { PersonalRecordsRepository } from './personal-records.repository';
import { PersonalRecordsService } from './personal-records.service';

@Module({
  imports: [TypeOrmModule.forFeature([PersonalRecord])],
  controllers: [PersonalRecordsController],
  providers: [PersonalRecordsService, PersonalRecordsRepository],
  exports: [PersonalRecordsService],
})
export class PersonalRecordsModule {}
