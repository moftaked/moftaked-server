import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesDec } from 'src/auth/roles.decorator';
import { Roles } from 'src/users/entities/role.entity';
import { RolesGuard } from 'src/auth/roles.guard';

@Controller('classes')
@UseGuards(AuthGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  findAll() {
    return this.classesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.classesService.findOne(id);
  }

  @Get('/:id/students')
  @UseGuards(RolesGuard)
  @RolesDec(Roles.teacher, Roles.leader, Roles.manager)
  getStudents(@Param('id') id: number) {
    return this.classesService.getStudents(id);
  }
}
