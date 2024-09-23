import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { BcryptService } from 'src/bcrypt/bcrypt.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly bcryptService: BcryptService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    @Inject('JWT_SECRET') private jwtSecret: string,
  ) {}

  async getJwtSecret() {
    return this.jwtSecret;
  }

  async signIn(username: string, password: string) {
    const user = await this.userService.findOne(username);
    if ((await this.bcryptService.compare(password, user.password)) == false) {
      throw new UnauthorizedException();
    }
    // const roles = await this.userService.getRoles(user.account_id);
    const payload = { sub: user.account_id, username: user.username };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user_id: user.account_id,
    };
  }
}
