import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantScopedRepository } from '../../common/repository/tenant-scoped.repository';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionsRepository extends TenantScopedRepository<Session> {
  constructor(dataSource: DataSource) {
    super(Session, dataSource.createEntityManager());
  }
}
