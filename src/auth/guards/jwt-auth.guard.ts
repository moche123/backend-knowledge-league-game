import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  // context: ExecutionContext — generic representation of the current request (HTTP, WebSocket, RPC — here it's HTTP).
  //  Gives access to the method and class that will handle this request.
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      // context.getHandler() — the specific controller method matching the route (e.g. login, register).
      context.getHandler(),
      // context.getClass() — the whole controller class (e.g. AuthController).
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// getAllAndOverride checks the handler first, then falls back to the class:
// true if either has @Public() metadata set (key "isPublic"), undefined otherwise —
// that's the answer to "does this route need a JWT or not?".
//
// getHandler(): the specific controller method that will handle the request — e.g.
// register or login. That's where it checks whether @Public() sits on that exact method.
//
// getClass(): the whole controller class — e.g. AuthController. If @Public() were put
// above the entire class (not a method), it's found here — covering every endpoint at once.
