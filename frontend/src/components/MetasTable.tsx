import { Fragment, useMemo, useState } from "react";
import { MesesBody } from "../services/metasService";
import { Meta, MESES, Mes, Role } from "../types";

interface EditandoState {
  metaId: string;
  tipo: "meta" | "real";
  mes: Mes;
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

function statusIcone(status: string | null): string {
  if (status === "ok") return "✓";
  if (status === "nok") return "✗";
  return "-";
}

const NUM_COLUNAS = 6 + MESES.length * 3 + 4;

export function MetasTable({
  metas,
  usuarioRole,
  usuarioSetorId,
  onSalvarMeta,
  onSalvarReal,
  onDeletar,
}: {
  metas: Meta[];
  usuarioRole: Role;
  usuarioSetorId: string | null;
  onSalvarMeta: (id: string, body: { meta?: MesesBody }) => Promise<void>;
  onSalvarReal: (id: string, body: MesesBody) => Promise<void>;
  onDeletar: (id: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState<EditandoState | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const { raiz, filhosPorPai } = useMemo(() => buildTree(metas), [metas]);

  const isGerente = usuarioRole === "gerente" || usuarioRole === "admin";
  const podeEditarMeta = (meta: Meta) => isGerente && !meta.agrega_filhos;
  const podeEditarReal = (meta: Meta) => usuarioRole === "responsavel" && usuarioSetorId === meta.setor_id && !meta.agrega_filhos;

  const iniciarEdicao = (meta: Meta, tipo: "meta" | "real", mes: Mes) => {
    if (tipo === "meta" && !podeEditarMeta(meta)) return;
    if (tipo === "real" && !podeEditarReal(meta)) return;
    const valorAtual = meta.meses[mes][tipo];
    setEditando({ metaId: meta.id, tipo, mes, valor: valorAtual != null ? String(valorAtual) : "" });
  };

  const salvar = async (meta: Meta) => {
    if (!editando) return;
    const numero = parseFloat(editando.valor);
    if (Number.isNaN(numero) || (meta.tipo_meta === "maior_melhor" && numero < 0)) {
      setEditando(null);
      return;
    }
    try {
      if (editando.tipo === "meta") {
        await onSalvarMeta(meta.id, { meta: { [editando.mes]: numero } });
      } else {
        await onSalvarReal(meta.id, { [editando.mes]: numero });
      }
    } finally {
      setEditando(null);
    }
  };

  const renderCelula = (meta: Meta, tipo: "meta" | "real", mes: Mes): JSX.Element => {
    const isEditing = editando?.metaId === meta.id && editando?.tipo === tipo && editando?.mes === mes;
    const editavel = tipo === "meta" ? podeEditarMeta(meta) : podeEditarReal(meta);
    const isAgregado = tipo === "meta" && meta.ic_iv === "IC" && meta.agrega_filhos;

    if (isEditing) {
      return (
        <td className="editing">
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
        </td>
      );
    }

    return (
      <td
        className={isAgregado ? "agregado" : editavel ? "editable" : "locked"}
        title={isAgregado ? "Calculado automaticamente a partir dos IVs filhos" : undefined}
        onClick={() => iniciarEdicao(meta, tipo, mes)}
      >
        {formatNumber(meta.meses[mes][tipo])}
      </td>
    );
  };

  const renderLinha = (meta: Meta, nivel: number, produtoVisivel: boolean): JSX.Element => {
    const filhos = filhosPorPai.get(meta.id) ?? [];
    const isIC = meta.ic_iv === "IC";

    return (
      <Fragment key={meta.id}>
        <tr className={isIC ? "ic-row" : "iv-row"}>
          <td>{produtoVisivel ? meta.produto : ""}</td>
          <td>
            <span className={`badge-ic-iv ${isIC ? "badge-ic" : "badge-iv"}`}>{meta.ic_iv}</span>
          </td>
          <td style={{ paddingLeft: `${nivel * 20}px` }}>
            {nivel > 0 ? "└ " : ""}
            {meta.indicador}
          </td>
          <td>{meta.responsavel}</td>
          <td>{meta.unidade}</td>
          <td>{formatNumber(meta.meta_ano)}</td>
          {MESES.map((mes) => (
            <Fragment key={mes}>
              {renderCelula(meta, "meta", mes)}
              {renderCelula(meta, "real", mes)}
              <td className={`status-${meta.meses[mes].status ?? "vazio"}`}>{statusIcone(meta.meses[mes].status)}</td>
            </Fragment>
          ))}
          <td>{formatNumber(meta.acum_meta)}</td>
          <td>{formatNumber(meta.acum_real)}</td>
          <td className={`status-${meta.status_acum ?? "vazio"}`}>{statusIcone(meta.status_acum)}</td>
          <td>
            {isGerente &&
              (confirmandoExclusao === meta.id ? (
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
                <button className="btn-link btn-link-danger" title="Remover indicador" onClick={() => setConfirmandoExclusao(meta.id)}>
                  Remover
                </button>
              ))}
          </td>
        </tr>
        {filhos.map((filho) => renderLinha(filho, nivel + 1, false))}
      </Fragment>
    );
  };

  let ultimoProduto: string | null = null;

  return (
    <div className="metas-table-wrapper">
      <table className="metas-table metas-table-excel">
        <thead>
          <tr>
            <th>Produto</th>
            <th>IC/IV</th>
            <th>Indicador</th>
            <th>Responsável</th>
            <th>Unidade</th>
            <th>Meta Ano</th>
            {MESES.map((mes) => (
              <Fragment key={mes}>
                <th>{mes.toUpperCase()} Meta</th>
                <th>{mes.toUpperCase()} Real</th>
                <th>{mes.toUpperCase()} St.</th>
              </Fragment>
            ))}
            <th>Acum Meta</th>
            <th>Acum Real</th>
            <th>Status Acum</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {raiz.map((meta) => {
            const mostrarSeparador = !!meta.produto && meta.produto !== ultimoProduto;
            if (meta.produto) ultimoProduto = meta.produto;
            return (
              <Fragment key={`grupo-${meta.id}`}>
                {mostrarSeparador && (
                  <tr className="produto-separador">
                    <td colSpan={NUM_COLUNAS}>{meta.produto}</td>
                  </tr>
                )}
                {renderLinha(meta, 0, false)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
