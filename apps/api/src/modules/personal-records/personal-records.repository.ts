import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantScopedRepository } from '../../common/repository/tenant-scoped.repository';
import { PersonalRecord } from './entities/personal-record.entity';

@Injectable()
export class PersonalRecordsRepository extends TenantScopedRepository<PersonalRecord> {
  constructor(dataSource: DataSource) {
    super(PersonalRecord, dataSource.createEntityManager());
  }
}
