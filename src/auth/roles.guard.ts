import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from './roles.decorator';
import { Request } from 'express';
import { reqUser } from 'src/types';
import { Roles } from 'src/users/entities/role.entity';

@Injectable()
export class RolesGuard implements CanActivate {

  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Roles[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if(!requiredRoles)
      return true;

    const req = context.switchToHttp().getRequest();
    const user: reqUser = req.user;
    return requiredRoles.some((requiredRole) => {
      return user.roles.some((claimedRole) => {
        return (claimedRole.class_id == req.params.id) && (requiredRole == claimedRole.role);
      })
    })
  }
}
