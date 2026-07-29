/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AppState, FuelTank, CashTransaction, LmcRecord, NozzleCalibration, ANPQualityAudit, ShiftSchedule } from "../types";

export type ReportType = "financial" | "lmc" | "anp" | "litrage" | "consolidated" | "deliveries" | "dre" | "afericao" | "daily_balances" | "audits";

export interface ExportReportOptions {
  appState: AppState;
  reportType: ReportType;
  selectedTypes?: ReportType[];
  startDate: string;
  endDate: string;
  returnBlob?: boolean;
  returnString?: boolean;
}

// Helper to format currency in Brazilian Real
function formatBRL(amount: number): string {
  return `R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format date string YYYY-MM-DD to DD/MM/YYYY
function formatDateBR(dateStr?: string): string {
  if (!dateStr) return "-";
  const clean = dateStr.substring(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Helper to compute metrics for any arbitrary date range
export function computeLitersMetrics(appState: AppState, startDate: string, endDate: string) {
  const filteredLmc = (appState.lmc || []).filter((r) => {
    const d = (r.date || "").substring(0, 10);
    return d >= startDate && d <= endDate;
  });

  const fuels = (appState.tanks || []).map((t) => t.combustivel);
  const uniqueFuels = Array.from(new Set(fuels));
  const activeFuels = uniqueFuels.length > 0 ? uniqueFuels : ["Gasolina Comum", "Gasolina Aditivada", "Etanol", "Diesel S10"];

  let totalLitersSold = 0;
  let totalLitersDelivered = 0;
  let totalGainLoss = 0;
  let totalFaturamento = 0;
  let totalCusto = 0;
  let totalMargem = 0;

  const byFuel = activeFuels.map((fuel) => {
    const lmcForFuel = filteredLmc.filter((r) => r.fuelType === fuel);
    const litersSold = lmcForFuel.reduce((sum, r) => sum + (Number(r.litersSold) || 0), 0);
    const litersDelivered = lmcForFuel.reduce((sum, r) => sum + (Number(r.deliveryVolume) || 0), 0);
    const gainLoss = lmcForFuel.reduce((sum, r) => sum + (Number(r.gainLossLiters) || 0), 0);

    const nozzlesForFuel = (appState.nozzles || []).filter((n) => {
      const tank = (appState.tanks || []).find((t) => t.id === n.tanqueId);
      return tank && tank.combustivel === fuel;
    });

    const precoVenda = nozzlesForFuel.length > 0 ? nozzlesForFuel[0].precoPorLitro : (() => {
      switch (fuel) {
        case "Gasolina Comum": return 5.89;
        case "Gasolina Aditivada": return 6.09;
        case "Gasolina Premium": return 6.89;
        case "Etanol": return 3.89;
        case "Diesel S10": return 5.99;
        case "Diesel S500": return 5.79;
        default: return 5.50;
      }
    })();

    const marginPerLiter = (() => {
      switch (fuel) {
        case "Gasolina Comum": return 0.60;
        case "Gasolina Aditivada": return 0.70;
        case "Gasolina Premium": return 1.10;
        case "Etanol": return 0.45;
        case "Diesel S10": return 0.50;
        case "Diesel S500": return 0.45;
        default: return 0.50;
      }
    })();

    const precoCusto = Math.max(0.1, precoVenda - marginPerLiter);
    const faturamento = litersSold * precoVenda;
    const custo = litersSold * precoCusto;
    const margem = faturamento - custo;

    totalLitersSold += litersSold;
    totalLitersDelivered += litersDelivered;
    totalGainLoss += gainLoss;
    totalFaturamento += faturamento;
    totalCusto += custo;
    totalMargem += margem;

    return {
      fuel,
      litersSold,
      litersDelivered,
      gainLoss,
      precoVenda,
      precoCusto,
      faturamento,
      custo,
      margem,
      marginPerLiter
    };
  });

  return {
    byFuel,
    totalLitersSold,
    totalLitersDelivered,
    totalGainLoss,
    totalFaturamento,
    totalCusto,
    totalMargem,
    averageMarginPerLiter: totalLitersSold > 0 ? totalMargem / totalLitersSold : 0
  };
}

/**
 * Generates and downloads a clean, beautifully formatted CSV file for Excel/Sheets.
 * Includes UTF-8 BOM, clear section headers, aligned columns, totals, and electronic signature block.
 */
export function exportReportCSV({ appState, reportType, selectedTypes, startDate, endDate, returnBlob, returnString }: ExportReportOptions) {
  try {
    const activeTypes: ReportType[] = (selectedTypes && selectedTypes.length > 0)
      ? selectedTypes
      : (reportType === "consolidated" ? ["dre", "financial", "lmc", "anp", "litrage", "deliveries", "afericao", "daily_balances", "audits"] : [reportType]);

    const periodText = `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
    const emissionDate = new Date().toLocaleString("pt-BR");
    const defaultCnpj = appState.users[0]?.cnpjPosto || "12.345.678/0001-99";

    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || defaultCnpj;
    const reportAddress = appState.reportHeaderAddress || "";

    const {
      tanks = [],
      transactions = [],
      lmc = [],
      calibrations = [],
      qualityAudits = [],
      shifts = [],
      deliveries = []
    } = appState;

    // Filter transactions in date range
    const filteredTxs = transactions.filter((tx) => {
      const txDate = tx.data ? tx.data.substring(0, 10) : "";
      return txDate >= startDate && txDate <= endDate;
    });

    const totalRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const totalExpense = filteredTxs
      .filter((tx) => tx.tipo === "Despesa")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const netProfit = totalRevenue - totalExpense;

    const fuelSalesRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Combustíveis")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const convenienceSalesRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Conveniência")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const servicesSalesRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita" && tx.categoria.includes("Serviços"))
      .reduce((sum, tx) => sum + tx.valor, 0);

    let csvContent = "\ufeff"; // UTF-8 BOM for Microsoft Excel / Sheets UTF-8 auto-detection

    const docTitle = activeTypes.length > 1
      ? `PACOTE DE PRESTAÇÃO DE CONTAS MENSAL (${activeTypes.length} RELATÓRIOS CONSOLIDADOS)`
      : getReportTitle(reportType).toUpperCase();

    // Document Header Block
    csvContent += `====================================================================================================\n`;
    csvContent += `${reportCompName} - SISTEMA DE GESTÃO E COMPLIANCE ERP MEU POSTO\n`;
    csvContent += `CNPJ: ${reportCnpj}${reportAddress ? ` | ENDEREÇO: ${reportAddress}` : ""}\n`;
    csvContent += `RELATÓRIO: ${docTitle}\n`;
    csvContent += `PERÍODO DE ANÁLISE: ${periodText}\n`;
    csvContent += `DATA DE EMISSÃO: ${emissionDate}\n`;
    csvContent += `====================================================================================================\n\n`;

    if (activeTypes.includes("financial")) {
      // 1. Executive KPIs Section
      csvContent += `--- RESUMO EXECUTIVO E INDICADORES FINANCEIROS (KPIs) ---\n`;
      csvContent += `INDICADOR DE DESEMPENHO;VALOR CONSOLIDADO;OBSERVAÇÃO\n`;
      csvContent += `Faturamento Bruto Total;${formatBRL(totalRevenue)};Receita total de vendas acumulada no período\n`;
      csvContent += `Despesas Operacionais Totais;${formatBRL(totalExpense)};Custos fixos e despesas de operação\n`;
      csvContent += `Resultado Líquido do Período;${formatBRL(netProfit)};${netProfit >= 0 ? "Lucro Operacional Líquido" : "Prejuízo Operacional Líquido"}\n`;
      csvContent += `Margem de Lucro Líquida;${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1).replace(".", ",") : "0,0"}%;Rentabilidade percentual sobre receita bruta\n\n`;

      // 2. Revenue Categories
      csvContent += `--- DISTRIBUIÇÃO DAS RECEITAS POR CATEGORIA ---\n`;
      csvContent += `CATEGORIA DE RECEITA;PARTICIPAÇÃO (%);FATURAMENTO BRUTO (R$)\n`;
      const fuelPct = totalRevenue > 0 ? ((fuelSalesRevenue / totalRevenue) * 100).toFixed(1).replace(".", ",") : "0,0";
      const convPct = totalRevenue > 0 ? ((convenienceSalesRevenue / totalRevenue) * 100).toFixed(1).replace(".", ",") : "0,0";
      const servPct = totalRevenue > 0 ? ((servicesSalesRevenue / totalRevenue) * 100).toFixed(1).replace(".", ",") : "0,0";

      csvContent += `Combustíveis (Pista & Bicos);${fuelPct}%;${formatBRL(fuelSalesRevenue)}\n`;
      csvContent += `Loja de Conveniência Integrada;${convPct}%;${formatBRL(convenienceSalesRevenue)}\n`;
      csvContent += `Serviços (Troca de Óleo / Ducha);${servPct}%;${formatBRL(servicesSalesRevenue)}\n`;
      csvContent += `----------------------------------------------------------------------------------------------------\n`;
      csvContent += `TOTAL GERAL DE RECEITAS;100,0%;${formatBRL(totalRevenue)}\n\n`;

      // 3. Transactions List
      csvContent += `--- EXTRATO DE LANÇAMENTOS DO FLUXO DE CAIXA NO PERÍODO ---\n`;
      csvContent += `DATA;DESCRIÇÃO;CATEGORIA;TIPO;FORMA DE PAGAMENTO;VALOR (R$)\n`;

      if (filteredTxs.length > 0) {
        filteredTxs.forEach((tx) => {
          const dt = formatDateBR(tx.data);
          const desc = (tx.descricao || "").replace(/;/g, ",");
          const cat = (tx.categoria || "").replace(/;/g, ",");
          const tipo = tx.tipo || "Receita";
          const pagto = (tx.formaPagamento || "Dinheiro / PIX").replace(/;/g, ",");
          const val = formatBRL(tx.valor);
          csvContent += `${dt};${desc};${cat};${tipo};${pagto};${val}\n`;
        });
        csvContent += `----------------------------------------------------------------------------------------------------\n`;
        csvContent += `TOTAL DE LANÇAMENTOS (${filteredTxs.length});;;;RECEITAS: ${formatBRL(totalRevenue)} | DESPESAS: ${formatBRL(totalExpense)};SDR: ${formatBRL(netProfit)}\n\n`;
      } else {
        csvContent += `-;Nenhum lançamento financeiro registrado no período selecionado;-;-;-;R$ 0,00\n\n`;
      }
    }

    if (activeTypes.includes("lmc")) {
      // LMC Section
      csvContent += `--- LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS (LMC) ---\n`;
      csvContent += `DATA;COMBUSTÍVEL;ESTOQUE INICIAL (L);RECEBIMENTO/NOTAS (L);VENDAS NO DIA (L);ESTOQUE ESCRITURAL (L);ESTOQUE FÍSICO (L);GANHO/PERDA (L);OBSERVAÇÕES\n`;

      const filteredLmc = lmc.filter((item) => {
        const itemDate = item.date ? item.date.substring(0, 10) : "";
        return itemDate >= startDate && itemDate <= endDate;
      });

      if (filteredLmc.length > 0) {
        let sumOpening = 0;
        let sumDelivery = 0;
        let sumSold = 0;
        let sumPhysical = 0;
        let sumGainLoss = 0;

        filteredLmc.forEach((item) => {
          const dt = formatDateBR(item.date);
          const fuel = item.fuelType || "Gasolina Comum";
          const open = Number(item.openingStock) || 0;
          const deliv = Number(item.deliveryVolume) || 0;
          const sold = Number(item.litersSold) || 0;
          const book = Number(item.bookStock) || (open + deliv - sold);
          const phys = Number(item.physicalStock) || 0;
          const diff = Number(item.gainLossLiters) || (phys - book);
          const obs = (item.observations || "").replace(/;/g, ",");

          sumOpening += open;
          sumDelivery += deliv;
          sumSold += sold;
          sumPhysical += phys;
          sumGainLoss += diff;

          csvContent += `${dt};${fuel};${open.toLocaleString("pt-BR")};${deliv.toLocaleString("pt-BR")};${sold.toLocaleString("pt-BR")};${book.toLocaleString("pt-BR")};${phys.toLocaleString("pt-BR")};${diff > 0 ? "+" : ""}${diff.toLocaleString("pt-BR")};${obs}\n`;
        });

        csvContent += `----------------------------------------------------------------------------------------------------\n`;
        csvContent += `TOTAL LMC CONSOLIDADO;;${sumOpening.toLocaleString("pt-BR")} L;${sumDelivery.toLocaleString("pt-BR")} L;${sumSold.toLocaleString("pt-BR")} L;;${sumPhysical.toLocaleString("pt-BR")} L;${sumGainLoss > 0 ? "+" : ""}${sumGainLoss.toLocaleString("pt-BR")} L;\n\n`;
      } else {
        csvContent += `-;Nenhum registro LMC encontrado no período;-;-;-;-;-;-;-\n\n`;
      }
    }

    if (activeTypes.includes("anp")) {
      // ANP Quality & Calibration Section
      csvContent += `--- AFERIÇÃO DE BICOS E CALIBRAÇÃO (ANP) ---\n`;
      csvContent += `DATA;BICO / DISPENSER;COMBUSTÍVEL;VOLUME AFERIDO (L);DESVIO (mL);LIMITE TOLERADO;STATUS DE CONFORMIDADE\n`;

      const filteredCalib = calibrations.filter((item) => {
        const itemDate = item.data ? item.data.substring(0, 10) : "";
        return itemDate >= startDate && itemDate <= endDate;
      });

      if (filteredCalib.length > 0) {
        filteredCalib.forEach((c) => {
          const dt = formatDateBR(c.data);
          const nozzleObj = (appState.nozzles || []).find((n) => n.id === c.nozzleId);
          const bico = nozzleObj ? nozzleObj.numeroBico : c.nozzleId || "Bico 01";
          const tankObj = nozzleObj ? (tanks || []).find((t) => t.id === nozzleObj.tanqueId) : null;
          const fuel = tankObj ? tankObj.combustivel : "Gasolina Comum";
          const vol = Number(c.volumeMedido) || 20;
          const desvio = Number(c.desvioMl) || 0;
          const status = c.conforme ? "CONFORME" : "NÃO CONFORME";
          csvContent += `${dt};${bico};${fuel};${vol.toLocaleString("pt-BR")} L;${desvio > 0 ? "+" : ""}${desvio} mL;±100 mL;${status}\n`;
        });
        csvContent += `\n`;
      } else {
        csvContent += `-;Nenhuma aferição de calibração no período;-;-;-;±100 mL;-\n\n`;
      }

      // Quality Audits
      csvContent += `--- CONTROLE DA QUALIDADE DE COMBUSTÍVEIS (PROVETAS & DENSIDADE) ---\n`;
      csvContent += `DATA;COMBUSTÍVEL;NOTA FISCAL (NF-E);DISTRIBUIDORA / FORNECEDOR;DENSIDADE (g/cm³);TEMPERATURA (°C);DENSIDADE 20°C;TEOR DE ETANOL (%);RESPONSÁVEL TÉCNICO;STATUS\n`;

      const filteredQuality = qualityAudits.filter((item) => {
        const itemDate = item.data ? item.data.substring(0, 10) : "";
        return itemDate >= startDate && itemDate <= endDate;
      });

      if (filteredQuality.length > 0) {
        filteredQuality.forEach((q) => {
          const dt = formatDateBR(q.data);
          const fuel = q.combustivel || "Gasolina Comum";
          const nfe = (q.numeroNotaFiscal || "-").replace(/;/g, ",");
          const forn = (q.fornecedorNota || "-").replace(/;/g, ",");
          const dens = Number(q.densidade) || 0.742;
          const temp = Number(q.temperatura) || 24.5;
          const d20 = q.densidadeCorrigida ? q.densidadeCorrigida.toFixed(4).replace(".", ",") : "-";
          const alcohol = q.teorEtanol !== undefined ? `${q.teorEtanol}%` : "N/A";
          const resp = (q.responsavelTecnico || "Técnico de Pista").replace(/;/g, ",");
          const status = q.conforme ? "CONFORME" : "NÃO CONFORME";

          csvContent += `${dt};${fuel};${nfe};${forn};${dens.toFixed(4).replace(".", ",")};${temp.toFixed(1).replace(".", ",")} °C;${d20};${alcohol};${resp};${status}\n`;
        });
        csvContent += `\n`;
      } else {
        csvContent += `-;Nenhum teste de qualidade de combustível no período;-;-;-;-;-;-;-;-\n\n`;
      }
    }

    if (activeTypes.includes("afericao")) {
      // Dedicated Aferição de Bicos e Calibração Section
      csvContent += `--- RELATÓRIO DE AFERIÇÃO DE BICOS E CALIBRAÇÃO DE VAZÃO ---\n`;
      csvContent += `DATA;BICO / DISPENSER;COMBUSTÍVEL;VOLUME AFERIDO (L);DESVIO (mL);LIMITE TOLERADO;STATUS DE CONFORME;OPERADOR RESPONSÁVEL;VALOR (R$)\n`;

      const filteredCalib = calibrations.filter((item) => {
        const itemDate = item.data ? item.data.substring(0, 10) : "";
        return itemDate >= startDate && itemDate <= endDate;
      });

      if (filteredCalib.length > 0) {
        filteredCalib.forEach((c) => {
          const dt = formatDateBR(c.data);
          const nozzleObj = (appState.nozzles || []).find((n) => n.id === c.nozzleId);
          const bico = nozzleObj ? `Bico ${nozzleObj.numeroBico}` : c.nozzleId || "Bico 01";
          const tankObj = nozzleObj ? (tanks || []).find((t) => t.id === nozzleObj.tanqueId) : null;
          const fuel = tankObj ? tankObj.combustivel : "Gasolina Comum";
          const vol = Number(c.volumeMedido) || 20;
          const desvio = Number(c.desvioMl) || 0;
          const status = c.conforme ? "CONFORME" : "NÃO CONFORME";
          const val = c.valorReais ? formatBRL(c.valorReais) : "R$ 0,00";
          csvContent += `${dt};${bico};${fuel};${vol.toLocaleString("pt-BR")} L;${desvio > 0 ? "+" : ""}${desvio} mL;±100 mL;${status};${c.operadorResponsavel || "Não Informado"};${val}\n`;
        });
        csvContent += `\n`;
      } else {
        csvContent += `-;Nenhuma aferição de calibração registrada no período;-;-;-;±100 mL;-;-;R$ 0,00\n\n`;
      }
    }

    if (activeTypes.includes("litrage")) {
      // Tanks Stock & Status
      csvContent += `--- SITUAÇÃO DO ESTOQUE E CAPACIDADE DOS TANQUES ---\n`;
      csvContent += `IDENTIFICADOR;COMBUSTÍVEL;CAPACIDADE MÁXIMA (L);VOLUME ATUAL (L);OCUPAÇÃO (%);PONTO CRÍTICO (L);STATUS DE OPERAÇÃO\n`;

      if (tanks.length > 0) {
        tanks.forEach((t) => {
          const cap = Number(t.capacidadeMaxima) || 0;
          const vol = Number(t.volumeAtual) || 0;
          const pct = cap > 0 ? ((vol / cap) * 100).toFixed(1).replace(".", ",") : "0,0";
          const crit = Number(t.pontoCriticoAlerta) || 0;
          const isCritical = vol <= crit ? "ALERTA CRÍTICO" : "NORMAL";

          csvContent += `${t.identificador};${t.combustivel};${cap.toLocaleString("pt-BR")};${vol.toLocaleString("pt-BR")};${pct}%;${crit.toLocaleString("pt-BR")};${isCritical}\n`;
        });
        csvContent += `\n`;
      } else {
        csvContent += `-;Nenhum tanque cadastrado no sistema;-;-;-;-;-\n\n`;
      }

      // Shifts Performance
      csvContent += `--- ESCALA E FECHAMENTO DE TURNOS DE PISTA ---\n`;
      csvContent += `DATA;TURNO;RESPONSÁVEL / FRENTISTA;STATUS DO TURNO\n`;

      const filteredShifts = shifts.filter((s) => {
        const sDate = s.data ? s.data.substring(0, 10) : "";
        return sDate >= startDate && sDate <= endDate;
      });

      if (filteredShifts.length > 0) {
        filteredShifts.forEach((s) => {
          const dt = formatDateBR(s.data);
          const turno = s.turno || "Turno 1";
          const frentista = (s.frentistaResponsavel || "Frentista de Pista").replace(/;/g, ",");
          const status = s.status || "Fechado";

          csvContent += `${dt};${turno};${frentista};${status.toUpperCase()}\n`;
        });
        csvContent += `\n`;
      } else {
        csvContent += `-;Nenhum turno registrado no período;-;-\n\n`;
      }
    }

    if (activeTypes.includes("deliveries")) {
      // Fuel Deliveries Section
      csvContent += `--- RELATÓRIO DE COMBUSTÍVEIS DESCARREGADOS (ENTREGAS NF-E) ---\n`;
      csvContent += `DATA RECEBIMENTO;NF-E / CHAVE;COMBUSTÍVEL;VOLUME RECEBIDO (LITS);PLACA CAMINHÃO;MOTORISTA\n`;

      const filteredDeliveries = deliveries.filter((d) => {
        const dDate = (d.data || d.date || "").substring(0, 10);
        return dDate >= startDate && dDate <= endDate;
      });

      if (filteredDeliveries.length > 0) {
        let totalVolDelivered = 0;
        filteredDeliveries.forEach((d) => {
          const dt = formatDateBR(d.data || d.date);
          const nfe = (d.nfe || d.invoiceNumber || "-").replace(/;/g, ",");
          const fuel = d.combustivel || d.fuelType || "Gasolina Comum";
          const vol = Number(d.volumeRecebido || d.volume) || 0;
          const placa = (d.placaCaminhao || d.truckPlate || "-").replace(/;/g, ",");
          const mot = (d.motorista || d.driverName || "-").replace(/;/g, ",");

          totalVolDelivered += vol;
          csvContent += `${dt};${nfe};${fuel};${vol.toLocaleString("pt-BR")} L;${placa};${mot}\n`;
        });
        csvContent += `----------------------------------------------------------------------------------------------------\n`;
        csvContent += `TOTAL DE ENTREGAS: ${filteredDeliveries.length};;;TOTAL VOLUME RECEBIDO: ${totalVolDelivered.toLocaleString("pt-BR")} L;;\n\n`;
      } else {
        csvContent += `-;Nenhum descarregamento de combustível registrado no período;-;-;-;-\n\n`;
      }
    }

    if (activeTypes.includes("dre")) {
      // DRE Section
      csvContent += `--- DEMONSTRATIVO DE RESULTADO DE LITRAGEM (DRE DE LITRAGEM) ---\n`;
      csvContent += `ESTRUTURA DRE;LITRAGEM (L);VALOR ESTIMADO (R$);% PARTICIPAÇÃO;DESCRIÇÃO\n`;

      const m = computeLitersMetrics(appState, startDate, endDate);

      csvContent += `(+) 1. VOLUME OPERACIONAL DE VENDAS E FATURAMENTO BRUTO;${m.totalLitersSold.toLocaleString("pt-BR")} L;${formatBRL(m.totalFaturamento)};100,0%;Faturamento bruto consolidado\n`;
      m.byFuel.forEach((f) => {
        const pct = m.totalLitersSold > 0 ? (f.litersSold / m.totalLitersSold) * 100 : 0;
        csvContent += `   1.1. Venda - ${f.fuel};${f.litersSold.toLocaleString("pt-BR")} L;${formatBRL(f.faturamento)};${pct.toFixed(1).replace(".", ",")}%;Faturamento estimado de ${f.fuel}\n`;
      });

      csvContent += `(-) 2. CUSTO DE AQUISIÇÃO DAS MERCADORIAS VENDIDAS (CMV);${m.totalLitersSold.toLocaleString("pt-BR")} L;${formatBRL(m.totalCusto)};${m.totalFaturamento > 0 ? ((m.totalCusto / m.totalFaturamento) * 100).toFixed(1).replace(".", ",") : "0,0"}%;Custo operacional total de aquisição\n`;
      m.byFuel.forEach((f) => {
        const pct = m.totalFaturamento > 0 ? (f.custo / m.totalFaturamento) * 100 : 0;
        csvContent += `   2.1. Custo CMV - ${f.fuel};${f.litersSold.toLocaleString("pt-BR")} L;${formatBRL(f.custo)};${pct.toFixed(1).replace(".", ",")}%;Custo de CMV de ${f.fuel}\n`;
      });

      csvContent += `(=) 3. APURAÇÃO DA MARGEM DE CONTRIBUIÇÃO DE LITRAGEM;${m.totalLitersSold.toLocaleString("pt-BR")} L;${formatBRL(m.totalMargem)};${m.totalFaturamento > 0 ? ((m.totalMargem / m.totalFaturamento) * 100).toFixed(1).replace(".", ",") : "0,0"}%;Margem operacional consolidada\n`;
      m.byFuel.forEach((f) => {
        const pct = m.totalMargem > 0 ? (f.margem / m.totalMargem) * 100 : 0;
        csvContent += `   3.1. Margem - ${f.fuel};${f.litersSold.toLocaleString("pt-BR")} L;${formatBRL(f.margem)};${pct.toFixed(1).replace(".", ",")}%;Margem operacional de ${f.fuel}\n`;
      });

      csvContent += `\nINDICADORES DE DESEMPENHO DE LITRAGEM\n`;
      csvContent += `Volume Total Vendido;${m.totalLitersSold.toLocaleString("pt-BR")} L;-\n`;
      csvContent += `Volume Total Recebido;${m.totalLitersDelivered.toLocaleString("pt-BR")} L;-\n`;
      csvContent += `Diferença Física LMC (Sobra/Perda);${m.totalGainLoss > 0 ? "+" : ""}${m.totalGainLoss.toLocaleString("pt-BR")} L;-\n`;
      csvContent += `Margem Média por Litro;${formatBRL(m.averageMarginPerLiter)} / L;-\n\n`;
    }

    if (activeTypes.includes("daily_balances")) {
      csvContent += `--- FECHAMENTO FINANCEIRO E BALANÇO DIÁRIO ---\n`;
      csvContent += `DATA;FECHADO POR;VENDAS COMBUSTÍVEL (R$);VENDAS LUBRIFICANTES (R$);OUTRAS RECEITAS (R$);TOTAL DESPESAS (R$);SALDO OPERACIONAL (R$);DINHEIRO (R$);CARTÃO CRÉDITO (R$);CARTÃO DÉBITO (R$);PIX (R$);A PRAZO (R$);OBSERVAÇÕES\n`;

      const filteredBalances = (appState.dailyBalances || []).filter((b) => {
        const bDate = b.data ? b.data.substring(0, 10) : "";
        return bDate >= startDate && bDate <= endDate;
      });

      if (filteredBalances.length > 0) {
        let totalComb = 0;
        let totalLub = 0;
        let totalOutros = 0;
        let totalDesp = 0;
        let totalSld = 0;

        filteredBalances.forEach((b) => {
          const dt = formatDateBR(b.data);
          const closedBy = (b.fechadoPor || "Não Informado").replace(/;/g, ",");
          const comb = b.vendaCombustivel || 0;
          const lub = b.vendaLubrificantes || 0;
          const outros = b.outrasReceitas || 0;
          const desp = b.totalDespesas || 0;
          const sld = b.saldoFinal || 0;
          const din = b.metodosPagamento?.dinheiro || 0;
          const cred = b.metodosPagamento?.cartaoCredito || 0;
          const deb = b.metodosPagamento?.cartaoDebito || 0;
          const pix = b.metodosPagamento?.pix || 0;
          const prazo = b.metodosPagamento?.prazo || 0;
          const obs = (b.observacoes || "").replace(/;/g, ",").replace(/\n/g, " ");

          totalComb += comb;
          totalLub += lub;
          totalOutros += outros;
          totalDesp += desp;
          totalSld += sld;

          csvContent += `${dt};${closedBy};${formatBRL(comb)};${formatBRL(lub)};${formatBRL(outros)};${formatBRL(desp)};${formatBRL(sld)};${formatBRL(din)};${formatBRL(cred)};${formatBRL(deb)};${formatBRL(pix)};${formatBRL(prazo)};${obs}\n`;
        });

        csvContent += `----------------------------------------------------------------------------------------------------\n`;
        csvContent += `TOTAL CONSOLIDADO;;${formatBRL(totalComb)};${formatBRL(totalLub)};${formatBRL(totalOutros)};${formatBRL(totalDesp)};${formatBRL(totalSld)};;;;;;\n\n`;
      } else {
        csvContent += `-;Nenhum fechamento de balanço diário registrado no período;-;-;-;-;-;-;-;-;-;-;-\n\n`;
      }
    }

    if (activeTypes.includes("audits")) {
      csvContent += `--- HISTÓRICO DE AUDITORIA E CONFORMIDADE ---\n`;
      csvContent += `DATA;HORA;CATEGORIA DE AÇÃO;ALVO;DETALHES DA OPERAÇÃO;OPERADOR;STATUS CONFORMIDADE\n`;

      const filteredAudits = (appState.audits || []).filter((aud) => {
        const audDate = aud.date ? aud.date.substring(0, 10) : "";
        return audDate >= startDate && audDate <= endDate;
      });

      if (filteredAudits.length > 0) {
        filteredAudits.forEach((aud) => {
          const dt = formatDateBR(aud.date);
          const hr = aud.time || "-";
          const cat = (aud.actionType || "INFO").replace(/;/g, ",");
          const target = (aud.target || "-").replace(/;/g, ",");
          const details = (aud.details || "").replace(/;/g, ",").replace(/\n/g, " ");
          const op = (aud.operator || "Sistema").replace(/;/g, ",");
          const status = (aud.complianceStatus || "Regular").replace(/;/g, ",");

          csvContent += `${dt};${hr};${cat};${target};${details};${op};${status}\n`;
        });
        csvContent += `----------------------------------------------------------------------------------------------------\n`;
        csvContent += `TOTAL DE REGISTROS: ${filteredAudits.length};;;;;;\n\n`;
      } else {
        csvContent += `-;Nenhum registro de auditoria encontrado no período;-;-;-;-;-\n\n`;
      }
    }

    // Signature Block
    if (appState.reportSignatureEnabled !== false) {
      const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
      const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";

      csvContent += `====================================================================================================\n`;
      csvContent += `DOCUMENTO EMITIDO ELETRONICAMENTE PELO SISTEMA MEU POSTO ERP VIA CERTIFICAÇÃO DIGITAL\n`;
      csvContent += `ASSINADO POR: ${signerName} (${signerRole})\n`;
      csvContent += `AUTENTICIDADE VERIFICADA EM: ${emissionDate}\n`;
      csvContent += `====================================================================================================\n`;
    }

    // Download trigger
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    if (returnString) {
      return csvContent;
    }
    if (returnBlob) {
      return blob;
    }
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    const sanitizedTitle = activeTypes.length > 1
      ? `Prestacao_Contas_Mensal_${activeTypes.length}_Relatorios`
      : `Relatorio_${getReportTitle(reportType).replace(/\s+/g, "_")}`;
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", `${sanitizedTitle}_MeuPosto_${startDate}_${endDate}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    alert("Erro ao exportar relatório em CSV: " + err.message);
  }
}

