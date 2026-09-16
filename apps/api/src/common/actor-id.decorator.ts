import { BadRequestException, ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts the acting user's id from the X-User-Id header.
 *
 * There is no session or token in this slice; the header is the only signal
 * for "who is calling." A missing or blank header is a malformed request,
 * not an authorization failure, so this throws Nest's built-in
 * BadRequestException (400) rather than a domain error - matching the
 * existing precedent that 400s in this app use Nest's default shape.
 *
 * A custom decorator instead of three copies of @Headers('x-user-id') plus a
 * repeated empty-string check: it is used identically in three places
 * (create, approve, assign), and centralising it is what makes "resolved
 * before any DB call" a guarantee rather than something re-derived at each
 * call site.
 */
export const ActorId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const header = request.headers['x-user-id'];
  const actorId = Array.isArray(header) ? header[0] : header;

  if (!actorId || actorId.trim() === '') {
    throw new BadRequestException('The X-User-Id header is required.');
  }

  return actorId;
});
