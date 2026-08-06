import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  criarSetor,
  CriarSetorBody,
  editarSetor,
  EditarSetorBody,
  listarSetores,
  ListarSetoresParams,
} from "../services/setoresService";
import { Setor } from "../types";

// OS-020: mesmo padrão de useProdutos.ts — toast.error + re-throw em toda escrita, desde o
// início (a lacuna encontrada em useIndicadores.ts na OS-019 não devia se repetir aqui).
export function useSetores(params: ListarSetoresParams = {}) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await listarSetores(params);
      setSetores(resp);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar setores");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = async (body: CriarSetorBody) => {
    try {
      const setor = await criarSetor(body);
      toast.success("Setor criado!");
      await carregar();
      return setor;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar setor");
      throw err;
    }
  };

  const editar = async (id: string, body: EditarSetorBody) => {
    try {
      await editarSetor(id, body);
      toast.success("Setor atualizado!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao editar setor");
      throw err;
    }
  };

  const inativar = async (id: string) => {
    try {
      await editarSetor(id, { ativo: false });
      toast.success("Setor inativado!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao inativar setor");
      throw err;
    }
  };

  const ativar = async (id: string) => {
    try {
      await editarSetor(id, { ativo: true });
      toast.success("Setor ativado!");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ativar setor");
      throw err;
    }
  };

  return { setores, loading, recarregar: carregar, criar, editar, inativar, ativar };
}
