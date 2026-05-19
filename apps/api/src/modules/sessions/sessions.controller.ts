import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../auth/tenant-id.decorator';
import { AddSetDto } from './dto/add-set.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions.query.dto';
import type {
  CursorPaginatedSessionsResponse,
  SessionResponse,
  TodaySessionResponse,
} from './dto/session.response';
import { SessionsService } from './sessions.service';

/**
 * Endpoints de sesiones y sets (Step 18 / ADR-026).
 *
 * - `POST /sessions` (STUDENT): arranca sesión + snapshot.
 * - `GET /sessions/today` (STUDENT): asignación que aplica hoy + snapshot live.
 * - `POST /sessions/:id/sets` (STUDENT): carga set.
 * - `POST /sessions/:id/complete` (STUDENT): cierra sesión.
 * - `GET /sessions` (sin @Roles): cursor pagination — STUDENT sólo lo suyo
 *   (gate fino en service), TRAINER lo de sus students, OWNER cualquiera.
 */
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles('STUDENT')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ): Promise<SessionResponse> {
    return this.sessionsService.create(tenantId, actor, dto);
  }

  @Get('today')
  @Roles('STUDENT')
  async today(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TodaySessionResponse | null> {
    return this.sessionsService.getToday(tenantId, actor);
  }

  @Get()
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSessionsQueryDto,
  ): Promise<CursorPaginatedSessionsResponse> {
    return this.sessionsService.list(tenantId, actor, query);
  }

  @Post(':id/sets')
  @Roles('STUDENT')
  @HttpCode(HttpStatus.CREATED)
  async addSet(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: AddSetDto,
  ): Promise<SessionResponse> {
    return this.sessionsService.addSet(tenantId, actor, sessionId, dto);
  }

  @Post(':id/complete')
  @Roles('STUDENT')
  @HttpCode(HttpStatus.OK)
  async complete(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ): Promise<SessionResponse> {
    return this.sessionsService.complete(tenantId, actor, sessionId);
  }
}
