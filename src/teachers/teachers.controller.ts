import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TeachersService } from './teachers.service';
import {
  CreateTeacherDto,
  createTeacherSchema,
} from './dto/create-teacher.dto';
import { ZodValidationPipe } from 'src/ZodValidationPipe';
import { authorizedRequest, reqUser } from 'src/types';
import {
  UpdateTeacherDto,
  updateTeacherSchema,
} from './dto/update-teacher.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('teachers')
@UseGuards(AuthGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  checkPermissions(user: reqUser, class_id: number) {
    const isAuthorized = user.roles.some((claimedRole) => {
      return (
        claimedRole.class_id == class_id &&
        (claimedRole.role == 'leader' || claimedRole.role == 'manager')
      );
    });
    if (isAuthorized == false) throw new ForbiddenException();
  }

  async getClassesAndCheckPermissions(user: reqUser, teacher_id: number) {
    const classIds =
      await this.teachersService.getClassIdsByTeacherId(teacher_id);
    const authorized = classIds.some((ClassId) => {
      return user.roles.some((role) => {
        return (
          role.class_id == ClassId.class_id &&
          (role.role == 'leader' || role.role == 'manager')
        );
      });
    });
    return authorized;
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createTeacherSchema))
    createTeacherDto: CreateTeacherDto,
    @Req() request: authorizedRequest,
  ) {
    this.checkPermissions(request.user, createTeacherDto.class_id);
    return this.teachersService.create(createTeacherDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: number, @Req() request: authorizedRequest) {
    const authorized = await this.getClassesAndCheckPermissions(
      request.user,
      id,
    );
    if (authorized == false) throw new ForbiddenException();
    return this.teachersService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body(new ZodValidationPipe(updateTeacherSchema))
    updateTeacherDto: UpdateTeacherDto,
    @Req() request: authorizedRequest,
  ) {
    const authorized = await this.getClassesAndCheckPermissions(
      request.user,
      id,
    );
    if (authorized == false) throw new ForbiddenException();
    return this.teachersService.update(id, updateTeacherDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number, @Req() request: authorizedRequest) {
    const authorized = await this.getClassesAndCheckPermissions(
      request.user,
      id,
    );
    if (authorized == false) throw new ForbiddenException();
    return this.teachersService.remove(id);
  }
}
