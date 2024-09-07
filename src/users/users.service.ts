import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from 'src/database/database.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(username: string) {
    const userTableResults = await this.databaseService.executeQuery<User[]>(
      'select account_id, username, password, real_name from accounts where username = ?',
      [username],
    );

    return userTableResults[0];
  }

  async getRoles(accountId: number) {
    const roles = await this.databaseService.executeQuery<Role[]>(
      'select class_id, role from roles where account_id = ?',
      [accountId],
    );

    return roles;
  }

  // update(id: number, updateUserDto: UpdateUserDto) {
  //   return `This action updates a #${id} user`;
  // }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
