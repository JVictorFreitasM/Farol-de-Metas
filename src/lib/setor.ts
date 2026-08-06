import { prisma } from "./prisma";
import { conflict, notFound } from "./errors";

/** OS-020: setor inativo trava novos lançamentos (criação de Produto/Indicador/Meta e edição de
 * valores de Meta existentes), mas não oculta nem apaga nada já existente — mesma regra "trava
 * sem esconder histórico" definida para Indicador na OS-019. Usado nas rotas que criam recursos
 * a partir de um setor_id direto (produtos.routes.ts, indicadores.routes.ts); as rotas de Meta
 * já carregam `setor` via include e podem checar `.ativo` sem consulta extra. */
export async function garantirSetorAtivo(setorId: string): Promise<void> {
  const setor = await prisma.setor.findUnique({ where: { id: setorId }, select: { ativo: true } });
  if (!setor) throw notFound("Setor não encontrado");
  if (!setor.ativo) throw conflict("Este setor está inativo e não permite novos lançamentos");
}
