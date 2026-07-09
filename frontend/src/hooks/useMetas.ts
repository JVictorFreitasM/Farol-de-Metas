import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { atualizarMeta, AtualizarMetaBody, listarMetas, ListarMetasParams } from "../services/metasService";
import { Meta } from "../types";

export function useMetas(params: ListarMetasParams) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await listarMetas(params);
      setMetas(resp.data);
      setTotal(resp.total);
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

  const editar = async (id: string, body: AtualizarMetaBody) => {
    try {
      await atualizarMeta(id, body);
      toast.success("Meta atualizada com sucesso!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar meta");
      throw err;
    }
  };

  return { metas, total, loading, recarregar: carregar, editar };
}
