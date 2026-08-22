// import { createParamDecorator, ExecutionContext } from '@nestjs/common';
// import { AuthenticatedUser } from '../strategies/jwt.strategy';

// Uso: registerHandler(@CurrentUser() user: AuthenticatedUser) — evita repetir
// `req.user` en cada controller protegido por JwtAuthGuard.
// export const CurrentUser = createParamDecorator(
//   (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
//     const request = ctx.switchToHttp().getRequest();
//     return request.user;
//   },
// );
