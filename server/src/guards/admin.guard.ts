import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-admin-token'] || req.headers['x-admin-token'.toLowerCase()];
    const adminToken = process.env.ADMIN_TOKEN;
    // If no ADMIN_TOKEN is configured, allow access (no auth required).
    if (!adminToken) return true;
    if (header === adminToken) return true;
    throw new UnauthorizedException('Invalid admin token');
  }
}
