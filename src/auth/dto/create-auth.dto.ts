import { IsEmail, IsString, MinLength } from 'class-validator';

// Registro público: siempre crea un usuario con rol "player" (decisión ya
// cerrada en CLAUDE.md). id, role, password_hash y created_at los asigna
// el servicio, no llegan del cliente.
export class CreateAuthDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
