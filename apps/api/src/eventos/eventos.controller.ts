import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, RequisicaoAutenticada } from '../auth/auth.guard';
import { Permissao, PermissaoGuard } from '../auth/permissao.guard';
import { Erros } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { anoSchema, CriarEventoInput, criarEventoSchema, idSchema, tokenSchema } from './eventos.schemas';
import { EventosService } from './eventos.service';
import { RelatoriosService } from './relatorios.service';

function usuario(req: RequisicaoAutenticada) {
  if (!req.user) throw Erros.naoAutenticado();
  return req.user;
}

/** Gestão de eventos (coordenação e secretaria). */
@Controller('eventos')
@UseGuards(AuthGuard, PermissaoGuard)
export class EventosController {
  constructor(private readonly eventos: EventosService) {}

  @Post()
  @Permissao('eventos:criar')
  criar(@Body(new ZodValidationPipe(criarEventoSchema)) corpo: CriarEventoInput, @Req() req: RequisicaoAutenticada) {
    return this.eventos.criar(usuario(req), corpo, req.ip);
  }

  @Get()
  @Permissao('eventos:participantes')
  async listar() {
    return { data: await this.eventos.listar() };
  }

  @Get(':id')
  @Permissao('eventos:participantes')
  detalhe(@Param('id', new ZodValidationPipe(idSchema)) id: string) {
    return this.eventos.detalhe(id);
  }

  @Post(':id/novo-qr')
  @HttpCode(200)
  @Permissao('eventos:editar')
  novoQr(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Req() req: RequisicaoAutenticada) {
    return this.eventos.novoQr(usuario(req), id, req.ip);
  }

  @Post(':id/cancelar')
  @HttpCode(204)
  @Permissao('eventos:editar')
  async cancelar(@Param('id', new ZodValidationPipe(idSchema)) id: string, @Req() req: RequisicaoAutenticada): Promise<void> {
    await this.eventos.cancelar(usuario(req), id, req.ip);
  }
}

/** O membro escaneia o QR do evento, entra com CPF e senha, e marca a própria presença. */
@Controller('presenca')
@UseGuards(AuthGuard)
export class PresencaController {
  constructor(private readonly eventos: EventosService) {}

  @Get(':token')
  info(@Param('token', new ZodValidationPipe(tokenSchema)) token: string, @Req() req: RequisicaoAutenticada) {
    return this.eventos.infoPresenca(token, usuario(req));
  }

  @Post(':token')
  @HttpCode(200)
  marcar(@Param('token', new ZodValidationPipe(tokenSchema)) token: string, @Req() req: RequisicaoAutenticada & Request) {
    return this.eventos.registrarPresenca(token, usuario(req), req.ip, req.header('user-agent'));
  }
}

/** Planilhas (CSV) de eventos, presenças e frequência anual. */
@Controller('relatorios')
@UseGuards(AuthGuard, PermissaoGuard)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  private baixar(res: Response, nome: string) {
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  }

  @Get('eventos')
  @Permissao('eventos:exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  eventos(@Query('ano', new ZodValidationPipe(anoSchema)) ano: number, @Req() req: RequisicaoAutenticada, @Res({ passthrough: true }) res: Response) {
    this.baixar(res, `tlc-eventos-${ano}.csv`);
    return this.relatorios.eventos(usuario(req), ano, req.ip);
  }

  @Get('presencas')
  @Permissao('eventos:exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  presencas(@Query('ano', new ZodValidationPipe(anoSchema)) ano: number, @Req() req: RequisicaoAutenticada, @Res({ passthrough: true }) res: Response) {
    this.baixar(res, `tlc-presencas-${ano}.csv`);
    return this.relatorios.presencas(usuario(req), ano, req.ip);
  }

  @Get('frequencia')
  @Permissao('eventos:exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  frequencia(@Query('ano', new ZodValidationPipe(anoSchema)) ano: number, @Req() req: RequisicaoAutenticada, @Res({ passthrough: true }) res: Response) {
    this.baixar(res, `tlc-frequencia-${ano}.csv`);
    return this.relatorios.frequencia(usuario(req), ano, req.ip);
  }
}
