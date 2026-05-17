import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService, LoginResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { extractHostname } from './host';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Req() req: Request, @Body() dto: LoginDto): Promise<LoginResponse> {
    const hostname = extractHostname(req.headers);
    return this.authService.login(hostname, dto);
  }
}
