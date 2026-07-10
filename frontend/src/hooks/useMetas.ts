import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  criarMeta,
  CriarMetaBody,
  deletarMeta,
  editarMeta,
  editarReal,
  listarMetas,
  ListarMetasParams,
  listarSetores,
  MesesBody,
} from "../services/metasService";
import { Meta, Setor } from "../types";

export function useMetas(params: ListarMetasParams) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [respMetas, respSetores] = await Promise.all([listarMetas(params), listarSetores()]);
      setMetas(respMetas.data);
      setSetores(respSetores);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar metas");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvarMeta = async (id: string, body: { meta_ano?: number; meta?: MesesBody }) => {
    try {
      await editarMeta(id, body);
      toast.success("Meta atualizada com sucesso!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar meta");
      throw err;
    }
  };

  const salvarReal = async (id: string, body: MesesBody) => {
    try {
      await editarReal(id, { real: body });
      toast.success("Real atualizado com sucesso!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar real");
      throw err;
    }
  };

  const criar = async (body: CriarMetaBody) => {
    try {
      await criarMeta(body);
      toast.success("Indicador criado!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar indicador");
      throw err;
    }
  };

  const deletar = async (id: string) => {
    try {
      await deletarMeta(id);
      toast.success("Indicador removido!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover indicador");
      throw err;
    }
  };

  return { metas, setores, loading, recarregar: carregar, salvarMeta, salvarReal, criar, deletar };
}
