import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Delete,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import {
  CreateStudentDto,
  createStudentSchema,
} from './dto/create-student.dto';
import { ZodValidationPipe } from 'src/ZodValidationPipe';
import { AuthGuard } from 'src/auth/auth.guard';
import {
  updateStudentSchema,
  UpdateStudentDto,
} from './dto/update-student.dto';
import { authorizedRequest, reqUser } from 'src/types';

@Controller('students')
@UseGuards(AuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  checkPermissions(user: reqUser, class_id: number) {
    const isAuthorized = user.roles.some((claimedRole) => {
      return claimedRole.class_id == class_id;
    });
    if (isAuthorized == false) throw new ForbiddenException();
  }

  async getClassesAndCheckPermissions(user: reqUser, student_id: number) {
    const classIds =
      await this.studentsService.getClassIdsByStudentId(student_id);
    const authorized = classIds.some((ClassId) => {
      return user.roles.some((role) => {
        return role.class_id == ClassId.class_id;
      });
    });
    return authorized;
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createStudentSchema))
    createStudentDto: CreateStudentDto,
    @Req() request: authorizedRequest,
  ) {
    this.checkPermissions(request.user, createStudentDto.class_id);
    return this.studentsService.create(createStudentDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: number, @Req() request: authorizedRequest) {
    const authorized = await this.getClassesAndCheckPermissions(
      request.user,
      id,
    );
    if (authorized == false) throw new ForbiddenException();
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body(new ZodValidationPipe(updateStudentSchema))
    student: UpdateStudentDto,
    @Req() request: authorizedRequest,
  ) {
    const authorized = await this.getClassesAndCheckPermissions(
      request.user,
      id,
    );
    if (authorized == false) throw new ForbiddenException();
    return this.studentsService.update(id, student);
  }

  @Delete(':id')
  async delete(@Param('id') id: number, @Req() request: authorizedRequest) {
    const authorized = await this.getClassesAndCheckPermissions(
      request.user,
      id,
    );
    if (authorized == false) throw new ForbiddenException();
    return this.studentsService.delete(id);
  }
}
