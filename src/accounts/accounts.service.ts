import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { BcryptService } from 'src/bcrypt/bcrypt.service';
import { DatabaseService } from 'src/database/database.service';
import { PasswordGeneratorService } from 'src/password-generator/password-generator/password-generator.service';
import { ResultSetHeader } from 'mysql2';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class AccountsService {
  constructor(
    private readonly bcryptService: BcryptService,
    private readonly databaseService: DatabaseService,
    private readonly passwordGeneratorService: PasswordGeneratorService,
  ) {}

  async create(createAccountDto: CreateAccountDto) {
    if (createAccountDto.password == undefined) {
      const password = await this.passwordGeneratorService.generate();
      createAccountDto.password = password;
    }
    const hash = await this.bcryptService.hash(createAccountDto.password);
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      const [insertUserResult] = await connection.query<ResultSetHeader>(
        'insert into accounts(username, password, real_name) values (?, ?, ?);',
        [createAccountDto.username, hash, createAccountDto.real_name],
      );
      const userId = insertUserResult.insertId;
      await connection.query(
        `insert into roles(account_id, class_id, role, school_id)
        select ?, ?, ?, school_id from classes where class_id = ?`,
        [
          userId,
          createAccountDto.class_id,
          createAccountDto.role,
          createAccountDto.class_id,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return createAccountDto.password;
  }

  async addRole(id: number, createRoleDto: CreateRoleDto) {
    await this.databaseService.executeQuery(
      `insert into roles(account_id, class_id, role, school_id)
        select ?, ?, ?, school_id from classes where class_id = ?`,
      [id, createRoleDto.class_id, createRoleDto.role, createRoleDto.class_id],
    );
  }

  async getRoles(id: number) {
    const roles = await this.databaseService.executeQuery(
      'select role_id, class_id, role, school_id from roles where account_id = ?',
      [id],
    );
    return roles;
  }

  async deleteRole(id: number) {
    const result = await this.databaseService.executeQuery<ResultSetHeader>(
      'delete from roles where role_id = ?',
      [id],
    );
    if (result.affectedRows == 0) throw new ForbiddenException();
  }
}
