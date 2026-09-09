import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * The specification requires a reason on every cancellation, so it is
 * mandatory here rather than optional.
 */
export class CancelRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'A cancellation must record a reason.' })
  @MaxLength(1000)
  reason: string;
}