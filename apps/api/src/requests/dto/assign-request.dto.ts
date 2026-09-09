import { IsNotEmpty, IsString } from 'class-validator';

export class AssignRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'An assignment must name an assignee.' })
  assigneeId: string;
}