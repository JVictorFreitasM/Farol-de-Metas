import { Indicador, Meta, Produto, Setor, Usuario } from "@prisma/client";
import { MESES } from "./metasCalc";

// OS-013: nome/unidade/hierarquia/regras de agregação vivem em Indicador — a serialização
// de Meta precisa da relação carregada para expor o mesmo formato de resposta de antes.
export type MetaComRelacoes = Meta & {
  setor?: Setor;
  atualizadoPorUsuario?: Usuario | null;
  inativadoPorUsuario?: Usuario | null;
  indicador: Indicador & { produto?: Produto | null };
};

export function serializeMeta(
  meta: MetaComRelacoes,
  opts?: { paiMetaId?: string | null; ivs?: MetaComRelacoes[] }
) {
  const meses: Record<string, { meta: unknown; real: unknown; status: unknown }> = {};
  for (const mes of MESES) {
    const chave = mes.toLowerCase();
    meses[chave] = {
      meta: meta[`meta${mes}` as keyof Meta],
      real: meta[`real${mes}` as keyof Meta],
      status: meta[`status${mes}` as keyof Meta],
    };
  }

  return {
    id: meta.id,
    setor_id: meta.setorId,
    nome_setor: meta.setor?.nome,
    indicador_id: meta.indicadorId,
    // pai_id aponta para a linha de Meta (mesmo ano) do IC pai, não para indicador.paiId
    // (esse é o id do Indicador pai — outra entidade/tabela). O chamador precisa resolver
    // qual Meta do mesmo ano corresponde a esse indicador pai e passar via paiMetaId.
    pai_id: opts?.paiMetaId ?? null,
    ano: meta.ano,
    ordem: meta.ordem,
    produto_id: meta.indicador.produtoId,
    produto: meta.indicador.produto?.nome ?? null,
    ic_iv: meta.indicador.icIv,
    indicador: meta.indicador.nome,
    responsavel: meta.responsavel,
    unidade: meta.indicador.unidade,
    tipo_meta: meta.tipoMeta,
    agrega_ivs: meta.indicador.agregaIvs,
    tipo_acumulado_meta: meta.indicador.tipoAcumuladoMeta,
    tipo_acumulado_real: meta.indicador.tipoAcumuladoReal,
    tipo_agregacao_meta: meta.indicador.tipoAgregacaoMeta,
    tipo_agregacao_real: meta.indicador.tipoAgregacaoReal,
    // OS-015: valor fixo de real acumulado do IC agregador (indicador.tipo_agregacao_real =
    // real_manual), mesmo padrão do tipo_agregacao_meta acima.
    real_manual_acum: meta.indicador.realManualAcum,
    meta_manual_acum: meta.metaManualAcum,
    // OS-015: valor fixo de acumulado da própria linha, usado quando tipo_acumulado_meta/
    // tipo_acumulado_real = "manual" (separados por lado).
    acum_meta_manual: meta.acumMetaManual,
    acum_real_manual: meta.acumRealManual,
    meta_ano: meta.metaAno,
    meses,
    acum_meta: meta.acumMeta,
    acum_real: meta.acumReal,
    status_acum: meta.statusAcum,
    atualizado_por_usuario: meta.atualizadoPorUsuario?.nome ?? null,
    atualizado_em: meta.atualizadoEm,
    ativo: meta.ativo,
    inativado_em: meta.inativadoEm,
    inativado_por_usuario: meta.inativadoPorUsuario?.nome ?? null,
    ...(meta.indicador.icIv === "IC" && opts?.ivs
      ? {
          ivs: opts.ivs.map((f) => ({
            id: f.id,
            ic_iv: f.indicador.icIv,
            indicador: f.indicador.nome,
            acum_meta: f.acumMeta,
            acum_real: f.acumReal,
            status_acum: f.statusAcum,
          })),
        }
      : {}),
  };
}
