import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentAdmin } from '../../common/decorators/current.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import type { AdminContext } from '../../common/types/request.types';
import { AdminAuthService, extractAdminToken } from './admin-auth.service';
import { AdminLoginDto } from './admin.dto';

@Controller('admin/auth')
@Public()
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: AdminLoginDto, @Req() request: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, { ip: request.ip, userAgent: request.header('user-agent') }, res);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(request, res);
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentAdmin() admin: AdminContext) {
    return this.auth.me(admin.id);
  }

  @Get('session')
  @UseGuards(AdminAuthGuard)
  session(@Req() request: Request) {
    return { hasToken: Boolean(extractAdminToken(request)) };
  }
}
