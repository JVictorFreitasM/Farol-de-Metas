import { useState } from "react";
import { MesesBody } from "../services/metasService";
import { AcumuladoTooltip } from "./AcumuladoTooltip";
import { Meta, MESES_LABEL, Mes, Role } from "../types";

interface ItemIc {
  ic: Meta;
  ivs: Meta[];
}

interface GrupoProduto {
  produto: string;
  itens: ItemIc[];
}

function agruparPorProduto(metas: Meta[]): GrupoProduto[] {
  const raizes = metas.filter((m) => !m.pai_id).sort((a, b) => a.ordem - b.ordem);

  const ivsPorPai = new Map<string, Meta[]>();
  for (const m of metas) {
    if (m.pai_id) {
      const lista = ivsPorPai.get(m.pai_id) ?? [];
      lista.push(m);
      ivsPorPai.set(m.pai_id, lista);
    }
  }
  for (const lista of ivsPorPai.values()) lista.sort((a, b) => a.ordem - b.ordem);

  const grupos: GrupoProduto[] = [];
  let atual: GrupoProduto | null = null;

  for (const ic of raizes) {
    if (ic.produto || !atual) {
      atual = { produto: ic.produto ?? "Outros indicadores", itens: [] };
      grupos.push(atual);
    }
    atual.itens.push({ ic, ivs: ivsPorPai.get(ic.id) ?? [] });
  }

  return grupos;
}

function formatNumber(valor: string | number | null): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n.toString() : "-";
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[̀-ͯ]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function chaveProduto(setorId: string, produto: string): string {
  return `metas_expand_${setorId}_${slugify(produto)}`;
}

function chaveIc(icId: string): string {
  return `metas_expand_ic_${icId}`;
}

