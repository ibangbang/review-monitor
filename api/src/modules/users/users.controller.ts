import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current.decorators';
import type { AuthUser } from '../../common/types/request.types';
import { UpdateProfileDto } from '../auth/auth.dto';
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Patch('me')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }
}
