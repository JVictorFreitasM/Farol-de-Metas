import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  criarProduto,
  CriarProdutoBody,
  deletarProduto,
  editarProduto,
  EditarProdutoBody,
  listarProdutos,
  ListarProdutosParams,
} from "../services/produtosService";
import { Produto } from "../types";

export function useProdutos(params: ListarProdutosParams) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!params.setor_id) {
      setProdutos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await listarProdutos(params);
      setProdutos(resp.data);
      setTotal(resp.total);
      setTotalPaginas(resp.total_paginas ?? 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async (body: CriarProdutoBody) => {
    try {
      await criarProduto(body);
      toast.success("Produto criado!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar produto");
      throw err;
    }
  };

  const editar = async (id: string, body: EditarProdutoBody) => {
    try {
      await editarProduto(id, body);
      toast.success("Produto atualizado!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao editar produto");
      throw err;
    }
  };

  const deletar = async (id: string) => {
    try {
      await deletarProduto(id);
      toast.success("Produto removido!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover produto");
      throw err;
    }
  };

  return { produtos, total, totalPaginas, loading, recarregar: carregar, criar, editar, deletar };
}