export function MetasIndicadoresCards({
  metas,
  mes,
  usuarioRole,
  usuarioSetorId,
  onSalvarReal,
  onSalvarMetaManual,
  onDeletar,
  onInativar,
  onAtivar,
}: {
  metas: Meta[];
  mes: Mes;
  usuarioRole: Role;
  usuarioSetorId: string | null;
  onSalvarReal: (id: string, body: MesesBody) => Promise<void>;
  onSalvarMetaManual: (id: string, valor: number) => Promise<void>;
  onDeletar: (id: string) => Promise<void>;
  onInativar: (id: string, motivo?: string) => Promise<void>;
  onAtivar: (id: string) => Promise<void>;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [valorEditado, setValorEditado] = useState("");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [confirmandoInativacao, setConfirmandoInativacao] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const isGerente = usuarioRole === "gerente" || usuarioRole === "admin";
  const podeInativar = usuarioRole === "gerente";
  const podeEditarReal = (meta: Meta) =>
    !meta.agrega_filhos && (isGerente || (usuarioRole === "responsavel" && usuarioSetorId === meta.setor_id));

  const isExpandido = (chave: string): boolean => {
    if (chave in expandido) return expandido[chave];
    const salvo = localStorage.getItem(chave);
    return salvo === null ? true : salvo === "true";
  };

  const toggleExpandido = (chave: string) => {
    const novoValor = !isExpandido(chave);
    localStorage.setItem(chave, String(novoValor));
    setExpandido((prev) => ({ ...prev, [chave]: novoValor }));
  };

  const iniciarEdicao = (meta: Meta) => {
    if (!podeEditarReal(meta)) return;
    const valorAtual = meta.meses[mes].real;
    setEditandoId(meta.id);
    setValorEditado(valorAtual != null ? String(valorAtual) : "");
  };

  const salvar = async (meta: Meta) => {
    const numero = parseFloat(valorEditado);
    if (Number.isNaN(numero) || (meta.tipo_meta === "maior_melhor" && numero < 0)) {
      setEditandoId(null);
      return;
    }
    try {
      await onSalvarReal(meta.id, { [mes]: numero });
    } finally {
      setEditandoId(null);
    }
  };

  if (metas.length === 0) {
    return <p>Nenhum indicador cadastrado para este setor.</p>;
  }

  const renderChevron = (chave: string, expandidoAtual: boolean, label: string) => (
    <span
      className={`chevron ${expandidoAtual ? "expanded" : ""}`}
      role="button"
      tabIndex={0}
      aria-expanded={expandidoAtual}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        toggleExpandido(chave);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          toggleExpandido(chave);
        }
      }}
    >
      ▼
    </span>
  );

  const renderLinha = (meta: Meta, opcoes?: { chevron?: React.ReactNode; contador?: number }) => {
    const editavel = podeEditarReal(meta);
    const isEditing = editandoId === meta.id;
    const status = meta.meses[mes].status;
    const isIC = meta.ic_iv === "IC";

    return (
      <div key={meta.id} className={`indicador-row ${isIC ? "tipo-ic" : "tipo-iv"} ${meta.ativo ? "" : "indicador-row-inativo"}`}>
        {opcoes?.chevron}
        <div className="indicador-row-tipo">
          <span className={`badge-ic-iv ${isIC ? "badge-ic" : "badge-iv"}`}>{meta.ic_iv}</span>
        </div>

        <div className="indicador-row-nome">
          <div className="indicador-row-nome-texto">
            <AcumuladoTooltip meta={meta} podeEditarMetaManual={isGerente} onSalvarMetaManual={onSalvarMetaManual}>
              {meta.indicador}
            </AcumuladoTooltip>
            {opcoes?.contador !== undefined && opcoes.contador > 0 && (
              <span className="indicador-row-contador"> ({opcoes.contador} IV{opcoes.contador > 1 ? "s" : ""})</span>
            )}
            {!meta.ativo && (
              <span className="badge-inativo">
                Inativo{meta.inativado_em ? ` desde ${new Date(meta.inativado_em).toLocaleDateString("pt-BR")}` : ""}
              </span>
            )}
          </div>
          <div className="indicador-row-responsavel">{meta.responsavel}</div>
        </div>

        <div className="indicador-row-valor">
          <div className="indicador-row-valor-label">Meta</div>
          <div className="indicador-row-valor-numero">{formatNumber(meta.meses[mes].meta)}</div>
        </div>

        <div className="indicador-row-valor">
          <div className="indicador-row-valor-label">Real</div>
          {isEditing ? (
            <input
              type="number"
              autoFocus
              className="indicador-row-input"
              value={valorEditado}
              min={meta.tipo_meta === "maior_melhor" ? 0 : undefined}
              onChange={(e) => setValorEditado(e.target.value)}
              onBlur={() => salvar(meta)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditandoId(null);
              }}
            />
          ) : (
            <div
              className={`indicador-row-valor-numero ${editavel ? "editable" : "locked"}`}
              title={meta.agrega_filhos ? "Calculado automaticamente a partir dos IVs filhos" : undefined}
              onClick={() => iniciarEdicao(meta)}
            >
              {formatNumber(meta.meses[mes].real)}
            </div>
          )}
        </div>

        <div className="indicador-row-status">
          <span className={`badge-status ${status ?? "vazio"}`}>
            {status === "ok" ? "OK" : status === "nok" ? "NOK" : "-"}
          </span>

          {podeInativar &&
            (meta.ativo ? (
              confirmandoInativacao === meta.id ? (
                <span className="acoes-confirmar">
                  <button
                    className="btn-link btn-link-warning"
                    onClick={async () => {
                      await onInativar(meta.id);
                      setConfirmandoInativacao(null);
                    }}
                  >
                    Confirmar
                  </button>
                  <button className="btn-link" onClick={() => setConfirmandoInativacao(null)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button className="btn-link btn-link-warning" onClick={() => setConfirmandoInativacao(meta.id)}>
                  Inativar
                </button>
              )
            ) : (
              <button className="btn-link btn-link-success" onClick={() => onAtivar(meta.id)}>
                Ativar
              </button>
            ))}

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
              <button className="btn-link btn-link-danger" onClick={() => setConfirmandoExclusao(meta.id)}>
                Remover
              </button>
            ))}
        </div>
      </div>
    );
  };

  const grupos = agruparPorProduto(metas);
  const setorId = metas[0]?.setor_id ?? "setor";

  return (
    <div className="produtos-wrapper">
      {metas[0]?.nome_setor && <h3 className="setor-titulo">Setor: {metas[0].nome_setor}</h3>}

      {grupos.map((grupo) => {
        const chaveP = chaveProduto(setorId, grupo.produto);
        const produtoExpandido = isExpandido(chaveP);
        const totalIcs = grupo.itens.length;
        const totalIvs = grupo.itens.reduce((acc, item) => acc + item.ivs.length, 0);

        return (
          <div key={chaveP} className="produto-group">
            <div
              className="produto-group-header"
              role="button"
              tabIndex={0}
              aria-expanded={produtoExpandido}
              aria-label={`Expandir/Retrair Produto: ${grupo.produto}`}
              onClick={() => toggleExpandido(chaveP)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggleExpandido(chaveP);
                }
              }}
            >
              <span className={`chevron ${produtoExpandido ? "expanded" : ""}`}>▼</span>
              🎯 PRODUTO: {grupo.produto}
              {!produtoExpandido && (
                <span className="produto-group-contador">
                  {" "}
                  ({totalIcs} IC{totalIcs !== 1 ? "s" : ""}, {totalIvs} IV{totalIvs !== 1 ? "s" : ""})
                </span>
              )}
            </div>

            <div className={`colapsavel ${produtoExpandido ? "" : "colapsado"}`}>
              <div className="produto-group-body">
                {grupo.itens.map(({ ic, ivs }) => {
                  const chaveI = chaveIc(ic.id);
                  const icExpandido = isExpandido(chaveI);
                  const temFilhos = ivs.length > 0;

                  return (
                    <div key={ic.id} className="produto-group-item">
                      {renderLinha(ic, {
                        chevron: temFilhos ? renderChevron(chaveI, icExpandido, `Expandir/Retrair IC: ${ic.indicador}`) : undefined,
                        contador: temFilhos && !icExpandido ? ivs.length : undefined,
                      })}
                      {temFilhos && (
                        <div className={`colapsavel ${icExpandido ? "" : "colapsado"}`}>
                          <div>{ivs.map((iv) => renderLinha(iv))}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {grupos.length === 0 && <p>Nenhum indicador com dados em {MESES_LABEL[mes]}.</p>}
    </div>
  );
}
