import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { authorizedRequest } from 'src/types';

@Controller('schools')
@UseGuards(AuthGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get('/managers/:account_id/reports')
  getManagarialReports(
    @Param('account_id') account_id: number,
    @Query('date') date: string,
    @Req() request: authorizedRequest,
  ) {
    if (account_id != request.user.sub) throw new ForbiddenException();
    return this.schoolsService.getManagarialReports(account_id, date);
  }

  @Get(':id/managers/reports/:event_name/:type')
  getManagerEventReport(
    @Param('id') school_id: number,
    @Param('event_name') event_name: string,
    @Param('type') event_type: string,
    @Query('date') date: string,
    @Req() request: authorizedRequest,
  ) {
    const authorized = request.user.roles.some((role) => {
      return role.school_id == school_id && role.role == 'manager';
    });
    if (authorized == false) throw new ForbiddenException();
    return this.schoolsService.getManagarialEventReport(
      school_id,
      event_name,
      event_type,
      date,
    );
  }

  @Get('/leaders/reports/:classId/:event_name/:type')
  getLeaderEventReport(
    @Param('classId') class_id: number,
    @Param('event_name') event_name: string,
    @Param('type') event_type: string,
    @Query('date') date: string,
    @Req() request: authorizedRequest,
  ) {
    const authorized = request.user.roles.some((role) => {
      return role.class_id == class_id && role.role == 'leader';
    });
    if (authorized == false) throw new ForbiddenException();
    return this.schoolsService.getLeaderEventReport(
      class_id,
      event_name,
      event_type,
      date,
    );
  }

  @Get('/teachers/reports/:classId/:event_name')
  getTeacherEventReport(
    @Param('classId') class_id: number,
    @Param('event_name') event_name: string,
    @Query('date') date: string,
    @Req() request: authorizedRequest,
  ) {
    const authorized = request.user.roles.some((role) => {
      return role.class_id == class_id && role.role == 'teacher';
    });
    if (authorized == false) throw new ForbiddenException();
    return this.schoolsService.getTeacherEventReport(
      class_id,
      event_name,
      date,
    );
  }

  @Get('/leaders/:account_id/reports')
  getLeaderReports(
    @Param('account_id') account_id: number,
    @Query('date') date: string,
    @Req() request: authorizedRequest,
  ) {
    if (account_id != request.user.sub) throw new ForbiddenException();
    return this.schoolsService.getLeaderReports(account_id, date);
  }

  @Get('/teachers/:account_id/reports')
  getTeacherReports(
    @Param('account_id') account_id: number,
    @Query('date') date: string,
    @Req() request: authorizedRequest,
  ) {
    if (account_id != request.user.sub) throw new ForbiddenException();
    return this.schoolsService.getTeacherReports(account_id, date);
  }

  @Get('/managers/:userId/absence/teachers')
  getAbsentTeachers(
    @Param('userId') userId: number,
    @Query('occurences') occurences: number,
    @Query('minCount') minCount: number,
    @Req() request: authorizedRequest,
  ) {
    if (request.user.sub != userId) throw new ForbiddenException();
    return this.schoolsService.getSchoolAbsentPeople(
      userId,
      'teacher',
      occurences,
      minCount,
    );
  }

  @Get('/leaders/:userId/absence')
  getLeaderAbsence(
    @Param('userId') userId: number,
    @Query('occurences') occurences: number,
    @Query('minCount') minCount: number,
    @Req() request: authorizedRequest,
  ) {
    if (request.user.sub != userId) throw new ForbiddenException();
    return this.schoolsService.getClassAbsentPeople(
      userId,
      'all',
      occurences,
      minCount,
    );
  }

  @Get('/teachers/:userId/absence')
  getTeacherAbsence(
    @Param('userId') userId: number,
    @Query('occurences') occurences: number,
    @Query('minCount') minCount: number,
    @Req() request: authorizedRequest,
  ) {
    if (request.user.sub != userId) throw new ForbiddenException();
    return this.schoolsService.getClassAbsentPeople(
      userId,
      'student',
      occurences,
      minCount,
    );
  }
}
