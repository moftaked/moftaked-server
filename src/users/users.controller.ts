import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { authorizedRequest, reqUser } from 'src/types';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  checkPermissions(user: reqUser, userId: number) {
    const isAuthorized = user.sub == userId;
    if (isAuthorized == false) throw new ForbiddenException();
  }

  @Get(':id/classes')
  getClasses(@Param('id') userId: number, @Req() request: authorizedRequest) {
    this.checkPermissions(request.user, userId);
    return this.usersService.getClasses(userId);
  }

  @Get(':id/schools')
  getSchools(@Param('id') userId: number, @Req() request: authorizedRequest) {
    this.checkPermissions(request.user, userId);
    return this.usersService.getSchools(userId);
  }
}
