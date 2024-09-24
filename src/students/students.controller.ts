import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Delete,
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

@Controller('students')
@UseGuards(AuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createStudentSchema))
    createStudentDto: CreateStudentDto,
  ) {
    return this.studentsService.create(createStudentDto);
  }

  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStudentSchema))
    student: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, student);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.studentsService.delete(id);
  }
}
