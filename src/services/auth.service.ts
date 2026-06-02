import bcrypt from 'bcrypt';
import { User } from '../types';
import { executeQuery } from './database.service';
import jwt from 'jsonwebtoken';
import { Roles } from '../enums/roles.enum';
import rolesService from './roles.service';
import { Err, Ok } from 'result2';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import path from 'path';

let jwtSecret: string;
let jwtPrivateKey: string;
let jwtPublicKey: string;

function init(secret: string) {
  jwtSecret = secret;
  const privateKeyPath = process.env['JWT_PRIVATE_KEY_PATH'];
  const publicKeyPath = process.env['JWT_PUBLIC_KEY_PATH'];
  const defaultPrivateKeyPath = path.resolve(__dirname, '../../private-key.pem');
  const defaultPublicKeyPath = path.resolve(__dirname, '../../public-key.pem');

  if (privateKeyPath && publicKeyPath) {
    jwtPrivateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
    jwtPublicKey = fs.readFileSync(path.resolve(publicKeyPath), 'utf8');
  } else if (fs.existsSync(defaultPrivateKeyPath) && fs.existsSync(defaultPublicKeyPath)) {
    jwtPrivateKey = fs.readFileSync(defaultPrivateKeyPath, 'utf8');
    jwtPublicKey = fs.readFileSync(defaultPublicKeyPath, 'utf8');
  }
}

async function signIn(username: string, password: string) {
  const userTableResults = await executeQuery<User[]>(
    'select account_id, username, password, real_name from accounts where username = ?',
    [username],
  );
  if (!userTableResults[0]) return Err(StatusCodes.UNAUTHORIZED);
  const user = userTableResults[0];
  if ((await compare(password, user.password)) === false) {
    return Err(StatusCodes.UNAUTHORIZED);
  }
  const roles = await rolesService.getRoles(user.account_id);
  const payload = { sub: user.account_id, username: user.username };
  return Ok({
    access_token: generateAccessToken(payload),
    user_id: user.account_id,
    roles: JSON.stringify(roles),
  });
}

async function compare(password: string, hashed: string) {
  const res = await bcrypt.compare(password, hashed);
  return res;
}

function generateAccessToken(payload: unknown) {
  if (jwtPrivateKey) {
    return jwt.sign({ payload }, jwtPrivateKey, {
      expiresIn: '1Days',
      algorithm: 'ES256',
    });
  }
  return jwt.sign({ payload }, jwtSecret, {
    expiresIn: '1Days',
    algorithm: 'HS256',
  });
}

function verify(token: string) {
  if (jwtPublicKey) {
    return jwt.verify(token, jwtPublicKey, {
      algorithms: ['ES256'],
    }) as jwt.JwtPayload;
  }
  return jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;
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

async function hasRole(userId: number, requiredRoles: Roles[]) {
  const roles = await rolesService.getRoles(userId);
  return roles
  .some(userRole => requiredRoles
    .some(requiredRole => userRole['role'] === requiredRole));
}

async function isManagerOfClass(userId: number, classId: number) {
  const roles = await rolesService.getRoles(userId, [classId]);
  return roles.some(role => role['role'] === Roles.manager);
}

async function isManagerOfSchool(userId: number, schoolId: number) {
  const roles = await rolesService.getRoles(userId, undefined, schoolId);
  return roles.some(role => role['role'] === Roles.manager);
}

async function isAdmin(userId: number) {
  const roles = await rolesService.getRoles(userId);
  return roles.some(role => role['role'] === Roles.admin);
}

export default { signIn, init, verify, isInAnyClass, hasRole, isManagerOfClass, isManagerOfSchool, isAdmin };
