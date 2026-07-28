/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, FuelTank } from "../types";
import { FileText, Calendar, TrendingUp, DollarSign, Download, Printer, AlertTriangle, CheckSquare, Square, Sparkles, Eye, Layers, ShieldCheck, Droplet, BarChart3, Truck, Calculator } from "lucide-react";
import ReportPreviewModal from "./ReportPreviewModal";
import { exportReportPDF, exportReportCSV, ReportType } from "../utils/reportExporter";

interface ReportsAdvancedProps {
  appState: AppState;
  onUpdateReportCustomization?: (customs: Partial<AppState>) => void;
}

export default function ReportsAdvanced({ appState, onUpdateReportCustomization }: ReportsAdvancedProps) {
  const { tanks = [], shifts = [], transactions = [], calibrations = [], qualityAudits = [] } = appState;

  // Selected report category type
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("consolidated");

  // Multi-report selection state for consolidating multiple reports into a single PDF
  const [selectedMultiReports, setSelectedMultiReports] = useState<ReportType[]>([
    "dre",
    "financial",
    "lmc",
    "anp"
  ]);

  // State to control report preview modal
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    reportType: ReportType;
    selectedTypes?: ReportType[];
    title: string;
    subtitle?: string;
    onExportPDF: () => void;
    onExportCSV: () => void;
  } | null>(null);

  // Custom range states
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Filter transactions in range
  const filteredTxs = transactions.filter((tx) => {
    const txDate = tx.data.substring(0, 10);
    return txDate >= startDate && txDate <= endDate;
  });

  // Math totals
  const totalRevenue = filteredTxs
    .filter((tx) => tx.tipo === "Receita")
    .reduce((sum, tx) => sum + tx.valor, 0);

  const totalExpense = filteredTxs
    .filter((tx) => tx.tipo === "Despesa")
    .reduce((sum, tx) => sum + tx.valor, 0);

  const netProfit = totalRevenue - totalExpense;

  // Fuel sales specific calculation (revenue from fuel category)
  const fuelSalesRevenue = filteredTxs
    .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Combustíveis")
    .reduce((sum, tx) => sum + tx.valor, 0);

  // Convenience store sales specific
  const convenienceSalesRevenue = filteredTxs
    .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Conveniência")
    .reduce((sum, tx) => sum + tx.valor, 0);

  // Service sales (Oil changes/car washes)
  const servicesSalesRevenue = filteredTxs
    .filter((tx) => tx.tipo === "Receita" && tx.categoria === "Serviços (Troca de Óleo / Ducha)")
    .reduce((sum, tx) => sum + tx.valor, 0);

  // Critical stock levels
  const criticalTanks = tanks.filter((t) => t.volumeAtual <= t.pontoCriticoAlerta);

  // Multi-report toggle handler
  const toggleMultiReport = (type: ReportType) => {
    if (selectedMultiReports.includes(type)) {
      if (selectedMultiReports.length === 1) {
        alert("Selecione pelo menos um relatório para consolidação.");
        return;
      }
      setSelectedMultiReports(selectedMultiReports.filter((t) => t !== type));
    } else {
      setSelectedMultiReports([...selectedMultiReports, type]);
    }
  };

  const applyMultiPreset = (preset: "all" | "accounting" | "anp" | "dre_financial") => {
    switch (preset) {
      case "all":
        setSelectedMultiReports(["dre", "financial", "lmc", "anp", "litrage", "deliveries"]);
        break;
      case "accounting":
        setSelectedMultiReports(["dre", "financial", "lmc"]);
        break;
      case "anp":
        setSelectedMultiReports(["lmc", "anp", "litrage", "deliveries"]);
        break;
      case "dre_financial":
        setSelectedMultiReports(["dre", "financial"]);
        break;
    }
  };

  // Centralized download calls
  const downloadReportsPDF = (type: ReportType, customSelected?: ReportType[]) => {
    exportReportPDF({
      appState,
      reportType: type,
      selectedTypes: customSelected || (type === "consolidated" ? selectedMultiReports : [type]),
      startDate,
      endDate,
    });
  };

  const downloadReportsCSV = (type: ReportType, customSelected?: ReportType[]) => {
    exportReportCSV({
      appState,
      reportType: type,
      selectedTypes: customSelected || (type === "consolidated" ? selectedMultiReports : [type]),
      startDate,
      endDate,
    });
  };

  // Triggering native window print with stylized media queries for advanced PDF compiler simulation
  const handlePrint = (layoutType: "A4" | "80mm") => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Permita pop-ups para abrir a janela de impressão do PDF.");
      return;
    }

    const title = `Relatório Consolidade Meu Posto - Período: ${new Date(
      startDate + "T00:00:00"
    ).toLocaleDateString("pt-BR")} a ${new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR")}`;

    const isThermal = layoutType === "80mm";

    const criticalTanksHTML = criticalTanks.length > 0 
      ? criticalTanks.map(t => `<tr><td>${t.identificador}</td><td>${t.combustivel}</td><td>${t.volumeAtual.toLocaleString()} L</td></tr>`).join("")
      : "<tr><td colspan='3' style='text-align:center;'>Nenhum tanque abaixo do ponto crítico</td></tr>";

    const lastTransactionsHTML = filteredTxs.slice(-10).reverse().map(tx => `
      <tr>
        <td>${new Date(tx.data).toLocaleDateString("pt-BR")}</td>
        <td>${tx.descricao}</td>
        <td>${tx.categoria}</td>
        <td style="text-align:right; font-weight:bold; color: ${tx.tipo === "Receita" ? "green" : "red"};">
          ${tx.tipo === "Receita" ? "+" : "-"} R$ ${tx.valor.toFixed(2)}
        </td>
      </tr>
    `).join("");

    const style = isThermal
      ? `
      body {
        font-family: 'Courier New', monospace;
        width: 80mm;
        margin: 0 auto;
        padding: 5px;
        color: #000;
        font-size: 11px;
        line-height: 1.3;
      }
      h1 { font-size: 16px; margin: 5px 0; text-align: center; }
      h2 { font-size: 13px; margin: 10px 0 5px 0; border-bottom: 1px dashed #000; padding-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; margin-top: 5px; }
      th, td { text-align: left; padding: 3px 0; font-size: 10px; }
      .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
      .bold { font-weight: bold; }
      .text-right { text-align: right; }
      .border-top { border-top: 1px dashed #000; padding-top: 5px; }
      .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
    `
      : `
      body {
        font-family: "Helvetica Neue", Arial, sans-serif;
        color: #334155;
        padding: 40px;
        font-size: 13px;
        line-height: 1.5;
        max-width: 800px;
        margin: 0 auto;
      }
      h1 { font-size: 24px; color: #1e3a8a; margin-bottom: 5px; }
      h2 { font-size: 16px; color: #0f172a; margin-top: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 30px; }
      .station-info { text-align: right; font-size: 11px; color: #64748b; }
      .grid-kpis { display: grid; grid-template-cols: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
      .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; rounded-lg; border-radius: 8px; }
      .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
      .kpi-value { font-size: 20px; font-weight: bold; margin-top: 5px; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th { background-color: #f1f5f9; color: #475569; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
      td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
      .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    `;

    const docContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>${style}</style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${(appState.nomePosto || "MEU POSTO").toUpperCase()}</h1>
              <p class="bold">Relatório Financeiro & Operacional</p>
            </div>
            ${!isThermal ? `
              <div class="station-info">
                <p class="bold">CNPJ Posto: ${appState.users[0]?.cnpjPosto || "12.345.678/0001-99"}</p>
                <p>Data de Geração: ${new Date().toLocaleString("pt-BR")}</p>
                <p>Período: ${startDate} até ${endDate}</p>
              </div>
            ` : ""}
          </div>

          ${isThermal ? `
            <p>CNPJ: ${appState.users[0]?.cnpjPosto || "12.345.678/0001-99"}</p>
            <p>Data Impressão: ${new Date().toLocaleString("pt-BR")}</p>
            <p>Período: ${startDate} a ${endDate}</p>
            <div class="divider"></div>
          ` : ""}

          <h2>Faturamento Consolidado</h2>
          ${!isThermal ? `
            <div class="grid-kpis">
              <div class="kpi-card">
                <div class="kpi-title">Faturamento Total</div>
                <div class="kpi-value" style="color: #16a34a;">R$ ${totalRevenue.toFixed(2)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-title">Despesas Operacionais</div>
                <div class="kpi-value" style="color: #dc2626;">R$ ${totalExpense.toFixed(2)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-title">Lucro Líquido</div>
                <div class="kpi-value" style="color: #2563eb;">R$ ${netProfit.toFixed(2)}</div>
              </div>
            </div>
          ` : `
            <table>
              <tr><td class="bold">Faturamento Bruto:</td><td class="text-right bold">R$ ${totalRevenue.toFixed(2)}</td></tr>
              <tr><td class="bold">Despesas Totais:</td><td class="text-right">R$ ${totalExpense.toFixed(2)}</td></tr>
              <tr class="border-top"><td class="bold">Lucro Líquido:</td><td class="text-right bold">R$ ${netProfit.toFixed(2)}</td></tr>
            </table>
            <div class="divider"></div>
          `}

          <h2>Distribuição de Receitas</h2>
          <table>
            ${isThermal ? `
              <tr><td>Venda de Combustíveis:</td><td class="text-right">R$ ${fuelSalesRevenue.toFixed(2)}</td></tr>
              <tr><td>Loja Conveniência:</td><td class="text-right">R$ ${convenienceSalesRevenue.toFixed(2)}</td></tr>
              <tr><td>Serviços de Ducha/Óleo:</td><td class="text-right">R$ ${servicesSalesRevenue.toFixed(2)}</td></tr>
            ` : `
              <thead>
                <tr>
                  <th>Categoria de Receita</th>
                  <th>Percentual</th>
                  <th style="text-align:right;">Faturamento Bruto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Combustíveis (Bicos & Pista)</td>
                  <td>${totalRevenue > 0 ? Math.round((fuelSalesRevenue / totalRevenue) * 100) : 0}%</td>
                  <td style="text-align:right; font-weight:bold;">R$ ${fuelSalesRevenue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Loja de Conveniência Integrada</td>
                  <td>${totalRevenue > 0 ? Math.round((convenienceSalesRevenue / totalRevenue) * 100) : 0}%</td>
                  <td style="text-align:right; font-weight:bold;">R$ ${convenienceSalesRevenue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Serviços (Troca de Óleo / Ducha)</td>
                  <td>${totalRevenue > 0 ? Math.round((servicesSalesRevenue / totalRevenue) * 100) : 0}%</td>
                  <td style="text-align:right; font-weight:bold;">R$ ${servicesSalesRevenue.toFixed(2)}</td>
                </tr>
              </tbody>
            `}
          </table>

          ${!isThermal ? "<div class='divider'></div>" : ""}

          <h2>Estoque Crítico Alerta</h2>
          <table>
            <thead>
              <tr>
                <th>Identificador</th>
                <th>Combustível</th>
                <th style="${!isThermal ? "text-align:right;" : ""}">Volume Atual</th>
              </tr>
            </thead>
            <tbody>
              ${criticalTanksHTML}
            </tbody>
          </table>

          ${!isThermal ? `
            <h2>Lançamentos de Fluxo de Caixa (Recentes)</h2>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th style="text-align:right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${lastTransactionsHTML}
              </tbody>
            </table>
          ` : ""}

          <div class="footer">
            <p>Laudo Técnico Emitido no ERP Meu Posto corporativo.</p>
            <p>© ${new Date().getFullYear()} Meu Posto. Todos os direitos reservados.</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(docContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Date filter top controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-display">
            <FileText className="text-indigo-600 h-6 w-6" />
            Painel Analítico de Relatórios
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Filtre dados financeiros consolidando litragens, lucratividade e despesas operacionais por data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 focus:outline-none font-semibold font-mono"
            />
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 focus:outline-none font-semibold font-mono"
            />
          </div>
        </div>
      </div>

      {/* KPI stats consolidated row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600">
            <TrendingUp className="h-20 w-20" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturamento do Período</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2 font-display">
              R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Soma de receitas brutas no período selecionado
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-600">
            <DollarSign className="h-20 w-20" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Despesas de Operação</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2 font-display">
              R$ {totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Despesas operacionais e custos consolidados
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-600">
            <Sparkles className="h-20 w-20" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resultado de Lucratividade</p>
            <p className={`text-3xl font-extrabold mt-2 font-display ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              R$ {netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
            Resultado financeiro líquido no período
          </div>
        </div>
      </div>

      {/* Advanced charts breakdown & PDF compilation button */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
            Faturamento por Categoria (Período Filtrado)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Combustíveis</span>
              <p className="text-lg font-bold text-slate-800 mt-1">R$ {fuelSalesRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{ width: `${totalRevenue > 0 ? (fuelSalesRevenue / totalRevenue) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1.5">
                {totalRevenue > 0 ? Math.round((fuelSalesRevenue / totalRevenue) * 100) : 0}% das receitas
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conveniência</span>
              <p className="text-lg font-bold text-slate-800 mt-1">R$ {convenienceSalesRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${totalRevenue > 0 ? (convenienceSalesRevenue / totalRevenue) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1.5">
                {totalRevenue > 0 ? Math.round((convenienceSalesRevenue / totalRevenue) * 100) : 0}% das receitas
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serviços Integrados</span>
              <p className="text-lg font-bold text-slate-800 mt-1">R$ {servicesSalesRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-amber-600 rounded-full"
                  style={{ width: `${totalRevenue > 0 ? (servicesSalesRevenue / totalRevenue) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 block mt-1.5">
                {totalRevenue > 0 ? Math.round((servicesSalesRevenue / totalRevenue) * 100) : 0}% das receitas
              </span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">Relatório de Estoques Abaixo do Nível Crítico</h4>
            {criticalTanks.length === 0 ? (
              <p className="text-xs text-emerald-600 font-semibold">✓ Todos os tanques operam em volumes seguros!</p>
            ) : (
              <div className="space-y-1.5">
                {criticalTanks.map((t) => (
                  <div key={t.id} className="flex justify-between items-center text-xs bg-rose-50 p-2 rounded-lg border border-rose-150">
                    <span className="font-semibold text-rose-700">{t.identificador} ({t.combustivel})</span>
                    <span className="font-mono font-bold text-rose-700">{t.volumeAtual.toLocaleString()} L restantes</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PDF & CSV Export Compiler Actions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Printer className="text-indigo-600 h-4 w-4" />
              Central de Exportação & Consolidação
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
              Prestação de Contas Mensal
            </span>
          </h3>

          {/* Multi-Report Selection Section */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/50 p-4 rounded-xl border border-indigo-100/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/60 pb-2.5">
              <div>
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Consolidação Múltipla para Prestação de Contas
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Marque os relatórios que deseja unificar em um <strong>único arquivo PDF consolidado</strong>:
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-indigo-600 text-white rounded-lg self-start sm:self-center shadow-xs">
                {selectedMultiReports.length} {selectedMultiReports.length === 1 ? "Relatório" : "Relatórios"} Selecionados
              </span>
            </div>

            {/* Quick Preset Kits */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Atalhos / Kits:</span>
              <button
                type="button"
                onClick={() => applyMultiPreset("accounting")}
                className="text-[10.5px] font-bold px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition shadow-2xs cursor-pointer"
              >
                📊 Kit Contábil (DRE + Financeiro + LMC)
              </button>
              <button
                type="button"
                onClick={() => applyMultiPreset("anp")}
                className="text-[10.5px] font-bold px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition shadow-2xs cursor-pointer"
              >
                ⛽ Kit Fiscal ANP (LMC + ANP + Tanques + Entregas)
              </button>
              <button
                type="button"
                onClick={() => applyMultiPreset("dre_financial")}
                className="text-[10.5px] font-bold px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition shadow-2xs cursor-pointer"
              >
                💰 DRE + Financeiro
              </button>
              <button
                type="button"
                onClick={() => applyMultiPreset("all")}
                className="text-[10.5px] font-bold px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-200 rounded-md transition shadow-2xs cursor-pointer"
              >
                ✨ Pacote Completo (Todos os 6)
              </button>
            </div>

            {/* Multi-selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {[
                { id: "dre" as ReportType, title: "DRE Mensal & Demonstrativo de Resultados", desc: "Apuração de faturamento, lucros e margem", icon: Calculator, color: "indigo" },
                { id: "financial" as ReportType, title: "Relatório Financeiro & Fluxo de Caixa", desc: "Receitas, despesas por categoria e saldos", icon: DollarSign, color: "emerald" },
                { id: "lmc" as ReportType, title: "Livro LMC (Movimentação de Combustíveis)", desc: "Abertura, fechamento e vendas por bomba", icon: FileText, color: "amber" },
                { id: "anp" as ReportType, title: "Laudo Qualidade ANP & Aferições", desc: "Densidade D20, calibração e conformidade", icon: ShieldCheck, color: "purple" },
                { id: "litrage" as ReportType, title: "Litragem & Medição de Tanques", desc: "Volumes físicos e alertas de nível crítico", icon: Droplet, color: "blue" },
                { id: "deliveries" as ReportType, title: "Combustíveis Descarregados (Entregas NF-e)", desc: "Entregas efetuadas, dados de notas e transportadoras", icon: Truck, color: "teal" },
              ].map((item) => {
                const isSelected = selectedMultiReports.includes(item.id);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleMultiReport(item.id)}
                    className={`p-3 rounded-xl border text-left text-xs transition flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? "bg-white border-indigo-500 text-indigo-950 font-semibold shadow-xs ring-2 ring-indigo-500/20"
                        : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 p-1 rounded-md ${isSelected ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                        <span className="font-bold text-xs leading-tight truncate">{item.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Direct Multi Export Button */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => downloadReportsPDF("consolidated", selectedMultiReports)}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-900/20"
              >
                <Download className="h-4 w-4" />
                Baixar PDF Consolidado ({selectedMultiReports.length} {selectedMultiReports.length === 1 ? "Relatório" : "Relatórios"})
              </button>

              <button
                onClick={() => downloadReportsCSV("consolidated", selectedMultiReports)}
                className="py-3 px-4 bg-white border border-indigo-200 text-indigo-900 hover:bg-indigo-50 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Download className="h-4 w-4 text-indigo-600" />
                Exportar CSV Consolidado
              </button>

              <button
                onClick={() => {
                  setPreviewModal({
                    isOpen: true,
                    reportType: "consolidated",
                    selectedTypes: selectedMultiReports,
                    title: `PRESTAÇÃO DE CONTAS MENSAL CONSOLIDADA (${selectedMultiReports.length} RELATÓRIOS)`,
                    subtitle: `Período selecionado: ${startDate.split("-").reverse().join("/")} a ${endDate.split("-").reverse().join("/")}`,
                    onExportPDF: () => downloadReportsPDF("consolidated", selectedMultiReports),
                    onExportCSV: () => downloadReportsCSV("consolidated", selectedMultiReports),
                  });
                }}
                className="py-3 px-3 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                title="Abrir pré-visualização interativa da consolidação"
              >
                <Eye className="h-4 w-4 text-indigo-200" />
                Preview
              </button>
            </div>
          </div>

          {/* Single Report Quick Selector */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="text-xs font-bold text-slate-700 block">
              Ou escolha um relatório individual específico:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "dre" as ReportType, title: "DRE Mensal", icon: Calculator },
                { id: "financial" as ReportType, title: "Financeiro", icon: DollarSign },
                { id: "lmc" as ReportType, title: "Livro LMC", icon: FileText },
                { id: "anp" as ReportType, title: "Laudo ANP", icon: ShieldCheck },
                { id: "litrage" as ReportType, title: "Litragem Tanques", icon: Droplet },
                { id: "deliveries" as ReportType, title: "Entregas NF-e", icon: Truck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => downloadReportsPDF(item.id)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{item.title} (PDF)</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handlePrint("A4")}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir A4
            </button>

            <button
              onClick={() => handlePrint("80mm")}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Térmico 80mm
            </button>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
            💡 <strong>Prestação de Contas Mensal:</strong> A seleção múltipla unifica todos os relatórios escolhidos (DRE, Financeiro, LMC, ANP, Litragem e Entregas) em um <strong>único documento PDF estruturado</strong>, facilitando o envio para a contabilidade ou diretoria do posto.
          </div>
        </div>
      </div>

      {previewModal && (
        <ReportPreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal(null)}
          appState={appState}
          onUpdateReportCustomization={onUpdateReportCustomization}
          reportType={previewModal.reportType}
          selectedTypes={previewModal.selectedTypes}
          title={previewModal.title}
          subtitle={previewModal.subtitle}
          onExportPDF={() => {
            previewModal.onExportPDF();
            setPreviewModal(null);
          }}
          onExportCSV={() => {
            previewModal.onExportCSV();
            setPreviewModal(null);
          }}
        />
      )}
    </div>
  );
}
