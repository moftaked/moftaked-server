import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { Roles } from 'src/users/entities/role.entity';
import { Post } from '@nestjs/common';
import { ZodValidationPipe } from 'src/ZodValidationPipe';
import {
  createAccountSchema,
  CreateAccountDto,
} from './dto/create-account.dto';
import { CreateRoleDto, createRoleSchema } from './dto/create-role.dto';
import { authorizedRequest } from 'src/types';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createAccountSchema))
    createAccountDto: CreateAccountDto,
    @Req() req: authorizedRequest,
  ) {
    const authorized = req.user.roles.some(
      (role) =>
        role.role == Roles.manager &&
        role.class_id == createAccountDto.class_id,
    );
    if (!authorized) throw new ForbiddenException();
    return await this.accountsService.create(createAccountDto);
  }

  @Post(':id/roles')
  async addRole(
    @Param('id') id: number,
    @Body(new ZodValidationPipe(createRoleSchema)) createRoleDto: CreateRoleDto,
    @Req() req: authorizedRequest,
  ) {
    const authorized = req.user.roles.some(
      (role) =>
        role.role == Roles.manager && role.class_id == createRoleDto.class_id,
    );
    if (!authorized) throw new ForbiddenException();
    return await this.accountsService.addRole(id, createRoleDto);
  }

  @Get(':id/roles')
  async getRoles(@Param('id') id: number, @Req() req: authorizedRequest) {
    const authorized = req.user.roles.some(
      (role) => role.role == Roles.manager && role.class_id == id,
    );
    if (!authorized) throw new ForbiddenException();
    return await this.accountsService.getRoles(id);
  }

  @Delete(':id/roles')
  async deleteRole(@Param('id') id: number, @Req() req: authorizedRequest) {
    const authorized = req.user.roles.some(
      (role) => role.role == Roles.manager && role.class_id == id,
    );
    if (!authorized) throw new ForbiddenException();
    return await this.accountsService.deleteRole(id);
  }
}
