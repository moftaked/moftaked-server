import bcrypt from 'bcrypt';
import { User } from '../types';
import { executeQuery } from './database.service';
import jwt from 'jsonwebtoken';
import { Roles } from '../enums/roles.enum';
import rolesService from './roles.service';

let jwtSecret: string;

function init(secret: string) {
  jwtSecret = secret;
}

async function signIn(username: string, password: string) {
  const userTableResults = await executeQuery<User[]>(
    'select account_id, username, password, real_name from accounts where username = ?',
    [username],
  );
  if (!userTableResults[0]) throw new Error('user not found'); // todo: implement better error type
  const user = userTableResults[0];
  if ((await compare(password, user.password)) === false) {
    throw new Error('unauthorized'); // todo: implement better error type
  }
  const roles = await rolesService.getRoles(user.account_id);
  const payload = { sub: user.account_id, username: user.username };
  return {
    access_token: generateAccessToken(payload),
    user_id: user.account_id,
    roles: JSON.stringify(roles),
  };
}

async function compare(password: string, hashed: string) {
  const res = await bcrypt.compare(password, hashed);
  return res;
}

function generateAccessToken(payload: unknown) {
  // todo: we should ES256
  return jwt.sign({ payload }, jwtSecret, {
    expiresIn: '1Days',
    algorithm: 'HS256',
  });
}

function verify(token: string) {
  return jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;
  // return jwt.verify(token, jwtSecret, {algorithms: ['ES256']});
}

async function isInAnyClass(
  userId: number,
  classIds: number[],
  authorizedRoles: Roles[],
) {
  const roles = await rolesService.getRoles(userId, classIds);
  return roles.some(role => {
    return (
      classIds.includes(role['class_id']) &&
      authorizedRoles.some(authorizedRole => authorizedRole === role['role'])
    );
  });
}

async function hasRole(userId: number, requiredRole: Roles) {
  const roles = await rolesService.getRoles(userId);
  return roles.some(role => role['role'] === requiredRole);
}

export default { signIn, init, verify, isInAnyClass, hasRole };
