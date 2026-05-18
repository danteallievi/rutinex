import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantScopedRepository } from '../../common/repository/tenant-scoped.repository';
import { Exercise } from './entities/exercise.entity';

@Injectable()
export class ExercisesRepository extends TenantScopedRepository<Exercise> {
  constructor(dataSource: DataSource) {
    super(Exercise, dataSource.createEntityManager());
  }
}
