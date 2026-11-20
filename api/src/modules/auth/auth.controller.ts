import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current.decorators';
import { Public } from '../../common/decorators/public.decorator';
import type { AppRequest, AuthUser } from '../../common/types/request.types';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE, TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto, requestMeta(req));
    this.tokens.setAuthCookies(res, result.tokens);
    return {
      user: result.user,
      workspacePublicId: result.workspacePublicId,
      accessExpiresAt: result.tokens.accessExpiresAt,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, requestMeta(req));
    this.tokens.setAuthCookies(res, result.tokens);
    return {
      user: result.user,
      accessExpiresAt: result.tokens.accessExpiresAt,
    };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    const result = await this.auth.refresh(refreshToken, requestMeta(req));
    this.tokens.setAuthCookies(res, result.tokens);
    return {
      user: result.user,
      accessExpiresAt: result.tokens.accessExpiresAt,
    };
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req as { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    await this.auth.logout(refreshToken);
    this.tokens.clearAuthCookies(res);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

function requestMeta(req: AppRequest): { ip?: string; userAgent?: string } {
  return {
    ip: req.ip,
    userAgent: req.header('user-agent')?.slice(0, 255),
  };
}
