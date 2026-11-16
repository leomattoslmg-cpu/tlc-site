import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, RequisicaoAutenticada } from '../auth/auth.guard';
import { Permissao, PermissaoGuard } from '../auth/permissao.guard';
import { Erros } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { idSchema } from '../eventos/eventos.schemas';
import { AvisoInput, avisoSchema, EditarAvisoInput, editarAvisoSchema } from './avisos.schemas';
import { AvisosService } from './avisos.service';

function usuario(req: RequisicaoAutenticada) {
  if (!req.user) throw Erros.naoAutenticado();
  return req.user;
}

/** Mural de avisos: todo membro lê; quem tem avisos:publicar cria e edita. */
@Controller('avisos')
@UseGuards(AuthGuard, PermissaoGuard)
export class AvisosController {
  constructor(private readonly avisos: AvisosService) {}

  @Get()
  listar(@Req() req: RequisicaoAutenticada) {
    return this.avisos.listar(usuario(req));
  }

  @Get(':id')
  detalhe(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Req() req: RequisicaoAutenticada) {
    return this.avisos.detalhe(usuario(req), id);
  }

  @Post()
  @Permissao('avisos:publicar')
  criar(@Body(new ZodValidationPipe(avisoSchema)) corpo: AvisoInput, @Req() req: RequisicaoAutenticada) {
    return this.avisos.criar(usuario(req), corpo, req.ip);
  }

  @Patch(':id')
  @HttpCode(204)
  @Permissao('avisos:publicar')
  async editar(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Body(new ZodValidationPipe(editarAvisoSchema)) corpo: EditarAvisoInput, @Req() req: RequisicaoAutenticada): Promise<void> {
    await this.avisos.editar(usuario(req), id, corpo, req.ip);
  }
}
