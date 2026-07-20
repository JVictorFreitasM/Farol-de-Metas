import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  criarIndicador,
  CriarIndicadorBody,
  deletarIndicador,
  editarIndicador,
  EditarIndicadorBody,
  listarIndicadores,
  ListarIndicadoresParams,
} from "../services/indicadoresService";
import { Indicador } from "../types";

export function useIndicadores(params: ListarIndicadoresParams) {
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!params.setor_id) {
      setIndicadores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await listarIndicadores(params);
      setIndicadores(resp.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar indicadores");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async (body: CriarIndicadorBody) => {
    const indicador = await criarIndicador(body);
    await carregar();
    return indicador;
  };

  const editar = async (id: string, body: EditarIndicadorBody) => {
    await editarIndicador(id, body);
    toast.success("Indicador atualizado!");
    await carregar();
  };

  const deletar = async (id: string) => {
    await deletarIndicador(id);
    toast.success("Indicador inativado!");
    await carregar();
  };

  return { indicadores, loading, recarregar: carregar, criar, editar, deletar };
}
