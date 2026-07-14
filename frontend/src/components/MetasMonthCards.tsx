import { Meta, MESES, MESES_LABEL, Mes, StatusMeta } from "../types";

interface Props {
  metas: Meta[];
  mesSelecionado: Mes;
  onMesSelecionado: (mes: Mes) => void;
}

interface MesResumo {
  mes: Mes;
  label: string;
  qtdIcs: number;
  status: StatusMeta | null;
}

export function MetasMonthCards({ metas, mesSelecionado, onMesSelecionado }: Props) {
  const ics = metas.filter((m) => m.ic_iv === "IC");

  const resumos: MesResumo[] = MESES.map((mes) => {
    const comDados = ics.filter((ic) => ic.meses[mes].real !== null);
    const qtdOk = comDados.filter((ic) => ic.meses[mes].status === "ok").length;
    const qtdNok = comDados.filter((ic) => ic.meses[mes].status === "nok").length;

    let status: StatusMeta | null = null;
    if (comDados.length > 0) {
      status = qtdOk >= qtdNok ? "ok" : "nok";
    }

    return { mes, label: MESES_LABEL[mes], qtdIcs: comDados.length, status };
  });

  return (
    <div className="month-cards-section">
      <div className="month-cards-container">
        {resumos.map((resumo) => (
          <div
            key={resumo.mes}
            className={`month-card ${mesSelecionado === resumo.mes ? "selected" : ""}`}
            onClick={() => onMesSelecionado(resumo.mes)}
          >
            <div className="month-card-label">{resumo.label}</div>
            <div className="month-card-value">{resumo.qtdIcs}</div>
            <div className={`month-card-status ${resumo.status ?? "null"}`}>
              {resumo.status ? resumo.status.toUpperCase() : "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
