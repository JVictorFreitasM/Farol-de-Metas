import { Meta, Setor, Usuario } from "@prisma/client";
import { calcularAgregadoIC } from "./metasCalc";

type MetaComRelacoes = Meta & {
  setor?: Setor;
  atualizadoPorUsuario?: Usuario | null;
  filhos?: Meta[];
};

export function serializeMeta(meta: MetaComRelacoes) {
  const isIC = meta.icIv === "IC";
  const filhos = meta.filhos ?? [];

  const agregado = isIC ? calcularAgregadoIC(filhos) : null;

  return {
    id: meta.id,
    setor_id: meta.setorId,
    nome_setor: meta.setor?.nome,
    pai_id: meta.paiId,
    ano: meta.ano,
    produto: meta.produto,
    ic_iv: meta.icIv,
    indicador: meta.indicador,
    responsavel: meta.responsavel,
    unidade: meta.unidade,
    tipo_meta: meta.tipoMeta,
    meta_ano: isIC ? agregado!.metaAno : meta.metaAno,
    valor_jan: meta.valorJan,
    valor_fev: meta.valorFev,
    valor_mar: meta.valorMar,
    valor_abr: meta.valorAbr,
    valor_mai: meta.valorMai,
    valor_jun: meta.valorJun,
    valor_jul: meta.valorJul,
    valor_ago: meta.valorAgo,
    valor_set: meta.valorSet,
    valor_out: meta.valorOut,
    valor_nov: meta.valorNov,
    valor_dez: meta.valorDez,
    acumulado: isIC ? agregado!.acumulado : meta.acumulado,
    status: isIC ? agregado!.status : meta.status,
    editavel: meta.editavel,
    atualizado_por_usuario: meta.atualizadoPorUsuario?.nome ?? null,
    atualizado_em: meta.atualizadoEm,
    ...(isIC
      ? {
          filhos: filhos.map((f) => ({
            id: f.id,
            ic_iv: f.icIv,
            indicador: f.indicador,
            acumulado: f.acumulado,
            status: f.status,
          })),
        }
      : {}),
  };
}
