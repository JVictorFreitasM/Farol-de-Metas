import { useMemo, useState } from "react";
import { AtualizarMetaBody } from "../services/metasService";
import { Meta, MESES } from "../types";

interface EditandoState {
  metaId: string;
  campo: string;
  valor: string;
}

function buildTree(metas: Meta[]): { raiz: Meta[]; filhosPorPai: Map<string, Meta[]> } {
  const filhosPorPai = new Map<string, Meta[]>();
  const raiz: Meta[] = [];

  for (const meta of metas) {
    if (meta.pai_id) {
      const lista = filhosPorPai.get(meta.pai_id) ?? [];
      lista.push(meta);
      filhosPorPai.set(meta.pai_id, lista);
    } else {
      raiz.push(meta);
    }
  }
  return { raiz, filhosPorPai };
}

function formatNumber(valor: string | number | null): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n.toString() : "-";
}

export function MetasTable({ metas, onEditar }: { metas: Meta[]; onEditar: (id: string, body: AtualizarMetaBody) => Promise<void> }) {
  const [editando, setEditando] = useState<EditandoState | null>(null);
  const { raiz, filhosPorPai } = useMemo(() => buildTree(metas), [metas]);

  const iniciarEdicao = (meta: Meta, campo: string) => {
    if (meta.ic_iv === "IC") return;
    const valorAtual = (meta as unknown as Record<string, unknown>)[`valor_${campo}`];
    setEditando({ metaId: meta.id, campo, valor: valorAtual != null ? String(valorAtual) : "" });
  };

  const salvar = async (meta: Meta) => {
    if (!editando) return;
    const numero = parseFloat(editando.valor);
    if (Number.isNaN(numero)) {
      setEditando(null);
      return;
    }
    if (meta.tipo_meta === "maior_melhor" && numero < 0) {
      setEditando(null);
      return;
    }
    try {
      await onEditar(meta.id, { [`valor_${editando.campo}`]: numero });
    } finally {
      setEditando(null);
    }
  };

  const renderLinha = (meta: Meta, nivel: number): JSX.Element => {
    const filhos = filhosPorPai.get(meta.id) ?? [];
    const isIC = meta.ic_iv === "IC";

    return (
      <>
        <tr key={meta.id} className={isIC ? "ic-row" : "iv-row"}>
          <td style={{ paddingLeft: `${nivel * 20}px` }}>
            {nivel > 0 ? "└ " : ""}
            {meta.indicador}
          </td>
          <td>{meta.unidade}</td>
          <td>{formatNumber(meta.meta_ano)}</td>
          {MESES.map((mes) => {
            const isEditing = editando?.metaId === meta.id && editando?.campo === mes;
            return (
              <td
                key={mes}
                className={isEditing ? "editing" : isIC ? "locked" : "editable"}
                title={isIC ? "ICs são calculados automaticamente" : undefined}
                onClick={() => iniciarEdicao(meta, mes)}
              >
                {isEditing ? (
                  <input
                    type="number"
                    autoFocus
                    value={editando.valor}
                    min={meta.tipo_meta === "maior_melhor" ? 0 : undefined}
                    onChange={(e) => setEditando({ ...editando, valor: e.target.value })}
                    onBlur={() => salvar(meta)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditando(null);
                    }}
                  />
                ) : (
                  formatNumber((meta as unknown as Record<string, unknown>)[`valor_${mes}`] as string | number | null)
                )}
              </td>
            );
          })}
          <td className={`status-${meta.status ?? "vazio"}`} title={meta.atualizado_por_usuario ? `Alterado por ${meta.atualizado_por_usuario} em ${new Date(meta.atualizado_em).toLocaleString("pt-BR")}` : undefined}>
            {meta.status === "ok" ? "✓" : meta.status === "nok" ? "✗" : "-"}
          </td>
        </tr>
        {filhos.map((filho) => renderLinha(filho, nivel + 1))}
      </>
    );
  };

  return (
    <div className="metas-table-wrapper">
      <table className="metas-table">
        <thead>
          <tr>
            <th>Indicador</th>
            <th>Unid.</th>
            <th>Meta</th>
            {MESES.map((mes) => (
              <th key={mes}>{mes.toUpperCase()}</th>
            ))}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>{raiz.map((meta) => renderLinha(meta, 0))}</tbody>
      </table>
    </div>
  );
}
