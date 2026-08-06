import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { ProdutosTable } from "../components/ProdutosTable";
import { ProdutosModal } from "../components/ProdutosModal";
import { IndicadoresTable } from "../components/IndicadoresTable";
import { CriarMetaModal } from "../components/CriarMetaModal";
import { EditarIndicadorModal } from "../components/EditarIndicadorModal";
import { SetoresTable } from "../components/SetoresTable";
import { SetoresModal } from "../components/SetoresModal";
import { useAuth } from "../hooks/useAuth";
import { useProdutos } from "../hooks/useProdutos";
import { useMetas } from "../hooks/useMetas";
import { useIndicadores } from "../hooks/useIndicadores";
import { useSetores } from "../hooks/useSetores";
import { useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { useSetorSelecionado } from "../hooks/useSetorSelecionado";
import { listarSetores } from "../services/metasService";
import { Indicador, Produto, Setor, StatusProduto } from "../types";

type Aba = "produtos" | "indicadores" | "setores";

export function CadastroPage() {
  const { usuario } = useAuth();
  const ehAdmin = usuario?.role === "admin";
  const podeGerenciar = usuario?.role === "admin" || usuario?.role === "gerente";
  const podeCriar = usuario?.role === "gerente";

  const [aba, setAba] = useState<Aba>("produtos");
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useSetorSelecionado();
  const [status, setStatus] = useState<StatusProduto | "todos">("ativo");
  const [search, setSearch] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [modalIndicadorAberto, setModalIndicadorAberto] = useState(false);
  const [indicadorEditando, setIndicadorEditando] = useState<Indicador | null>(null);
  const [modalSetorAberto, setModalSetorAberto] = useState(false);
  const [setorEditando, setSetorEditando] = useState<Setor | null>(null);
  const [ano] = useAnoSelecionado();

  // OS-020: extraído de um useEffect(..., []) que só rodava uma vez no mount — a lista de
  // setores ativos usada no filtro/seletor desta página ficava desatualizada depois de
  // criar/inativar/ativar um setor na aba Setores, só refletindo após reload manual. Reexecutado
  // depois de qualquer mutação de setor (ver handlers da aba Setores abaixo).
  const carregarSetoresAtivos = () => listarSetores().then(setSetores);
  useEffect(() => {
    carregarSetoresAtivos();
  }, []);

  const { produtos, totalPaginas, loading, criar, editar, deletar } = useProdutos({
    setor_id: setorId,
    status,
    search: search || undefined,
    pagina,
  });

  // Metas do ano corrente: só usadas aqui para (1) criar a meta ao cadastrar um indicador novo e
  // (2) mostrar o "Responsável" na tabela quando existir meta nesse ano. A listagem/gestão da
  // aba (quais indicadores aparecem, inativar/ativar) usa useIndicadores — independente de ano —
  // já que indicador sem meta no ano corrente é válido e precisa continuar editável.
  const {
    metas,
    criar: criarMetaDoIndicador,
    inativar: inativarMeta,
    ativar: ativarMeta,
  } = useMetas({ setor_id: setorId, ano, incluir_inativos: true });
  const metasPorIndicadorId = new Map(metas.map((m) => [m.indicador_id, m]));

  const {
    indicadores,
    loading: loadingIndicadores,
    recarregar: recarregarIndicadores,
    editar: editarIndicador,
    deletar: inativarIndicador,
    ativar: ativarIndicador,
  } = useIndicadores({ setor_id: setorId, incluir_inativos: true });

  // Setores não é escopado por setor_id (é o próprio recurso sendo gerido) — incluir_inativos:
  // true sempre, pra tela de gestão poder reativar. Só admin vê a aba, mas o hook roda pro app
  // inteiro igual aos outros nesta página (mesmo padrão: hooks chamados incondicionalmente).
  const {
    setores: setoresGerenciaveis,
    loading: loadingSetores,
    criar: criarSetor,
    editar: editarSetor,
    inativar: inativarSetor,
    ativar: ativarSetor,
  } = useSetores({ incluir_inativos: true });

  const filtros = (
    <div className="filtros">
      {podeGerenciar && aba !== "setores" && (
        <label>
          Setor
          <select value={setorId ?? ""} onChange={(e) => { setSetorId(e.target.value || undefined); setPagina(1); }}>
            <option value="">Selecione...</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
      )}
      {aba === "produtos" && (
        <>
          <label>
            Status
            <select value={status} onChange={(e) => { setStatus(e.target.value as StatusProduto | "todos"); setPagina(1); }}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <label>
            Buscar
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPagina(1); }} placeholder="Nome do produto..." />
          </label>
        </>
      )}
      <div className="tabs">
        <button className={aba === "produtos" ? "active" : ""} onClick={() => setAba("produtos")}>Produtos</button>
        <button className={aba === "indicadores" ? "active" : ""} onClick={() => setAba("indicadores")}>Indicadores</button>
        {ehAdmin && (
          <button className={aba === "setores" ? "active" : ""} onClick={() => setAba("setores")}>Setores</button>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout titulo="Cadastro" filtros={filtros}>
      {aba === "produtos" && (
        <>
          <div className="metas-toolbar">
            {podeCriar ? (
              <button className="btn-primary" onClick={() => { setProdutoEditando(null); setModalProdutoAberto(true); }}>
                + Novo Produto
              </button>
            ) : usuario?.role === "admin" ? (
              <span className="texto-informativo">Apenas gerentes podem criar produtos.</span>
            ) : (
              <span />
            )}
          </div>

          {loading && <p>Carregando...</p>}
          {!loading && !setorId && <p>Selecione um setor para visualizar os produtos.</p>}
          {!loading && setorId && (
            <>
              <ProdutosTable
                produtos={produtos}
                podeGerenciar={podeGerenciar}
                onEditar={(p) => { setProdutoEditando(p); setModalProdutoAberto(true); }}
                onDeletar={async (p) => {
                  if (confirm(`Excluir o produto "${p.nome}"? As metas associadas ficarão sem produto.`)) {
                    await deletar(p.id);
                  }
                }}
              />
              {totalPaginas > 1 && (
                <div className="tabs" style={{ marginTop: 12 }}>
                  <button className="btn-secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>{"<"}</button>
                  <span style={{ margin: "0 8px" }}>Página {pagina} de {totalPaginas}</span>
                  <button className="btn-secondary" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>{">"}</button>
                </div>
              )}
            </>
          )}

          {modalProdutoAberto && (
            <ProdutosModal
              produto={produtoEditando}
              onSalvar={async (body) => {
                if (produtoEditando) {
                  await editar(produtoEditando.id, body);
                } else {
                  await criar({ ...body, setor_id: setorId });
                }
                setModalProdutoAberto(false);
              }}
              onFechar={() => setModalProdutoAberto(false)}
            />
          )}
        </>
      )}

      {aba === "indicadores" && (
        <>
          <div className="metas-toolbar">
            {podeCriar ? (
              <button className="btn-primary" onClick={() => setModalIndicadorAberto(true)}>+ Novo indicador</button>
            ) : usuario?.role === "admin" ? (
              <span className="texto-informativo">Apenas gerentes podem criar indicadores.</span>
            ) : (
              <span />
            )}
          </div>

          {loadingIndicadores && <p>Carregando...</p>}
          {!loadingIndicadores && !setorId && <p>Selecione um setor para visualizar os indicadores.</p>}
          {!loadingIndicadores && setorId && (
            <IndicadoresTable
              indicadores={indicadores}
              ano={ano}
              metasPorIndicadorId={metasPorIndicadorId}
              podeGerenciar={podeGerenciar}
              onEditar={(indicador) => setIndicadorEditando(indicador)}
              onInativarIndicador={inativarIndicador}
              onAtivarIndicador={ativarIndicador}
              onInativarAno={inativarMeta}
              onAtivarAno={ativarMeta}
            />
          )}

          {modalIndicadorAberto && (
            <CriarMetaModal
              setores={setores}
              setorIdInicial={setorId}
              anoInicial={ano}
              onSalvar={async (body) => {
                await criarMetaDoIndicador(body);
                await recarregarIndicadores();
                setModalIndicadorAberto(false);
              }}
              onFechar={() => setModalIndicadorAberto(false)}
            />
          )}

          {indicadorEditando && (
            <EditarIndicadorModal
              indicador={indicadorEditando}
              onSalvar={editarIndicador}
              onFechar={() => setIndicadorEditando(null)}
            />
          )}
        </>
      )}

      {aba === "setores" && ehAdmin && (
        <>
          <div className="metas-toolbar">
            <button className="btn-primary" onClick={() => { setSetorEditando(null); setModalSetorAberto(true); }}>
              + Novo setor
            </button>
          </div>

          {loadingSetores && <p>Carregando...</p>}
          {!loadingSetores && (
            <SetoresTable
              setores={setoresGerenciaveis}
              onEditar={(s) => { setSetorEditando(s); setModalSetorAberto(true); }}
              onInativar={async (s) => {
                if (confirm(`Inativar o setor "${s.nome}"? Nada é apagado — só bloqueia novos lançamentos vinculados a ele.`)) {
                  await inativarSetor(s.id);
                  await carregarSetoresAtivos();
                }
              }}
              onAtivar={async (s) => {
                await ativarSetor(s.id);
                await carregarSetoresAtivos();
              }}
            />
          )}

          {modalSetorAberto && (
            <SetoresModal
              setor={setorEditando}
              onSalvar={async (body) => {
                if (setorEditando) {
                  await editarSetor(setorEditando.id, body);
                } else {
                  await criarSetor({ nome: body.nome, email: body.email ?? undefined });
                }
                await carregarSetoresAtivos();
                setModalSetorAberto(false);
              }}
              onFechar={() => setModalSetorAberto(false)}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}
