import { useState } from "react";
import { toast } from "react-toastify";
import { ApiRequestError } from "../services/api";
import { importarAno, ImportarAnoBody, ImportarAnoResponse } from "../services/metasService";

export function useImportacao() {
  const [importando, setImportando] = useState(false);

  const importar = async (body: ImportarAnoBody): Promise<ImportarAnoResponse | null> => {
    setImportando(true);
    try {
      const resultado = await importarAno(body);
      toast.success(`${resultado.metas_importadas} indicador(es) importado(s) com sucesso!`);
      return resultado;
    } catch (err) {
      // 409 = ano destino já tem indicadores; deixa o modal oferecer "sobrescrever" em vez de um toast genérico.
      if (err instanceof ApiRequestError && err.status === 409) throw err;
      toast.error(err instanceof Error ? err.message : "Erro ao importar metas");
      return null;
    } finally {
      setImportando(false);
    }
  };

  return { importar, importando };
}
