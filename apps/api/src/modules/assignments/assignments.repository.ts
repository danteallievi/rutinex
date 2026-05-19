import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantScopedRepository } from '../../common/repository/tenant-scoped.repository';
import { Assignment } from './entities/assignment.entity';

@Injectable()
export class AssignmentsRepository extends TenantScopedRepository<Assignment> {
  constructor(dataSource: DataSource) {
    super(Assignment, dataSource.createEntityManager());
  }
}
