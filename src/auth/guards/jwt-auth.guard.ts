import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  //context: ExecutionContext — objeto que representa la request actual de forma genérica (HTTP, WebSocket, RPC — acá es HTTP).
  //  Te deja acceder al método y la clase que van a atender esa request.
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      //context.getHandler() — el método específico del controller que matchea la ruta (ej. login, register).
      context.getHandler(),
      //context.getClass() — la clase entera del controller (ej. AuthController).
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// en conclusion esto: const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ ... primero busca dentro de el controlador de auth,
// ya sea ruta login o register, que tengan el decorador Public, encontrado ya que el nombre del decorador o su llave se llama isPublic

// isPublic: booleano — true si la ruta actual tiene @Public() puesto (en el método o en el controller),
//  si no undefined. Es la respuesta a "¿esta ruta necesita JWT o no?".

// getHandler(): devuelve el método específico del controller que va a atender el request — ej. register o login.
// Ahí es donde chequea si pusiste @Public() en ese método puntual.

// getClass(): devuelve la clase del controller completo — ej. AuthController. Si pusieras @Public() arriba de toda
//  la clase (no de un método), acá lo encuentra — cubriría todos sus endpoints de una.

// En resumen: mira primero el método, si no tiene la metadata mira la clase entera — así sabe si esa request puntual
// queda exenta del JWT.
