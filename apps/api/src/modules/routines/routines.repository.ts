import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantScopedRepository } from '../../common/repository/tenant-scoped.repository';
import { Routine } from './entities/routine.entity';

@Injectable()
export class RoutinesRepository extends TenantScopedRepository<Routine> {
  constructor(dataSource: DataSource) {
    super(Routine, dataSource.createEntityManager());
  }
}