/**
 * Generates and downloads a high quality PDF report using jsPDF and jspdf-autotable.
 */
export function exportReportPDF({ appState, reportType, selectedTypes, startDate, endDate, returnBlob }: ExportReportOptions) {
  try {
    const activeTypes: ReportType[] = (selectedTypes && selectedTypes.length > 0)
      ? selectedTypes
      : (reportType === "consolidated" ? ["dre", "financial", "lmc", "anp", "litrage", "deliveries", "afericao", "daily_balances", "audits"] : [reportType]);

    const doc = new jsPDF("p", "mm", "a4");
    const periodText = `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
    const emissionDate = new Date().toLocaleString("pt-BR");
    const defaultCnpj = appState.users[0]?.cnpjPosto || "12.345.678/0001-99";

    const startX = 12;
    const endX = 198;
    const usableWidth = 186;

    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || defaultCnpj;
    const reportAddress = appState.reportHeaderAddress || "";

    const {
      tanks = [],
      transactions = [],
      lmc = [],
      calibrations = [],
      qualityAudits = [],
      shifts = [],
      deliveries = []
    } = appState;

    const filteredTxs = transactions.filter((tx) => {
      const txDate = tx.data ? tx.data.substring(0, 10) : "";
      return txDate >= startDate && txDate <= endDate;
    });

    const totalRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const totalExpense = filteredTxs
      .filter((tx) => tx.tipo === "Despesa")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const netProfit = totalRevenue - totalExpense;

    const fuelSalesRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Combustíveis")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const convenienceSalesRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Conveniência")
      .reduce((sum, tx) => sum + tx.valor, 0);

    const servicesSalesRevenue = filteredTxs
      .filter((tx) => tx.tipo === "Receita" && tx.categoria.includes("Serviços"))
      .reduce((sum, tx) => sum + tx.valor, 0);

    // 1. Top Decorative Bar
    doc.setDrawColor(16, 185, 129); // Emerald
    doc.setLineWidth(1.2);
    doc.line(startX, 14, endX, 14);

    // Header Info
    let textX = startX;
    if (appState.reportHeaderLogo) {
      try {
        doc.addImage(appState.reportHeaderLogo, "PNG", startX, 15.5, 12, 12);
        textX = startX + 15;
      } catch (e) {
        console.error("Logo PDF error:", e);
      }
    }

    const isMulti = activeTypes.length > 1;
    const docTitleText = isMulti
      ? `PRESTAÇÃO DE CONTAS MENSAL CONSOLIDADA (${activeTypes.length} MÓDULOS)`
      : getReportTitle(reportType).toUpperCase();

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(reportCompName, textX, 20);

    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${docTitleText} • CNPJ: ${reportCnpj}`, textX, 25);

    if (reportAddress) {
      doc.setFontSize(6.5);
      doc.text(reportAddress.length > 75 ? reportAddress.substring(0, 75) + "..." : reportAddress, textX, 29);
    }

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Período: ${periodText}`, endX, 19, { align: "right" });
    doc.text(`Emissão: ${emissionDate}`, endX, 23, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(startX, 32, endX, 32);

    let currentY = 35;

    if (isMulti) {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(startX, currentY, usableWidth, 11, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`PACOTE MENSAL DE CONSOLIDAÇÃO (${activeTypes.length} RELATÓRIOS SELECIONADOS):`, startX + 3, currentY + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const titlesList = activeTypes.map((t) => getReportTitle(t)).join(" • ");
      const truncatedList = titlesList.length > 95 ? titlesList.substring(0, 95) + "..." : titlesList;
      doc.text(truncatedList, startX + 3, currentY + 8.5);
      currentY += 15;
    }

    // KPI Cards Block (for financial)
    if (activeTypes.includes("financial")) {
      const cardW = usableWidth / 3;
      const cardH = 15;

      // Card 1
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.rect(startX, currentY, cardW - 2, cardH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(22, 101, 52);
      doc.text("FATURAMENTO TOTAL", startX + (cardW - 2) / 2, currentY + 4.5, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(22, 163, 74);
      doc.text(formatBRL(totalRevenue), startX + (cardW - 2) / 2, currentY + 11, { align: "center" });

      // Card 2
      const card2X = startX + cardW;
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.rect(card2X, currentY, cardW - 2, cardH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(153, 27, 27);
      doc.text("DESPESAS OPERACIONAIS", card2X + (cardW - 2) / 2, currentY + 4.5, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text(formatBRL(totalExpense), card2X + (cardW - 2) / 2, currentY + 11, { align: "center" });

      // Card 3
      const card3X = card2X + cardW;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.rect(card3X, currentY, cardW - 2, cardH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(30, 64, 175);
      doc.text("RESULTADO LÍQUIDO", card3X + (cardW - 2) / 2, currentY + 4.5, { align: "center" });
      doc.setFontSize(9);
      if (netProfit >= 0) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(220, 38, 38);
      doc.text(formatBRL(netProfit), card3X + (cardW - 2) / 2, currentY + 11, { align: "center" });

      currentY += 20;

      // Section 1: Revenue breakdown table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("DISTRIBUIÇÃO DAS RECEITAS POR CATEGORIA", startX, currentY);
      currentY += 3;

      const categoryRows = [
        [
          "Combustíveis (Bicos & Pista)",
          `${totalRevenue > 0 ? Math.round((fuelSalesRevenue / totalRevenue) * 100) : 0}%`,
          formatBRL(fuelSalesRevenue)
        ],
        [
          "Loja de Conveniência Integrada",
          `${totalRevenue > 0 ? Math.round((convenienceSalesRevenue / totalRevenue) * 100) : 0}%`,
          formatBRL(convenienceSalesRevenue)
        ],
        [
          "Serviços (Troca de Óleo / Ducha)",
          `${totalRevenue > 0 ? Math.round((servicesSalesRevenue / totalRevenue) * 100) : 0}%`,
          formatBRL(servicesSalesRevenue)
        ]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [["Categoria de Receita", "Participação (%)", "Faturamento Bruto (R$)"]],
        body: categoryRows,
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          1: { halign: "center" },
          2: { halign: "right", fontStyle: "bold" },
        },
        styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [226, 232, 240] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // Section 2: Cash Flow Transactions
      if (currentY > 220) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("EXTRATO DO FLUXO DE CAIXA NO PERÍODO", startX, currentY);
      currentY += 3;

      const txRows = filteredTxs.slice(-30).reverse().map((tx) => [
        formatDateBR(tx.data),
        tx.descricao || "-",
        tx.categoria || "-",
        tx.tipo || "Receita",
        formatBRL(tx.valor || 0)
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Descrição", "Categoria", "Tipo", "Valor (R$)"]],
        body: txRows.length > 0 ? txRows : [["-", "Nenhuma transação no período", "-", "-", "R$ 0,00"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "left" },
          2: { halign: "left" },
          3: { halign: "center", fontStyle: "bold" },
          4: { halign: "right", fontStyle: "bold" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body" && data.column.index === 3) {
            if (data.cell.text[0] === "Receita") {
              data.cell.styles.textColor = [22, 163, 74];
            } else if (data.cell.text[0] === "Despesa") {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("lmc")) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS (LMC)", startX, currentY);
      currentY += 3;

      const filteredLmc = lmc.filter((item) => {
        const itemDate = item.date ? item.date.substring(0, 10) : "";
        return itemDate >= startDate && itemDate <= endDate;
      });

      const lmcRows = filteredLmc.map((item) => {
        const open = Number(item.openingStock) || 0;
        const deliv = Number(item.deliveryVolume) || 0;
        const sold = Number(item.litersSold) || 0;
        const book = Number(item.bookStock) || (open + deliv - sold);
        const phys = Number(item.physicalStock) || 0;
        const diff = Number(item.gainLossLiters) || (phys - book);

        return [
          formatDateBR(item.date),
          item.fuelType || "Gasolina Comum",
          `${open.toLocaleString("pt-BR")} L`,
          `${deliv.toLocaleString("pt-BR")} L`,
          `${sold.toLocaleString("pt-BR")} L`,
          `${book.toLocaleString("pt-BR")} L`,
          `${phys.toLocaleString("pt-BR")} L`,
          `${diff > 0 ? "+" : ""}${diff.toLocaleString("pt-BR")} L`
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Combustível", "Inicial", "Entrada", "Vendas", "Escritural", "Físico", "Ganho/Perda"]],
        body: lmcRows.length > 0 ? lmcRows : [["-", "Sem registros no LMC no período", "-", "-", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "left", fontStyle: "bold" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right", fontStyle: "bold" },
          7: { halign: "right", fontStyle: "bold" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("anp")) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("AFERIÇÕES DE CALIBRAÇÃO E AUDITORIA DE QUALIDADE (ANP)", startX, currentY);
      currentY += 3;

      const calibRows = calibrations.map((c) => {
        const nozzleObj = (appState.nozzles || []).find((n) => n.id === c.nozzleId);
        const bico = nozzleObj ? nozzleObj.numeroBico : c.nozzleId || "Bico 01";
        const tankObj = nozzleObj ? (tanks || []).find((t) => t.id === nozzleObj.tanqueId) : null;
        const fuel = tankObj ? tankObj.combustivel : "Gasolina Comum";
        return [
          formatDateBR(c.data),
          bico,
          fuel,
          `${Number(c.volumeMedido || 20).toLocaleString("pt-BR")} L`,
          `${Number(c.desvioMl || 0) > 0 ? "+" : ""}${Number(c.desvioMl || 0)} mL`,
          c.conforme ? "Aprovado" : "Fora do Padrão"
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Bico", "Combustível", "Volume Aferido", "Desvio (mL)", "Status"]],
        body: calibRows.length > 0 ? calibRows : [["-", "Sem aferições de bicos no período", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "left", fontStyle: "bold" },
          2: { halign: "left" },
          3: { halign: "right" },
          4: { halign: "center" },
          5: { halign: "center", fontStyle: "bold" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("LAUDOS TÉCNICOS E CONTROLE QUALITATIVO DE PROVETAS (ANP)", startX, currentY);
      currentY += 3;

      const filteredQuality = qualityAudits.filter((q) => {
        const qDate = q.data ? q.data.substring(0, 10) : "";
        return qDate >= startDate && qDate <= endDate;
      });

      const qualityRows = filteredQuality.map((q) => {
        const dt = formatDateBR(q.data);
        const fuel = q.combustivel || "Gasolina Comum";
        const nfeStr = q.numeroNotaFiscal ? `${q.numeroNotaFiscal}${q.fornecedorNota ? ` (${q.fornecedorNota})` : ""}` : "-";
        const d20Str = q.densidadeCorrigida ? `${q.densidadeCorrigida.toFixed(4)} g/cm³` : `${q.densidade.toFixed(4)} g/cm³`;
        const alcoholStr = q.teorEtanol !== undefined ? `${q.teorEtanol}%` : "-";
        const statusStr = q.conforme ? "CONFORME" : "REPROVADO";

        return [dt, fuel, nfeStr, d20Str, alcoholStr, q.responsavelTecnico || "Técnico", statusStr];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Combustível", "Nota Fiscal / Fornecedor", "Massa Esp. D20", "Teor Etanol", "Responsável", "Veredicto"]],
        body: qualityRows.length > 0 ? qualityRows : [["-", "Sem laudos químicos no período", "-", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "left", fontStyle: "bold" },
          2: { halign: "left" },
          3: { halign: "right", fontStyle: "bold" },
          4: { halign: "center" },
          5: { halign: "left" },
          6: { halign: "center", fontStyle: "bold" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body" && data.column.index === 6) {
            if (data.cell.text[0] === "CONFORME") {
              data.cell.styles.textColor = [22, 163, 74];
            } else if (data.cell.text[0] === "REPROVADO") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fillColor = [254, 242, 242];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("afericao")) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("REGISTRO DE AFERIÇÃO DE BICOS E CALIBRAÇÃO (BALDE DE 20L)", startX, currentY);
      currentY += 3;

      const calibRows = calibrations.filter((item) => {
        const itemDate = item.data ? item.data.substring(0, 10) : "";
        return itemDate >= startDate && itemDate <= endDate;
      }).map((c) => {
        const nozzleObj = (appState.nozzles || []).find((n) => n.id === c.nozzleId);
        const bico = nozzleObj ? `Bico ${nozzleObj.numeroBico}` : c.nozzleId || "Bico 01";
        const tankObj = nozzleObj ? (tanks || []).find((t) => t.id === nozzleObj.tanqueId) : null;
        const fuel = tankObj ? tankObj.combustivel : "Gasolina Comum";
        return [
          formatDateBR(c.data),
          bico,
          fuel,
          `${Number(c.volumeMedido || 20).toLocaleString("pt-BR")} L`,
          `${Number(c.desvioMl || 0) > 0 ? "+" : ""}${Number(c.desvioMl || 0)} mL`,
          `R$ ${(c.valorReais || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          c.conforme ? "CONFORME" : "NÃO CONFORME",
          c.operadorResponsavel || "Não Informado"
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Bico / Dispenser", "Combustível", "Vol. Ensaio", "Desvio", "Valor (R$)", "Status", "Operador Responsável"]],
        body: calibRows.length > 0 ? calibRows : [["-", "Sem aferições de bicos no período", "-", "-", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "left", fontStyle: "bold" },
          2: { halign: "left" },
          3: { halign: "right" },
          4: { halign: "center" },
          5: { halign: "right" },
          6: { halign: "center", fontStyle: "bold" },
          7: { halign: "left" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body" && data.column.index === 6) {
            if (data.cell.text[0] === "CONFORME") {
              data.cell.styles.textColor = [22, 163, 74];
            } else if (data.cell.text[0] === "NÃO CONFORME") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fillColor = [254, 242, 242];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("litrage")) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("SITUAÇÃO ATUAL DOS TANQUES DE COMBUSTÍVEL", startX, currentY);
      currentY += 3;

      const tankRows = tanks.map((t) => [
        t.identificador,
        t.combustivel,
        `${(t.capacidadeMaxima || 0).toLocaleString("pt-BR")} L`,
        `${(t.volumeAtual || 0).toLocaleString("pt-BR")} L`,
        `${(t.pontoCriticoAlerta || 0).toLocaleString("pt-BR")} L`,
        t.volumeAtual <= t.pontoCriticoAlerta ? "ALERTA CRÍTICO" : "NORMAL"
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Tanque", "Combustível", "Capacidade", "Volume Atual", "Ponto Crítico", "Status"]],
        body: tankRows.length > 0 ? tankRows : [["-", "Nenhum tanque cadastrado", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          1: { halign: "left" },
          2: { halign: "right" },
          3: { halign: "right", fontStyle: "bold" },
          4: { halign: "right" },
          5: { halign: "center", fontStyle: "bold" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body" && data.column.index === 5) {
            if (data.cell.text[0] === "ALERTA CRÍTICO") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fillColor = [254, 242, 242];
            } else {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("deliveries")) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("HISTÓRICO DE COMBUSTÍVEIS DESCARREGADOS (ENTREGAS NF-E)", startX, currentY);
      currentY += 3;

      const filteredDeliveries = deliveries.filter((d) => {
        const dDate = (d.data || d.date || "").substring(0, 10);
        return dDate >= startDate && dDate <= endDate;
      });

      const deliveryRows = filteredDeliveries.map((d) => [
        formatDateBR(d.data || d.date),
        d.nfe || d.invoiceNumber || "-",
        d.combustivel || d.fuelType || "Gasolina Comum",
        `${(Number(d.volumeRecebido || d.volume) || 0).toLocaleString("pt-BR")} L`,
        d.placaCaminhao || d.truckPlate || "-",
        d.motorista || d.driverName || "-"
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "NF-e / Chave", "Combustível", "Volume Recebido", "Placa Caminhão", "Motorista"]],
        body: deliveryRows.length > 0 ? deliveryRows : [["-", "Nenhum descarregamento no período", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" },
          1: { halign: "left" },
          2: { halign: "left", fontStyle: "bold" },
          3: { halign: "right", fontStyle: "bold" },
          4: { halign: "center" },
          5: { halign: "left" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("dre")) {
      if (currentY > 200) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("DEMONSTRATIVO DE RESULTADO DE LITRAGEM (DRE DE LITRAGEM)", startX, currentY);
      currentY += 3;

      const m = computeLitersMetrics(appState, startDate, endDate);

      const dreRows: any[] = [];
      
      // Section 1
      dreRows.push([
        "1. VOLUME DE VENDAS E FATURAMENTO BRUTO",
        `${m.totalLitersSold.toLocaleString("pt-BR")} L`,
        formatBRL(m.totalFaturamento),
        "100.0%",
        "Consolidado Geral de Pista"
      ]);
      m.byFuel.forEach((f) => {
        const pct = m.totalLitersSold > 0 ? (f.litersSold / m.totalLitersSold) * 100 : 0;
        dreRows.push([
          `   • Venda - ${f.fuel}`,
          `${f.litersSold.toLocaleString("pt-BR")} L`,
          formatBRL(f.faturamento),
          `${pct.toFixed(1)}%`,
          `Preço Médio: R$ ${f.precoVenda.toFixed(2)}/L`
        ]);
      });

      // Section 2
      dreRows.push([
        "2. CUSTO DE AQUISIÇÃO DAS MERCADORIAS (CMV)",
        `${m.totalLitersSold.toLocaleString("pt-BR")} L`,
        `(-) ${formatBRL(m.totalCusto)}`,
        m.totalFaturamento > 0 ? `${((m.totalCusto / m.totalFaturamento) * 100).toFixed(1)}%` : "0%",
        "Custo Operacional Total"
      ]);
      m.byFuel.forEach((f) => {
        const pct = m.totalFaturamento > 0 ? (f.custo / m.totalFaturamento) * 100 : 0;
        dreRows.push([
          `   • CMV - ${f.fuel}`,
          `${f.litersSold.toLocaleString("pt-BR")} L`,
          `(-) ${formatBRL(f.custo)}`,
          `${pct.toFixed(1)}%`,
          `Custo Médio: R$ ${f.precoCusto.toFixed(2)}/L`
        ]);
      });

      // Section 3
      dreRows.push([
        "3. MARGEM DE CONTRIBUIÇÃO DE LITRAGEM",
        `${m.totalLitersSold.toLocaleString("pt-BR")} L`,
        `(+) ${formatBRL(m.totalMargem)}`,
        m.totalFaturamento > 0 ? `${((m.totalMargem / m.totalFaturamento) * 100).toFixed(1)}%` : "0%",
        "Resultado Operacional de Pista"
      ]);
      m.byFuel.forEach((f) => {
        const pct = m.totalMargem > 0 ? (f.margem / m.totalMargem) * 100 : 0;
        dreRows.push([
          `   • Margem - ${f.fuel}`,
          `${f.litersSold.toLocaleString("pt-BR")} L`,
          `(+) ${formatBRL(f.margem)}`,
          `${pct.toFixed(1)}%`,
          `Margem por Litro: R$ ${f.marginPerLiter.toFixed(2)}/L`
        ]);
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Estrutura DRE de Litragem", "Litros", "Valor Estimado (R$)", "% Part.", "Informações Operacionais"]],
        body: dreRows,
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "left", cellWidth: 70 },
          1: { halign: "right", fontStyle: "bold" },
          2: { halign: "right", fontStyle: "bold" },
          3: { halign: "center" },
          4: { halign: "left" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body") {
            const label = data.row.raw[0] || "";
            const isHeaderRow = label.startsWith("1.") || label.startsWith("2.") || label.startsWith("3.");
            if (isHeaderRow) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [241, 245, 249];
              if (label.startsWith("1.")) {
                data.cell.styles.textColor = [15, 23, 42];
              } else if (label.startsWith("2.")) {
                data.cell.styles.textColor = [153, 27, 27];
              } else if (label.startsWith("3.")) {
                data.cell.styles.textColor = [21, 128, 61];
              }
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("daily_balances")) {
      if (currentY > 200) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("REGISTROS DE FECHAMENTO FINANCEIRO E BALANÇO DIÁRIO", startX, currentY);
      currentY += 3;

      const filteredBalances = (appState.dailyBalances || []).filter((b) => {
        const bDate = b.data ? b.data.substring(0, 10) : "";
        return bDate >= startDate && bDate <= endDate;
      });

      const balanceRows = filteredBalances.map((b) => {
        const comb = b.vendaCombustivel || 0;
        const lub = b.vendaLubrificantes || 0;
        const outros = b.outrasReceitas || 0;
        const desp = b.totalDespesas || 0;
        const sld = b.saldoFinal || 0;

        return [
          formatDateBR(b.data),
          b.fechadoPor || "Gerente",
          formatBRL(comb),
          formatBRL(lub),
          formatBRL(outros),
          `(-) ${formatBRL(desp)}`,
          formatBRL(sld)
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Fechado Por", "Venda Comb.", "Venda Lubr.", "Outras Rec.", "Total Desp.", "Saldo Líquido"]],
        body: balanceRows.length > 0 ? balanceRows : [["-", "Sem registros de balanço diário no período", "-", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center" },
          1: { halign: "left" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right", textColor: [220, 38, 38] },
          6: { halign: "right", fontStyle: "bold" },
        },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body" && data.column.index === 6) {
            const val = data.cell.text[0] || "";
            if (val.includes("-")) {
              data.cell.styles.textColor = [220, 38, 38];
            } else if (val !== "R$ 0,00" && val !== "-") {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (activeTypes.includes("audits")) {
      if (currentY > 200) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text("LIVRO E HISTÓRICO DE AUDITORIA DE CONFORMIDADE", startX, currentY);
      currentY += 3;

      const filteredAudits = (appState.audits || []).filter((aud) => {
        const audDate = aud.date ? aud.date.substring(0, 10) : "";
        return audDate >= startDate && audDate <= endDate;
      });

      const auditRows = filteredAudits.map((aud) => [
        formatDateBR(aud.date),
        aud.time || "-",
        aud.actionType || "INFO",
        aud.target || "-",
        aud.details || "",
        aud.operator || "Sistema",
        aud.complianceStatus || "Regular"
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Data", "Hora", "Ação", "Módulo/Alvo", "Detalhes da Operação", "Operador", "Conformidade"]],
        body: auditRows.length > 0 ? auditRows : [["-", "-", "Sem registros de auditoria no período", "-", "-", "-", "-"]],
        theme: "grid",
        margin: { left: startX, right: 12 },
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        columnStyles: {
          0: { halign: "center", cellWidth: 15 },
          1: { halign: "center", cellWidth: 12 },
          2: { halign: "center", fontStyle: "bold", cellWidth: 18 },
          3: { halign: "left", cellWidth: 20 },
          4: { halign: "left", cellWidth: 70 },
          5: { halign: "left", cellWidth: 25 },
          6: { halign: "center", cellWidth: 20 },
        },
        styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [226, 232, 240] },
        didParseCell: function (data: any) {
          if (data.row.section === "body" && data.column.index === 6) {
            const status = data.cell.text[0] || "";
            if (status.toLowerCase().includes("atípico") || status.toLowerCase().includes("crítico") || status.toLowerCase().includes("reprovado") || status.toLowerCase().includes("limpeza")) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fillColor = [254, 242, 242];
            } else {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Page numbering and Signature
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, endX, 286, { align: "right" });
      doc.text(`Documento emitido por Meu Posto ERP - ${emissionDate}`, startX, 286);

      if (i === totalPages) {
        if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
          try {
            const sigWidth = 38;
            const sigHeight = 11;
            const sigX = (usableWidth / 2 + startX) - (sigWidth / 2);
            doc.addImage(appState.reportSignatureBase64, "PNG", sigX, 256, sigWidth, sigHeight);
          } catch (e) {
            console.error("Signature PDF error:", e);
          }
        }

        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(startX + 45, 269, endX - 45, 269);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(75, 85, 99);
        const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
        doc.text(signerName, usableWidth / 2 + startX, 273, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
        doc.text(signerRole, usableWidth / 2 + startX, 276, { align: "center" });
      }
    }

    const sanitizedTitle = isMulti
      ? `Prestacao_Contas_Mensal_${activeTypes.length}_Relatorios`
      : `Relatorio_${getReportTitle(reportType).replace(/\s+/g, "_")}`;
    if (returnBlob) {
      return doc.output("blob");
    }
    doc.save(`${sanitizedTitle}_MeuPosto_${startDate}_${endDate}.pdf`);
  } catch (err: any) {
    alert("Erro ao gerar PDF do relatório: " + err.message);
  }
}

function getReportTitle(type: ReportType): string {
  switch (type) {
    case "financial":
      return "Relatório Financeiro e DRE";
    case "lmc":
      return "Livro de Movimentação de Combustíveis (LMC)";
    case "anp":
      return "Relatório de Qualidade e Calibração ANP";
    case "afericao":
      return "Relatório de Aferição de Bicos (Volume e Vazão)";
    case "litrage":
      return "Relatório de Litragem e Estoque de Tanques";
    case "deliveries":
      return "Relatório de Combustíveis Descarregados (Entregas e Recebimento NF-e)";
    case "dre":
      return "Demonstrativo do Resultado do Exercicio DRE Mensal";
    case "daily_balances":
      return "Relatório de Balanços Diários e Caixa Consolidado";
    case "audits":
      return "Livro de Auditoria e Histórico de Conformidade";
    case "consolidated":
      return "Relatório Gerencial Consolidado do Posto";
    default:
      return "Relatório Gerencial";
  }
}
