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
  getEventReport(
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
}
