import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { ProdutosTable } from "../components/ProdutosTable";
import { ProdutosModal } from "../components/ProdutosModal";
import { IndicadoresTable } from "../components/IndicadoresTable";
import { CriarMetaModal } from "../components/CriarMetaModal";
import { useAuth } from "../hooks/useAuth";
import { useProdutos } from "../hooks/useProdutos";
import { useMetas } from "../hooks/useMetas";
import { useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { useSetorSelecionado } from "../hooks/useSetorSelecionado";
import { listarSetores } from "../services/metasService";
import { Produto, Setor, StatusProduto } from "../types";

type Aba = "produtos" | "indicadores";

export function CadastroPage() {
  const { usuario } = useAuth();
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
  const [ano] = useAnoSelecionado();

  useEffect(() => {
    listarSetores().then(setSetores);
  }, []);

  const { produtos, totalPaginas, loading, criar, editar, deletar } = useProdutos({
    setor_id: setorId,
    status,
    search: search || undefined,
    pagina,
  });

  const {
    metas,
    loading: loadingMetas,
    criar: criarIndicador,
    deletar: deletarIndicador,
    inativar: inativarIndicador,
    ativar: ativarIndicador,
  } = useMetas({ setor_id: setorId, ano, incluir_inativos: true });

  const filtros = (
    <div className="filtros">
      {podeGerenciar && (
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

          {loadingMetas && <p>Carregando...</p>}
          {!loadingMetas && !setorId && <p>Selecione um setor para visualizar os indicadores.</p>}
          {!loadingMetas && setorId && (
            <IndicadoresTable
              metas={metas}
              podeGerenciar={podeGerenciar}
              onDeletar={deletarIndicador}
              onInativar={inativarIndicador}
              onAtivar={ativarIndicador}
            />
          )}

          {modalIndicadorAberto && (
            <CriarMetaModal
              setores={setores}
              setorIdInicial={setorId}
              ano={ano}
              onSalvar={async (body) => {
                await criarIndicador(body);
                setModalIndicadorAberto(false);
              }}
              onFechar={() => setModalIndicadorAberto(false)}
            />
          )}
        </>
      )}
    </AppLayout>
  );
}
