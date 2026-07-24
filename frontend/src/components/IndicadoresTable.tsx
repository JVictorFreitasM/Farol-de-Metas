import { Fragment } from "react";
import { Indicador, Meta } from "../types";

interface ItemIc {
  ic: Indicador;
  ivs: Indicador[];
}

function agruparPorIc(indicadores: Indicador[]): ItemIc[] {
  const ics = indicadores.filter((i) => i.ic_iv === "IC").sort((a, b) => a.nome.localeCompare(b.nome));
  const ivsPorPai = new Map<string, Indicador[]>();
  for (const i of indicadores) {
    if (i.pai_id) {
      const lista = ivsPorPai.get(i.pai_id) ?? [];
      lista.push(i);
      ivsPorPai.set(i.pai_id, lista);
    }
  }
  for (const lista of ivsPorPai.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome));
  return ics.map((ic) => ({ ic, ivs: ivsPorPai.get(ic.id) ?? [] }));
}

export function IndicadoresTable({
  indicadores,
  ano,
  // Responsável, status e inativar/ativar são da Meta do ano selecionado — não do Indicador —
  // porque inativar precisa valer só para aquele ano (ex: inativar em 2027 não pode bloquear o
  // preenchimento de 2026, que pode ainda estar em aberto). Um indicador sem meta nesse ano
  // continua listado (é o bug que isso corrige), só não tem ação disponível ainda.
  metasPorIndicadorId,
  podeGerenciar,
  onInativar,
  onAtivar,
}: {
  indicadores: Indicador[];
  ano: number;
  metasPorIndicadorId: Map<string, Meta>;
  podeGerenciar: boolean;
  onInativar: (metaId: string) => Promise<void>;
  onAtivar: (metaId: string) => Promise<void>;
}) {
  if (indicadores.length === 0) {
    return <p>Nenhum indicador cadastrado para este setor.</p>;
  }

  const grupos = agruparPorIc(indicadores);

  const renderLinha = (indicador: Indicador, indentado: boolean) => {
    const meta = metasPorIndicadorId.get(indicador.id);
    return (
      <tr key={indicador.id} className={meta && !meta.ativo ? "indicador-row-inativo" : ""}>
        <td>
          <span className={`badge-ic-iv ${indicador.ic_iv === "IC" ? "badge-ic" : "badge-iv"}`}>
            {indicador.ic_iv}
          </span>
        </td>
        <td style={indentado ? { paddingLeft: 24 } : undefined}>{indicador.nome}</td>
        <td>{meta?.responsavel ?? "-"}</td>
        <td>{indicador.produto ?? "-"}</td>
        <td>{indicador.unidade}</td>
        <td>{meta ? (meta.ativo ? "Ativo" : "Inativo") : `Sem meta em ${ano}`}</td>
        <td>
          {podeGerenciar && meta && (
            meta.ativo ? (
              <button className="btn-link btn-link-warning" onClick={() => onInativar(meta.id)}>
                Inativar
              </button>
            ) : (
              <button className="btn-link btn-link-success" onClick={() => onAtivar(meta.id)}>
                Ativar
              </button>
            )
          )}
        </td>
      </tr>
    );
  };

  return (
    <table className="ranking-table">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Indicador</th>
          <th>Responsável</th>
          <th>Produto</th>
          <th>Unidade</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map(({ ic, ivs }) => (
          <Fragment key={ic.id}>
            {renderLinha(ic, false)}
            {ivs.map((iv) => renderLinha(iv, true))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
