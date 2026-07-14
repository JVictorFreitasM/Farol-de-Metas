import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { ProdutosTable } from "../components/ProdutosTable";
import { ProdutosModal } from "../components/ProdutosModal";
import { useAuth } from "../hooks/useAuth";
import { useProdutos } from "../hooks/useProdutos";
import { listarSetores } from "../services/metasService";
import { Produto, Setor, StatusProduto } from "../types";

export function ProdutosPage() {
  const { usuario } = useAuth();
  const podeGerenciar = usuario?.role === "admin" || usuario?.role === "gerente";
  const podeCriar = usuario?.role === "gerente";

  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState<string | undefined>(
    usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined
  );
  const [status, setStatus] = useState<StatusProduto | "todos">("ativo");
  const [search, setSearch] = useState("");
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);

  useEffect(() => {
    listarSetores().then(setSetores);
  }, []);

  const { produtos, totalPaginas, loading, criar, editar, deletar } = useProdutos({
    setor_id: setorId,
    status,
    search: search || undefined,
    pagina,
  });

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
    </div>
  );

  return (
    <AppLayout titulo="Produtos" filtros={filtros}>
      <div className="metas-toolbar">
        {podeCriar ? (
          <button className="btn-primary" onClick={() => { setProdutoEditando(null); setModalAberto(true); }}>
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
            onEditar={(p) => { setProdutoEditando(p); setModalAberto(true); }}
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

      {modalAberto && (
        <ProdutosModal
          produto={produtoEditando}
          onSalvar={async (body) => {
            if (produtoEditando) {
              await editar(produtoEditando.id, body);
            } else {
              await criar({ ...body, setor_id: setorId });
            }
            setModalAberto(false);
          }}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </AppLayout>
  );
}
