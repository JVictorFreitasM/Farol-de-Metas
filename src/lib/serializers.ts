import { Meta, Setor, Usuario } from "@prisma/client";
import { MESES } from "./metasCalc";

type MetaComRelacoes = Meta & {
  setor?: Setor;
  atualizadoPorUsuario?: Usuario | null;
  filhos?: Meta[];
};

export function serializeMeta(meta: MetaComRelacoes) {
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
    pai_id: meta.paiId,
    ano: meta.ano,
    ordem: meta.ordem,
    produto: meta.produto,
    ic_iv: meta.icIv,
    indicador: meta.indicador,
    responsavel: meta.responsavel,
    unidade: meta.unidade,
    tipo_meta: meta.tipoMeta,
    agrega_filhos: meta.agregaFilhos,
    tipo_acumulado: meta.tipoAcumulado,
    meta_ano: meta.metaAno,
    meses,
    acum_meta: meta.acumMeta,
    acum_real: meta.acumReal,
    status_acum: meta.statusAcum,
    atualizado_por_usuario: meta.atualizadoPorUsuario?.nome ?? null,
    atualizado_em: meta.atualizadoEm,
    ...(meta.icIv === "IC" && meta.filhos
      ? {
          filhos: meta.filhos.map((f) => ({
            id: f.id,
            ic_iv: f.icIv,
            indicador: f.indicador,
            acum_meta: f.acumMeta,
            acum_real: f.acumReal,
            status_acum: f.statusAcum,
          })),
        }
      : {}),
  };
}
