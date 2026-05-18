import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../auth/tenant-id.decorator';
import { ConfirmMediaDto } from './dto/confirm-media.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import type {
  ConfirmMediaResponse,
  UploadUrlResponse,
} from './dto/media.response';
import { MediaService } from './media.service';

/**
 * Storage de media (Step 15, ADR-023).
 *
 * Ambos endpoints exigen rol OWNER o TRAINER — los STUDENTS no suben media
 * (sólo la consumen como parte de exercises, leyendo `GET /exercises/:id`).
 */
@Controller('media')
@Roles('OWNER', 'TRAINER')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async createUploadUrl(
    @TenantId() tenantId: string,
    @Body() dto: CreateUploadUrlDto,
  ): Promise<UploadUrlResponse> {
    return this.mediaService.createUploadUrl(tenantId, dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @TenantId() tenantId: string,
    @Body() dto: ConfirmMediaDto,
  ): Promise<ConfirmMediaResponse> {
    return this.mediaService.confirm(tenantId, dto);
  }
}
