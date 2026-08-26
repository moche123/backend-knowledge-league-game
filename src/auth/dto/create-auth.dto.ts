import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

// Registro público: siempre crea un usuario con rol "player" (decisión ya
// cerrada en CLAUDE.md). id, role, password_hash y created_at los asigna
// el servicio, no llegan del cliente.
export class CreateAuthDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'supersecret123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
