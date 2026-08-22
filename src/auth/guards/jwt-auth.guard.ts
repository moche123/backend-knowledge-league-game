import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}


// isPublic: booleano — true si la ruta actual tiene @Public() puesto (en el método o en el controller),
//  si no undefined. Es la respuesta a "¿esta ruta necesita JWT o no?".

// getHandler(): devuelve el método específico del controller que va a atender el request — ej. register o login. 
// Ahí es donde chequea si pusiste @Public() en ese método puntual.

// getClass(): devuelve la clase del controller completo — ej. AuthController. Si pusieras @Public() arriba de toda
//  la clase (no de un método), acá lo encuentra — cubriría todos sus endpoints de una.

// En resumen: mira primero el método, si no tiene la metadata mira la clase entera — así sabe si esa request puntual 
// queda exenta del JWT.