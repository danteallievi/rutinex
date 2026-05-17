import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SuperadminController } from './superadmin.controller';

@Module({
  imports: [AuthModule],
  controllers: [SuperadminController],
})
export class SuperadminModule {}
