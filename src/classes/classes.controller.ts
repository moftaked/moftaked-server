import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesDec } from 'src/auth/roles.decorator';
import { Roles } from 'src/users/entities/role.entity';
import { RolesGuard } from 'src/auth/roles.guard';
import { EventsService } from 'src/events/events.service';
import { ZodValidationPipe } from 'src/ZodValidationPipe';
import {
  CreateAttendanceDto,
  createAttendanceSchema,
} from 'src/events/dto/create-attendance.dto';

@Controller('classes')
@UseGuards(AuthGuard)
export class ClassesController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly eventsService: EventsService,
  ) {}

  @Get()
  findAll() {
    return this.classesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.classesService.findOne(id);
  }

  @Get(':id/students')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.teacher, Roles.leader, Roles.manager)
  getStudents(@Param('id') id: number) {
    return this.classesService.getStudents(id);
  }

  @Get(':id/teachers')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.leader, Roles.manager)
  getTeachers(@Param('id') id: number) {
    return this.classesService.getTeachers(id);
  }

  @Get(':id/students/events')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.teacher, Roles.leader, Roles.manager)
  getStudentsEvents(@Param('id') id: number) {
    return this.classesService.getStudentsEvents(id);
  }

  @Get(':id/teachers/events')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.leader, Roles.manager)
  getTeachersEvents(@Param('id') id: number) {
    return this.classesService.getTeachersEvents(id);
  }

  @Get(':id/students/events/:eventId')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.teacher, Roles.leader, Roles.manager)
  getStudentsEvent(@Param('eventId') eventId: number) {
    return this.classesService.getStudentsEvent(eventId);
  }

  @Get(':id/teachers/events/:eventId')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.leader, Roles.manager)
  getTeachersEvent(@Param('eventId') eventId: number) {
    return this.classesService.getTeachersEvent(eventId);
  }

  @Post(':id/students/events/:eventId/occurences')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.leader, Roles.manager)
  async createStudentsEventOccurence(@Param('eventId') eventId: number) {
    return await this.eventsService.createStudentsEventOccurence(eventId);
  }

  @Post(':id/teachers/events/:eventId/occurences')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.manager)
  async createTeachersEventOccurence(@Param('eventId') eventId: number) {
    return await this.eventsService.createTeachersEventOccurence(eventId);
  }

  @Get(':id/students/events/:event/attendance')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.teacher, Roles.leader, Roles.manager)
  async getStudentsAttendance(
    @Param('id') classId: string,
    @Param('event') eventId: string,
  ) {
    const occurencesResult =
      await this.eventsService.getLastOccurenceId(+eventId);
    if (occurencesResult.occurences[0] == undefined)
      throw new NotFoundException();
    return this.eventsService.getStudentAttendance(
      occurencesResult.occurences[0].event_occurence_id,
      +classId,
    );
  }

  @Get(':id/teachers/events/:event/attendance')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.leader, Roles.manager)
  async getTeachersAttendance(
    @Param('id') classId: string,
    @Param('event') eventId: string,
  ) {
    const occurencesResult =
      await this.eventsService.getLastOccurenceId(+eventId);
    if (occurencesResult.occurences[0] == undefined)
      throw new NotFoundException();
    return this.eventsService.getTeacherAttendance(
      occurencesResult.occurences[0].event_occurence_id,
      +classId,
    );
  }

  @Post(':id/students/events/:event/attendance')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.teacher, Roles.leader, Roles.manager)
  async addStudentAttendance(
    @Param('id') id: string,
    @Param('event') eventId: string,
    @Body(new ZodValidationPipe(createAttendanceSchema))
    attendanceDto: CreateAttendanceDto,
  ) {
    const occurencesResult =
      await this.eventsService.getLastOccurenceId(+eventId);
    if (occurencesResult.occurences[0] == undefined)
      throw new NotFoundException();
    this.eventsService.addStudentsAttendance(
      +id,
      occurencesResult.occurences[0].event_occurence_id,
      attendanceDto,
    );
    this.eventsService.deleteStudentsAttendance(
      occurencesResult.occurences[0].event_occurence_id,
      attendanceDto,
    );
  }

  @Post(':id/teachers/events/:event/attendance')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.leader, Roles.manager)
  async addTeacherAttendance(
    @Param('id') id: string,
    @Param('event') eventId: string,
    @Body(new ZodValidationPipe(createAttendanceSchema))
    attendanceDto: CreateAttendanceDto,
  ) {
    const occurencesResult =
      await this.eventsService.getLastOccurenceId(+eventId);
    if (occurencesResult.occurences[0] == undefined)
      throw new NotFoundException();
    this.eventsService.addTeachersAttendance(
      +id,
      occurencesResult.occurences[0].event_occurence_id,
      attendanceDto,
    );
    this.eventsService.deleteTeachersAttendance(
      occurencesResult.occurences[0].event_occurence_id,
      attendanceDto,
    );
  }
}
