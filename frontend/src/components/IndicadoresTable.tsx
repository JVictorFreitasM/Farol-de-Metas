import { Fragment, useState } from "react";
import { Meta } from "../types";

interface ItemIc {
  ic: Meta;
  ivs: Meta[];
}

function agruparPorIc(metas: Meta[]): ItemIc[] {
  const ics = metas.filter((m) => m.ic_iv === "IC").sort((a, b) => a.ordem - b.ordem);
  const ivsPorPai = new Map<string, Meta[]>();
  for (const m of metas) {
    if (m.pai_id) {
      const lista = ivsPorPai.get(m.pai_id) ?? [];
      lista.push(m);
      ivsPorPai.set(m.pai_id, lista);
    }
  }
  for (const lista of ivsPorPai.values()) lista.sort((a, b) => a.ordem - b.ordem);
  return ics.map((ic) => ({ ic, ivs: ivsPorPai.get(ic.id) ?? [] }));
}

export function IndicadoresTable({
  metas,
  podeGerenciar,
  onDeletar,
  onInativar,
  onAtivar,
}: {
  metas: Meta[];
  podeGerenciar: boolean;
  onDeletar: (id: string) => Promise<void>;
  onInativar: (id: string, motivo?: string) => Promise<void>;
  onAtivar: (id: string) => Promise<void>;
}) {
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  if (metas.length === 0) {
    return <p>Nenhum indicador cadastrado para este setor.</p>;
  }

  const grupos = agruparPorIc(metas);

  const renderLinha = (meta: Meta, indentado: boolean) => (
    <tr key={meta.id} className={meta.ativo ? "" : "indicador-row-inativo"}>
      <td>
        <span className={`badge-ic-iv ${meta.ic_iv === "IC" ? "badge-ic" : "badge-iv"}`}>{meta.ic_iv}</span>
      </td>
      <td style={indentado ? { paddingLeft: 24 } : undefined}>{meta.indicador}</td>
      <td>{meta.responsavel}</td>
      <td>{meta.produto ?? "-"}</td>
      <td>{meta.unidade}</td>
      <td>{meta.ativo ? "Ativo" : "Inativo"}</td>
      <td>
        {podeGerenciar && (
          <>
            {meta.ativo ? (
              <button className="btn-link btn-link-warning" onClick={() => onInativar(meta.id)}>
                Inativar
              </button>
            ) : (
              <button className="btn-link btn-link-success" onClick={() => onAtivar(meta.id)}>
                Ativar
              </button>
            )}
            {confirmandoExclusao === meta.id ? (
              <span className="acoes-confirmar">
                <button
                  className="btn-link btn-link-danger"
                  onClick={async () => {
                    await onDeletar(meta.id);
                    setConfirmandoExclusao(null);
                  }}
                >
                  Confirmar
                </button>
                <button className="btn-link" onClick={() => setConfirmandoExclusao(null)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button className="btn-link btn-link-danger" onClick={() => setConfirmandoExclusao(meta.id)}>
                Remover
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );

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
