import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { getDataSourceOptions } from './config/database';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { MediaModule } from './modules/media/media.module';
import { PersonalRecordsModule } from './modules/personal-records/personal-records.module';
import { RoutinesModule } from './modules/routines/routines.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getDataSourceOptions(),
    }),
    TenantsModule,
    UsersModule,
    AuthModule,
    SuperadminModule,
    ExercisesModule,
    MediaModule,
    RoutinesModule,
    AssignmentsModule,
    SessionsModule,
    PersonalRecordsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
