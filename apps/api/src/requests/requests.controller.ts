import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { AssignRequestDto } from './dto/assign-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestsService } from './requests.service';

/**
 * Transitions are POSTs to named actions rather than a PATCH that sets a
 * status field.
 *
 * That is deliberate. A PATCH would invite the client to name the target
 * state, and the whole point of this milestone is that the server decides
 * what moves are legal. The client asks for an action; the domain decides
 * what state it produces.
 */
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  async create(@Body() dto: CreateRequestDto) {
    return this.requests.create(dto.title, dto.description, dto.departmentId, dto.requesterId);
  }

  @Get()
  async findAll() {
    return this.requests.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.requests.findById(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string) {
    return this.requests.approve(id);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  async assign(@Param('id') id: string, @Body() dto: AssignRequestDto) {
    return this.requests.assign(id, dto.assigneeId);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    return this.requests.complete(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Body() dto: CancelRequestDto) {
    return this.requests.cancel(id, dto.reason);
  }
}