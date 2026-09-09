import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'A request must have a title.' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'A request must have a description.' })
  @MaxLength(5000)
  description: string;
}