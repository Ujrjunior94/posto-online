/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import SubTabNavigation from "./SubTabNavigation";
import { AppState, DailyBalance as IDailyBalance, LmcRecord } from "../types";
import { 
  BarChart3, 
  Plus, 
  Search, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  PieChart, 
  Download, 
  FileText,
  Filter,
  ChevronRight,
  Printer,
  Droplets,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Scale,
  Fuel,
  Info,
  Edit,
  Trash2,
  Edit3,
  Save,
  BookOpen,
  Eye
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ReportPreviewModal from "./ReportPreviewModal";
import { exportReportPDF, exportReportCSV } from "../utils/reportExporter";
import { logAnalyticsEvent } from "../lib/firebase";

interface DailyBalanceProps {
  appState: AppState;
  onUpdateBalances: (balances: IDailyBalance[]) => void;
  onUpdateLmc?: (lmc: LmcRecord[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  userRole: string;
  cnpjPosto: string;
  onUpdateReportCustomization?: (customs: Partial<AppState>) => void;
  onClearData?: () => void;
}

const FUEL_LMC_OPTIONS = [
  "Gasolina C Comum (E30)",
  "Gasolina C Aditivada (E30)",
  "Etanol Hidratado",
  "Diesel B S10",
  "Diesel B S500"
];

const mapLmcFuelToTankFuel = (lmcFuel: string): string => {
  if (lmcFuel.includes("Gasolina C Comum") || lmcFuel.includes("Gasolina Comum")) return "Gasolina Comum";
  if (lmcFuel.includes("Gasolina C Aditivada") || lmcFuel.includes("Gasolina Aditivada")) return "Gasolina Aditivada";
  if (lmcFuel.includes("Etanol")) return "Etanol";
  if (lmcFuel.includes("Diesel B S10") || lmcFuel.includes("Diesel S10")) return "Diesel S10";
  if (lmcFuel.includes("Diesel B S500") || lmcFuel.includes("Diesel S500")) return "Diesel S500";
  return lmcFuel;
};

export default function DailyBalance({ 
  appState, 
  onUpdateBalances, 
  onUpdateLmc,
  onAddAuditLog,
  userRole,
  cnpjPosto,
  onUpdateReportCustomization
}: DailyBalanceProps) {
  const { dailyBalances = [], tanks = [], deliveries = [], nozzleClosings = [], lmc = [], transactions = [] } = appState;
  const isReadOnly = userRole === "Frentista";

  // State to control report preview modal
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    reportType: "lmc" | "anp" | "litrage" | "financial";
    title: string;
    subtitle?: string;
    onExportPDF: () => void;
    onExportCSV: () => void;
  } | null>(null);

  // States to control clearing balance data
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearOptions, setClearOptions] = useState({
    financial: true,
    lmc: true,
  });

  // Modes: "litrage" (default: Balanço Diário de Litragem), "list" (Financeiro), "reports", "form"
  const [view, setView] = useState<"litrage" | "list" | "form" | "reports">("litrage");
  const [manualEntryType, setManualEntryType] = useState<"financial" | "volumetric">("financial");
  const [balanceSourceMode, setBalanceSourceMode] = useState<"manual" | "nozzle_reader">("manual");

  const [selectedLitrageDate, setSelectedLitrageDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedFuelFilter, setSelectedFuelFilter] = useState<string>("ALL");

  const [filterPeriod, setFilterPeriod] = useState<"daily" | "monthly">("daily");
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Analytics and Exporter triggers
  React.useEffect(() => {
    logAnalyticsEvent("navigation_module", {
      module: "DailyBalance",
      view: view,
      timestamp: new Date().toISOString()
    });
  }, [view]);

  const handleExportDailyBalancesPDF = () => {
    let start = filterDate;
    let end = filterDate;
    if (filterPeriod === "monthly") {
      start = `${filterMonth}-01`;
      end = `${filterMonth}-31`;
    }
    exportReportPDF({
      appState,
      reportType: "daily_balances",
      startDate: start,
      endDate: end
    });
    logAnalyticsEvent("export_report", { type: "daily_balances", format: "pdf", period: filterPeriod });
  };

  const handleExportDailyBalancesCSV = () => {
    let start = filterDate;
    let end = filterDate;
    if (filterPeriod === "monthly") {
      start = `${filterMonth}-01`;
      end = `${filterMonth}-31`;
    }
    exportReportCSV({
      appState,
      reportType: "daily_balances",
      startDate: start,
      endDate: end
    });
    logAnalyticsEvent("export_report", { type: "daily_balances", format: "csv", period: filterPeriod });
  };

  // Edit trackers
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editingLmcId, setEditingLmcId] = useState<string | null>(null);

  // Form state for financial balance manual entry
  const [formData, setFormData] = useState<Partial<IDailyBalance>>({
    data: new Date().toISOString().split("T")[0],
    vendaCombustivel: 0,
    vendaLubrificantes: 0,
    outrasReceitas: 0,
    totalDespesas: 0,
    metodosPagamento: {
      dinheiro: 0,
      cartaoCredito: 0,
      cartaoDebito: 0,
      pix: 0,
      prazo: 0
    },
    observacoes: ""
  });

  const resetBalanceForm = () => {
    setFormData({
      data: new Date().toISOString().split("T")[0],
      vendaCombustivel: 0,
      vendaLubrificantes: 0,
      outrasReceitas: 0,
      totalDespesas: 0,
      metodosPagamento: {
        dinheiro: 0,
        cartaoCredito: 0,
        cartaoDebito: 0,
        pix: 0,
        prazo: 0
      },
      fechadoPor: appState.users[0]?.nomeCompleto || "Sistema",
      observacoes: ""
    });
  };

  // Form state for volumetric LMC balance manual entry
  const [lmcFormData, setLmcFormData] = useState({
    id: "",
    date: new Date().toISOString().split("T")[0],
    fuelType: FUEL_LMC_OPTIONS[0],
    openingStock: 0,
    deliveryVolume: 0,
    litersSold: 0,
    physicalStock: 0
  });

  const [success, setSuccess] = useState("");

  // Auto-fill financial values from registered shifts & nozzle closings for selected date
  const handleAutoFillShiftData = (targetDate: string) => {
    // Calculate fuel revenue from nozzle closings on targetDate
    const closingsForDate = nozzleClosings.filter((nc) => {
      const shift = appState.shifts.find((s) => s.id === nc.shiftId);
      return shift && shift.data === targetDate;
    });

    const calculatedFuelSales = closingsForDate.reduce((acc, curr) => acc + (Number(curr.valorVendidoCalculado) || 0), 0);

    // Calculate transactions for targetDate
    const txForDate = transactions.filter((t) => t.data.startsWith(targetDate));
    const lubSales = txForDate.filter((t) => t.categoria.includes("Serviços") || t.categoria.includes("Lubrificantes")).reduce((acc, t) => acc + (t.valor || 0), 0);
    const otherSales = txForDate.filter((t) => t.categoria.includes("Conveniência") && t.tipo === "Receita").reduce((acc, t) => acc + (t.valor || 0), 0);
    const expenses = txForDate.filter((t) => t.tipo === "Despesa").reduce((acc, t) => acc + (t.valor || 0), 0);

    const pixTotal = txForDate.filter((t) => t.formaPagamento === "PIX").reduce((acc, t) => acc + (t.valor || 0), 0);
    const dinheiroTotal = txForDate.filter((t) => t.formaPagamento === "Dinheiro").reduce((acc, t) => acc + (t.valor || 0), 0);
    const ccTotal = txForDate.filter((t) => t.formaPagamento === "Cartão de Crédito").reduce((acc, t) => acc + (t.valor || 0), 0);
    const cdTotal = txForDate.filter((t) => t.formaPagamento === "Cartão de Débito").reduce((acc, t) => acc + (t.valor || 0), 0);
    const prazoTotal = txForDate.filter((t) => t.formaPagamento === "Prazo").reduce((acc, t) => acc + (t.valor || 0), 0);

    setFormData((prev) => ({
      ...prev,
      data: targetDate,
      vendaCombustivel: calculatedFuelSales > 0 ? calculatedFuelSales : prev.vendaCombustivel || 0,
      vendaLubrificantes: lubSales > 0 ? lubSales : prev.vendaLubrificantes || 0,
      outrasReceitas: otherSales > 0 ? otherSales : prev.outrasReceitas || 0,
      totalDespesas: expenses > 0 ? expenses : prev.totalDespesas || 0,
      metodosPagamento: {
        dinheiro: dinheiroTotal > 0 ? dinheiroTotal : prev.metodosPagamento?.dinheiro || 0,
        pix: pixTotal > 0 ? pixTotal : prev.metodosPagamento?.pix || 0,
        cartaoCredito: ccTotal > 0 ? ccTotal : prev.metodosPagamento?.cartaoCredito || 0,
        cartaoDebito: cdTotal > 0 ? cdTotal : prev.metodosPagamento?.cartaoDebito || 0,
        prazo: prazoTotal > 0 ? prazoTotal : prev.metodosPagamento?.prazo || 0
      }
    }));

    setSuccess("Dados calculados automaticamente a partir dos encerrantes e caixa!");
    setTimeout(() => setSuccess(""), 3000);
  };

  // Detailed Nozzle Closings for the selected date
  const selectedDateNozzleClosings = useMemo(() => {
    const targetDate = formData.data || filterDate;
    return nozzleClosings.filter((nc) => {
      const shift = appState.shifts.find((s) => s.id === nc.shiftId);
      return (shift && shift.data === targetDate) || (nc as any).data === targetDate;
    });
  }, [nozzleClosings, appState.shifts, formData.data, filterDate]);

  const detailedNozzleClosings = useMemo(() => {
    return selectedDateNozzleClosings.map((nc) => {
      const nozzle = (appState.nozzles || []).find((n) => n.id === nc.nozzleId);
      const tank = nozzle ? (appState.tanks || []).find((t) => t.id === nozzle.tanqueId) : undefined;
      return {
        ...nc,
        nozzleNumber: nozzle ? nozzle.numeroBico : "Bico",
        pumpName: nozzle ? nozzle.bombaAssociada : "Bomba",
        fuelType: tank ? tank.combustivel : "Combustível",
        pricePerLiter: nozzle ? nozzle.precoPorLitro : 0,
      };
    });
  }, [selectedDateNozzleClosings, appState.nozzles, appState.tanks]);

  // Calculate yesterday's date string
  const getYesterdayStr = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    } catch (e) {
      return "";
    }
  };

  // Litrage calculation logic implementing exact user formula:
  // Diferença (L) = (Estoque Inicial de Ontem - Vendas de Ontem + Chegada de Produto de Ontem) - Estoque Inicial de Hoje
  const litrageReconciliation = useMemo(() => {
    const dateStr = selectedLitrageDate;
    const yesterdayStr = getYesterdayStr(dateStr);

    return FUEL_LMC_OPTIONS.map((fuelType) => {
      const mappedFuel = mapLmcFuelToTankFuel(fuelType);

      // Tanks for this fuel
      const matchedTanks = tanks.filter((t) => t.combustivel === mappedFuel);
      const matchedTankIds = new Set(matchedTanks.map((t) => t.id));

      // Nozzles for this fuel
      const matchedNozzles = (appState.nozzles || []).filter((n) => matchedTankIds.has(n.tanqueId));
      const matchedNozzleIds = new Set(matchedNozzles.map((n) => n.id));

      // 1. Estoque Inicial de Ontem (E_ontem)
      const lmcOntem = lmc.find(
        (r) => r.fuelType === fuelType && r.date === yesterdayStr && (!r.stationCnpj || r.stationCnpj === cnpjPosto)
      );
      
      const currentTankTotal = matchedTanks.reduce((acc, t) => acc + (Number(t.volumeAtual) || 0), 0);

      let estoqueInicialOntem = 0;
      if (lmcOntem) {
        estoqueInicialOntem = Number(lmcOntem.openingStock) || Number(lmcOntem.physicalStock) || 0;
      } else {
        // Fallback calculation based on tank capacity or default
        const tankCapSum = matchedTanks.reduce((acc, t) => acc + (Number(t.capacidadeMaxima) || 15000), 0);
        estoqueInicialOntem = currentTankTotal > 0 ? currentTankTotal : Math.round(tankCapSum * 0.7);
      }

      // 2. Venda de Ontem (V_ontem)
      let vendaOntem = 0;
      const shiftsYesterday = (appState.shifts || []).filter((s) => s.data === yesterdayStr);
      const shiftIdsYesterday = new Set(shiftsYesterday.map((s) => s.id));

      nozzleClosings.forEach((nc) => {
        if (matchedNozzleIds.has(nc.nozzleId) && (shiftIdsYesterday.has(nc.shiftId) || (nc as any).data === yesterdayStr)) {
          vendaOntem += Number(nc.litrosVendidos) || 0;
        }
      });

      if (vendaOntem === 0 && lmcOntem && lmcOntem.litersSold > 0) {
        vendaOntem = Number(lmcOntem.litersSold);
      }

      // 3. Chegada de Produto de Ontem (C_ontem)
      let chegadaOntem = 0;
      deliveries.forEach((d) => {
        const dDate = d.date || d.data;
        const dFuel = d.fuelType || d.combustivel || "";
        const isMatch = dFuel.includes(mappedFuel) || mappedFuel.includes(dFuel) || dFuel.includes(fuelType);
        if (dDate === yesterdayStr && isMatch) {
          chegadaOntem += Number(d.volume || d.volumeRecebido) || 0;
        }
      });

      if (chegadaOntem === 0 && lmcOntem && lmcOntem.deliveryVolume > 0) {
        chegadaOntem = Number(lmcOntem.deliveryVolume);
      }

      // 4. Estoque Teórico / Esperado de Hoje
      // (Estoque Inicial de Ontem - Venda de Ontem + Chegada de Ontem)
      const estoqueTeoricoHoje = estoqueInicialOntem - vendaOntem + chegadaOntem;

      // 5. Estoque Inicial de Hoje (Medição Física Hoje)
      const lmcHoje = lmc.find(
        (r) => r.fuelType === fuelType && r.date === dateStr && (!r.stationCnpj || r.stationCnpj === cnpjPosto)
      );

      let estoqueInicialHoje = 0;
      if (lmcHoje) {
        estoqueInicialHoje = Number(lmcHoje.openingStock) || Number(lmcHoje.physicalStock) || 0;
      } else if (dateStr === new Date().toISOString().split("T")[0] && currentTankTotal > 0) {
        estoqueInicialHoje = currentTankTotal;
      } else {
        estoqueInicialHoje = Math.max(0, estoqueTeoricoHoje);
      }

      // 6. Formula Result:
      // (Estoque Inicial de Ontem - Vendas de Ontem + Chegada de Ontem) - Estoque Inicial de Hoje
      const diferencaVolumetrica = estoqueTeoricoHoje - estoqueInicialHoje;
      const variacaoPercentual = estoqueTeoricoHoje > 0 ? (diferencaVolumetrica / estoqueTeoricoHoje) * 100 : 0;
      const dentroToleranciaAnp = Math.abs(variacaoPercentual) <= 0.6;

      return {
        fuelType,
        mappedFuel,
        estoqueInicialOntem,
        vendaOntem,
        chegadaOntem,
        estoqueTeoricoHoje,
        estoqueInicialHoje,
        diferencaVolumetrica,
        variacaoPercentual,
        dentroToleranciaAnp,
        tankCount: matchedTanks.length,
      };
    });
  }, [selectedLitrageDate, tanks, deliveries, nozzleClosings, lmc, appState, cnpjPosto]);

  const filteredLitrageData = useMemo(() => {
    if (selectedFuelFilter === "ALL") return litrageReconciliation;
    return litrageReconciliation.filter((item) => item.fuelType === selectedFuelFilter || item.mappedFuel === selectedFuelFilter);
  }, [litrageReconciliation, selectedFuelFilter]);

  const litrageTotals = useMemo(() => {
    return litrageReconciliation.reduce(
      (acc, curr) => ({
        estoqueInicialOntem: acc.estoqueInicialOntem + curr.estoqueInicialOntem,
        vendaOntem: acc.vendaOntem + curr.vendaOntem,
        chegadaOntem: acc.chegadaOntem + curr.chegadaOntem,
        estoqueTeoricoHoje: acc.estoqueTeoricoHoje + curr.estoqueTeoricoHoje,
        estoqueInicialHoje: acc.estoqueInicialHoje + curr.estoqueInicialHoje,
        diferencaVolumetrica: acc.diferencaVolumetrica + curr.diferencaVolumetrica,
      }),
      {
        estoqueInicialOntem: 0,
        vendaOntem: 0,
        chegadaOntem: 0,
        estoqueTeoricoHoje: 0,
        estoqueInicialHoje: 0,
        diferencaVolumetrica: 0,
      }
    );
  }, [litrageReconciliation]);

  // Export PDF Report for Litrage Balance
  const exportLitragePDF = () => {
    try {
      const doc = new jsPDF();
      const yesterdayStr = getYesterdayStr(selectedLitrageDate);
      const emissionDate = new Date().toLocaleString("pt-BR");

      const startX = 14;
      const endX = 196;
      const usableWidth = 182;

      // Header section with custom details
      const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
      const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
      const reportAddress = appState.reportHeaderAddress || "";

      doc.setDrawColor(16, 185, 129); // Emerald-500
      doc.setLineWidth(1);
      doc.line(startX, 15, endX, 15);

      let textX = startX;
      if (appState.reportHeaderLogo) {
        try {
          doc.addImage(appState.reportHeaderLogo, "PNG", startX, 16.5, 12, 12);
          textX = startX + 15;
        } catch (e) {
          console.error("Error drawing logo in PDF:", e);
        }
      }

      doc.setTextColor(16, 185, 129);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(reportCompName, textX, 21);

      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`CONCILIAÇÃO E BALANÇO DE LITRAGEM VOLUMÉTRICA • CNPJ: ${reportCnpj}`, textX, 26);
      if (reportAddress) {
        doc.setFontSize(6.5);
        doc.text(reportAddress.length > 80 ? reportAddress.substring(0, 80) + "..." : reportAddress, textX, 30);
      }

      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text(`Referência: ${(selectedLitrageDate || "").split("-").reverse().join("/")}`, endX, 20, { align: "right" });
      doc.text(`Emissão: ${emissionDate}`, endX, 24, { align: "right" });

      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.line(startX, 33, endX, 33);

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Data de Referência (Hoje): ${(selectedLitrageDate || "").split("-").reverse().join("/")}`, 14, 39);
      doc.text(`Data Anterior (Ontem): ${yesterdayStr.split("-").reverse().join("/")}`, 14, 45);
      doc.text(`Controle Operacional Integrado ERP`, 14, 51);

      // Formula annotation
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, 55, 182, 14, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(
        "Fórmula: (Estoque Inicial de Ontem - Venda de Ontem + Chegada de Ontem) - Estoque Inicial de Hoje = Sobra/Perda (L)",
        18,
        64
      );

      // Table data
      const tableRows = litrageReconciliation.map((item) => [
        item.fuelType,
        `${item.estoqueInicialOntem.toLocaleString("pt-BR")} L`,
        `${item.vendaOntem.toLocaleString("pt-BR")} L`,
        `${item.chegadaOntem.toLocaleString("pt-BR")} L`,
        `${item.estoqueTeoricoHoje.toLocaleString("pt-BR")} L`,
        `${item.estoqueInicialHoje.toLocaleString("pt-BR")} L`,
        `${item.diferencaVolumetrica > 0 ? "+" : ""}${item.diferencaVolumetrica.toLocaleString("pt-BR")} L`,
        `${item.variacaoPercentual.toFixed(2)}%`,
      ]);

      // Totals row
      tableRows.push([
        "TOTAL CONSOLIDADO",
        `${litrageTotals.estoqueInicialOntem.toLocaleString("pt-BR")} L`,
        `${litrageTotals.vendaOntem.toLocaleString("pt-BR")} L`,
        `${litrageTotals.chegadaOntem.toLocaleString("pt-BR")} L`,
        `${litrageTotals.estoqueTeoricoHoje.toLocaleString("pt-BR")} L`,
        `${litrageTotals.estoqueInicialHoje.toLocaleString("pt-BR")} L`,
        `${litrageTotals.diferencaVolumetrica > 0 ? "+" : ""}${litrageTotals.diferencaVolumetrica.toLocaleString("pt-BR")} L`,
        "--",
      ]);

      autoTable(doc, {
        startY: 74,
        head: [
          [
            "Combustível",
            "Estoque Inicial Ontem",
            "(-) Venda Ontem",
            "(+) Chegada Ontem",
            "(=) Estoque Teórico",
            "(-) Estoque Hoje",
            "Sobra/Perda (L)",
            "Variação (%)",
          ],
        ],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [226, 232, 240], textColor: 30, fontSize: 8, fontStyle: "bold" },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;

      if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
        try {
          const sigWidth = 40;
          const sigHeight = 12;
          const sigX = (usableWidth / 2 + startX) - (sigWidth / 2);
          doc.addImage(appState.reportSignatureBase64, "PNG", sigX, finalY, sigWidth, sigHeight);
        } catch (e) {
          console.error("Error adding signature image to PDF:", e);
        }
      }

      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(startX + 50, finalY + 14, endX - 50, finalY + 14);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
      doc.text(signerName, usableWidth / 2 + startX, finalY + 18, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
      doc.text(signerRole, usableWidth / 2 + startX, finalY + 22, { align: "center" });

      doc.save(`Balanco_Litragem_${selectedLitrageDate}.pdf`);
      onAddAuditLog("DOWNLOAD", "Balanço", `Exportou Balanço Volumétrico Diário de Litragem para a data ${selectedLitrageDate}`, "Regular");
    } catch (err: any) {
      alert("Erro ao gerar PDF do Balanço de Litragem: " + err.message);
    }
  };

  const exportLitrageCSV = () => {
    try {
      const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
      const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
      const reportAddress = appState.reportHeaderAddress || "";
      const emissionDate = new Date().toLocaleString("pt-BR");
      const yesterdayStr = getYesterdayStr(selectedLitrageDate);

      let csvContent = "\ufeff"; // UTF-8 BOM
      csvContent += `EMPRESA:;${reportCompName}\n`;
      csvContent += `CNPJ:;${reportCnpj}\n`;
      if (reportAddress) {
        csvContent += `ENDEREÇO:;${reportAddress}\n`;
      }
      csvContent += `RELATÓRIO:;CONCILIAÇÃO E BALANÇO DE LITRAGEM VOLUMÉTRICA\n`;
      csvContent += `DATA REF (HOJE):;${selectedLitrageDate.split("-").reverse().join("/")}\n`;
      csvContent += `DATA REF (ONTEM):;${yesterdayStr.split("-").reverse().join("/")}\n`;
      csvContent += `EMISSÃO:;${emissionDate}\n\n`;

      csvContent += "Combustível;Estoque Inicial Ontem (L);(-) Venda Ontem (L);(+) Chegada Ontem (L);(=) Estoque Teórico (L);(-) Estoque Hoje (L);Sobra/Perda (L);Variação (%)\n";

      litrageReconciliation.forEach((item) => {
        csvContent += `${item.fuelType};${item.estoqueInicialOntem};${item.vendaOntem};${item.chegadaOntem};${item.estoqueTeoricoHoje};${item.estoqueInicialHoje};${item.diferencaVolumetrica};${item.variacaoPercentual.toFixed(2)}%\n`;
      });

      // Total consolidated
      csvContent += `TOTAL CONSOLIDADO;${litrageTotals.estoqueInicialOntem};${litrageTotals.vendaOntem};${litrageTotals.chegadaOntem};${litrageTotals.estoqueTeoricoHoje};${litrageTotals.estoqueInicialHoje};${litrageTotals.diferencaVolumetrica};--\n`;

      if (appState.reportSignatureEnabled !== false) {
        const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
        const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
        csvContent += `\n`;
        csvContent += `ASSINADO ELETRONICAMENTE POR:\n`;
        csvContent += `${signerName};(${signerRole})\n`;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.setAttribute("href", url);
      downloadLink.setAttribute("download", `Balanco_Litragem_${selectedLitrageDate}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(url);

      onAddAuditLog("DOWNLOAD", "Balanço", `Exportou planilha de Balanço Volumétrico Diário de Litragem para a data ${selectedLitrageDate}`, "Regular");
    } catch (err: any) {
      alert("Erro ao gerar planilha do Balanço de Litragem: " + err.message);
    }
  };

  const filteredBalances = useMemo(() => {
    if (filterPeriod === "daily") {
      return dailyBalances.filter(b => b.data === filterDate);
    } else {
      return dailyBalances.filter(b => b.data.startsWith(filterMonth));
    }
  }, [dailyBalances, filterPeriod, filterDate, filterMonth]);

  const stats = useMemo(() => {
    const total = filteredBalances.reduce((acc, curr) => ({
      combustivel: acc.combustivel + curr.vendaCombustivel,
      lubrificantes: acc.lubrificantes + curr.vendaLubrificantes,
      despesas: acc.despesas + curr.totalDespesas,
      receitas: acc.receitas + curr.outrasReceitas,
      saldo: acc.saldo + curr.saldoFinal
    }), { combustivel: 0, lubrificantes: 0, despesas: 0, receitas: 0, saldo: 0 });

    return total;
  }, [filteredBalances]);

  const chartData = useMemo(() => {
    if (filterPeriod === "monthly") {
      const days: Record<string, number> = {};
      filteredBalances.forEach(b => {
        days[b.data] = (days[b.data] || 0) + b.saldoFinal;
      });
      return Object.entries(days).map(([name, value]) => ({ name: name.split("-")[2], value })).sort((a,b) => a.name.localeCompare(b.name));
    } else {
      if (filteredBalances.length === 0) return [];
      const b = filteredBalances[0];
      return [
        { name: "Combustível", value: b.vendaCombustivel, color: "#4f46e5" },
        { name: "Lubrificantes", value: b.vendaLubrificantes, color: "#10b981" },
        { name: "Outros", value: b.outrasReceitas, color: "#f59e0b" },
        { name: "Despesas", value: b.totalDespesas, color: "#ef4444" }
      ];
    }
  }, [filteredBalances, filterPeriod]);

  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const totalReceitas = (formData.vendaCombustivel || 0) + (formData.vendaLubrificantes || 0) + (formData.outrasReceitas || 0);
    const saldo = totalReceitas - (formData.totalDespesas || 0);

    const balanceData: IDailyBalance = {
      id: editingBalanceId || ("bal_" + Date.now()),
      data: formData.data || new Date().toISOString().split("T")[0],
      vendaCombustivel: formData.vendaCombustivel || 0,
      vendaLubrificantes: formData.vendaLubrificantes || 0,
      outrasReceitas: formData.outrasReceitas || 0,
      totalDespesas: formData.totalDespesas || 0,
      saldoFinal: saldo,
      metodosPagamento: formData.metodosPagamento as IDailyBalance["metodosPagamento"],
      fechadoPor: formData.fechadoPor || appState.users[0]?.nomeCompleto || "Sistema",
      stationCnpj: cnpjPosto,
      observacoes: formData.observacoes
    };

    let updatedList: IDailyBalance[];
    // Use findIndex to check if we are overwriting an existing ID OR overwriting by same date + station CNPJ
    const existingIndex = dailyBalances.findIndex(
      (b) => b.id === editingBalanceId || (b.data === balanceData.data && b.stationCnpj === cnpjPosto)
    );

    if (existingIndex >= 0) {
      updatedList = [...dailyBalances];
      const originalId = dailyBalances[existingIndex].id;
      updatedList[existingIndex] = { ...balanceData, id: originalId };
      onAddAuditLog("UPDATE", "Balanço Financeiro", `Atualizou balanço diário para ${balanceData.data}`, "Regular");
      setSuccess("Balanço financeiro atualizado com sucesso!");
    } else {
      updatedList = [...dailyBalances, balanceData];
      onAddAuditLog("CREATE", "Balanço Financeiro", `Emitiu balanço diário para ${balanceData.data}. Saldo: R$ ${saldo.toFixed(2)}`, "Regular");
      setSuccess("Balanço financeiro registrado com sucesso!");
    }

    onUpdateBalances(updatedList);
    setEditingBalanceId(null);
    resetBalanceForm();

    setTimeout(() => {
      setSuccess("");
      setView("list");
    }, 1500);
  };

  const handleDeleteBalance = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este registro de balanço financeiro?")) {
      const updated = dailyBalances.filter((b) => b.id !== id);
      onUpdateBalances(updated);
      onAddAuditLog("DELETE", "Balanço Financeiro", `Excluiu lançamento do balanço ID ${id}`, "Regular");
      logAnalyticsEvent("clear_data", { type: "financial_balance", id: id });
      setSuccess("Lançamento excluído com sucesso.");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleEditBalance = (b: IDailyBalance) => {
    setEditingBalanceId(b.id);
    setFormData({
      data: b.data,
      vendaCombustivel: b.vendaCombustivel,
      vendaLubrificantes: b.vendaLubrificantes,
      outrasReceitas: b.outrasReceitas,
      totalDespesas: b.totalDespesas,
      metodosPagamento: b.metodosPagamento || { dinheiro: 0, cartaoCredito: 0, cartaoDebito: 0, pix: 0, prazo: 0 },
      fechadoPor: b.fechadoPor,
      observacoes: b.observacoes || ""
    });
    setManualEntryType("financial");
    setView("form");
  };

  const handleSaveLMC = (e: React.FormEvent) => {
    e.preventDefault();
    const newLmcRecord: LmcRecord = {
      id: editingLmcId || ("lmc_man_" + Date.now()),
      date: lmcFormData.date,
      fuelType: lmcFormData.fuelType,
      openingStock: Number(lmcFormData.openingStock) || 0,
      deliveryVolume: Number(lmcFormData.deliveryVolume) || 0,
      litersSold: Number(lmcFormData.litersSold) || 0,
      physicalStock: Number(lmcFormData.physicalStock) || 0,
      stationCnpj: cnpjPosto
    };

    let updatedLmc: LmcRecord[];
    const existingIndex = lmc.findIndex((r) => r.id === newLmcRecord.id || (r.date === newLmcRecord.date && r.fuelType === newLmcRecord.fuelType));

    if (existingIndex >= 0) {
      updatedLmc = [...lmc];
      updatedLmc[existingIndex] = newLmcRecord;
    } else {
      updatedLmc = [...lmc, newLmcRecord];
    }

    if (onUpdateLmc) {
      onUpdateLmc(updatedLmc);
    }

    onAddAuditLog("CREATE", "LMC Volumétrico", `Registrou/Ajustou balanço volumétrico de ${newLmcRecord.fuelType} em ${newLmcRecord.date}`, "Regular");
    setSuccess("Lançamento volumétrico do LMC salvo com sucesso!");
    setEditingLmcId(null);

    setTimeout(() => {
      setSuccess("");
      setView("litrage");
    }, 1500);
  };

  const handleDeleteLmc = (id: string) => {
    if (window.confirm("Deseja remover este registro volumétrico do LMC?")) {
      const updated = lmc.filter((r) => r.id !== id);
      if (onUpdateLmc) onUpdateLmc(updated);
      onAddAuditLog("DELETE", "LMC Volumétrico", `Excluiu registro LMC ID ${id}`, "Regular");
      logAnalyticsEvent("clear_data", { type: "lmc_volumetric", id: id });
      setSuccess("Lançamento volumétrico excluído.");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleEditLmc = (r: LmcRecord) => {
    setEditingLmcId(r.id);
    setLmcFormData({
      id: r.id,
      date: r.date,
      fuelType: r.fuelType,
      openingStock: r.openingStock,
      deliveryVolume: r.deliveryVolume,
      litersSold: r.litersSold,
      physicalStock: r.physicalStock
    });
    setManualEntryType("volumetric");
    setView("form");
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Balanço Diário de Litragem & Fechamento"
        titleIcon={<Droplets className="h-5 w-5" />}
        subtitle="Conciliação física volumétrica de combustível e balanço financeiro"
        activeTab={view}
        onChange={(tabId) => setView(tabId as any)}
        tabs={[
          {
            id: "litrage",
            label: "Balanço de Litragem",
            icon: <Droplets className="h-4 w-4" />,
          },
          {
            id: "list",
            label: "Fechamento Financeiro",
            icon: <BarChart3 className="h-4 w-4" />,
            badge: dailyBalances.length,
          },
          {
            id: "reports",
            label: "Relatórios DRE",
            icon: <FileText className="h-4 w-4" />,
          },
        ]}
        rightElement={
          !isReadOnly ? (
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  setEditingBalanceId(null);
                  setEditingLmcId(null);
                  setView("form");
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Balanço Manual</span>
              </button>
              
              <button 
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold text-xs cursor-pointer"
                title="Limpar dados de balanço (financeiro e volumétrico)"
              >
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Limpar</span>
              </button>
            </div>
          ) : null
        }
      />

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {success}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. VIEW: BALANÇO DIÁRIO DE LITRAGEM (PROMPT EXPLICIT FORMULA) */}
      {/* ========================================================= */}
      {view === "litrage" && (
        <div className="space-y-6">
          
          {/* Formula Banner Explanation */}
          <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden border border-emerald-800/40">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-500/30">
                  <Scale className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                    Conciliação Volumétrica ANP & Controle de Tanques
                  </span>
                  <h3 className="text-lg font-black font-display tracking-tight text-white">
                    Fórmula Oficial do Balanço Diário de Litragem
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setPreviewModal({
                      isOpen: true,
                      reportType: "litrage",
                      title: "CONCILIAÇÃO E BALANÇO DE LITRAGEM VOLUMÉTRICA",
                      subtitle: `Balanço diário em litros ref: ${selectedLitrageDate.split("-").reverse().join("/")}`,
                      onExportPDF: exportLitragePDF,
                      onExportCSV: exportLitrageCSV,
                    });
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                  title="Visualizar pré-visualização completa do balanço volumétrico com cabeçalho e assinatura"
                >
                  <Eye className="h-4 w-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={exportLitragePDF}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar Balanço PDF</span>
                </button>
                <button
                  onClick={exportLitrageCSV}
                  className="px-4 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
                  title="Exportar balanço de litragem em formato planilha CSV"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar Planilha</span>
                </button>
              </div>
            </div>

            {/* User Formula Display Box */}
            <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl relative z-10 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Cálculo Executado em Litros (L):
              </span>
              <div className="text-sm sm:text-base font-extrabold font-mono text-emerald-200 tracking-wide">
                (Estoque Inicial de Ontem - Venda de Ontem + Chegada de Produto de Ontem) - Estoque Inicial de Hoje = Sobra/Perda (L)
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Integra automaticamente leituras de encerrantes (bicos), recebimentos de combustível (NF-e de cargas) e inventário de tanques.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 relative z-10 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-300">Data de Referência:</span>
                  <input
                    type="date"
                    value={selectedLitrageDate}
                    onChange={(e) => setSelectedLitrageDate(e.target.value)}
                    className="bg-transparent text-xs font-extrabold text-white outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl">
                  <Fuel className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-300">Combustível:</span>
                  <select
                    value={selectedFuelFilter}
                    onChange={(e) => setSelectedFuelFilter(e.target.value)}
                    className="bg-slate-900 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="ALL">Todos os Combustíveis</option>
                    {FUEL_LMC_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="text-xs text-slate-400 font-bold">
                Ontem considerado: <strong className="text-emerald-300">{(getYesterdayStr(selectedLitrageDate) || "").split("-").reverse().join("/")}</strong>
              </span>
            </div>
          </div>

          {/* Litrage KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estoque Inicial de Ontem</span>
              <p className="text-2xl font-black text-slate-900 font-display">
                {litrageTotals.estoqueInicialOntem.toLocaleString("pt-BR")} <span className="text-xs text-slate-400 font-sans">L</span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Físico inicial registrado</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">(-) Vendas de Ontem</span>
              <p className="text-2xl font-black text-rose-600 font-display">
                {litrageTotals.vendaOntem.toLocaleString("pt-BR")} <span className="text-xs text-slate-400 font-sans">L</span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Encerrantes / Leituras bicos</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">(+) Chegada de Produto</span>
              <p className="text-2xl font-black text-indigo-600 font-display">
                {litrageTotals.chegadaOntem.toLocaleString("pt-BR")} <span className="text-xs text-slate-400 font-sans">L</span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Cargas recebidas por NF-e</p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-md space-y-1 ${
              litrageTotals.diferencaVolumetrica < 0
                ? "bg-rose-500 text-white border-rose-600 shadow-rose-900/20"
                : litrageTotals.diferencaVolumetrica > 0
                ? "bg-emerald-600 text-white border-emerald-700 shadow-emerald-900/20"
                : "bg-slate-900 text-white border-slate-800"
            }`}>
              <span className="text-[10px] font-black uppercase tracking-widest block text-emerald-100">
                (=) Sobra / Perda Total (L)
              </span>
              <p className="text-2xl font-black font-display">
                {litrageTotals.diferencaVolumetrica > 0 ? "+" : ""}
                {litrageTotals.diferencaVolumetrica.toLocaleString("pt-BR")} <span className="text-xs opacity-80 font-sans">L</span>
              </p>
              <p className="text-[11px] opacity-90 font-bold">
                {litrageTotals.diferencaVolumetrica === 0
                  ? "Balanço volumétrico zerado"
                  : litrageTotals.diferencaVolumetrica > 0
                  ? "Sobra volumétrica apurada"
                  : "Perda volumétrica apurada"}
              </p>
            </div>
          </div>

          {/* Cards per Fuel - Detailed Step-by-Step Breakdown */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Fuel className="h-4 w-4 text-emerald-600" />
              Detalhamento de Litragem por Combustível
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredLitrageData.map((item) => {
                const isLoss = item.diferencaVolumetrica < 0;
                const isGain = item.diferencaVolumetrica > 0;

                return (
                  <div key={item.fuelType} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5 hover:border-emerald-300 transition">
                    
                    {/* Fuel Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">
                          Tanques Associados: {item.tankCount}
                        </span>
                        <h4 className="text-base font-black text-slate-900">{item.fuelType}</h4>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                        item.dentroToleranciaAnp
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                      }`}>
                        {item.dentroToleranciaAnp ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                        {item.dentroToleranciaAnp ? "Tolerância ANP OK (≤0,6%)" : "Alerta de Variação (>0,6%)"}
                      </span>
                    </div>

                    {/* Step-by-Step Formula Progression */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      
                      {/* Step 1: Estoque Inicial Ontem */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                          1. Est. Inicial Ontem
                        </span>
                        <span className="text-sm font-black text-slate-800 font-mono">
                          {item.estoqueInicialOntem.toLocaleString("pt-BR")} L
                        </span>
                      </div>

                      {/* Step 2: Venda Ontem */}
                      <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-100/80">
                        <span className="text-[9px] font-black text-rose-500 uppercase block mb-1">
                          2. (-) Venda Ontem
                        </span>
                        <span className="text-sm font-black text-rose-700 font-mono">
                          {item.vendaOntem.toLocaleString("pt-BR")} L
                        </span>
                      </div>

                      {/* Step 3: Chegada Produto */}
                      <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100/80">
                        <span className="text-[9px] font-black text-indigo-500 uppercase block mb-1">
                          3. (+) Chegada Ontem
                        </span>
                        <span className="text-sm font-black text-indigo-700 font-mono">
                          {item.chegadaOntem.toLocaleString("pt-BR")} L
                        </span>
                      </div>

                      {/* Step 4: Estoque Teórico Hoje */}
                      <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200">
                        <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                          4. (=) Est. Teórico Hoje
                        </span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {item.estoqueTeoricoHoje.toLocaleString("pt-BR")} L
                        </span>
                      </div>

                      {/* Step 5: Estoque Físico Inicial Hoje */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                          5. (-) Est. Inicial Hoje
                        </span>
                        <span className="text-sm font-black text-slate-800 font-mono">
                          {item.estoqueInicialHoje.toLocaleString("pt-BR")} L
                        </span>
                      </div>

                      {/* Step 6: Result / Balance */}
                      <div className={`p-3 rounded-2xl border ${
                        isLoss
                          ? "bg-rose-100/80 border-rose-200 text-rose-900"
                          : isGain
                          ? "bg-emerald-100/80 border-emerald-200 text-emerald-900"
                          : "bg-slate-100 border-slate-200 text-slate-900"
                      }`}>
                        <span className="text-[9px] font-black uppercase block mb-1 opacity-80">
                          6. (=) Sobra / Perda
                        </span>
                        <span className="text-sm font-black font-mono">
                          {isGain ? "+" : ""}{item.diferencaVolumetrica.toLocaleString("pt-BR")} L
                        </span>
                      </div>
                    </div>

                    {/* Variance Percentage Bar */}
                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                      <span className="text-slate-500 font-bold">Variação Percentual:</span>
                      <span className={`font-black font-mono ${
                        item.diferencaVolumetrica < 0 ? "text-rose-600" : item.diferencaVolumetrica > 0 ? "text-emerald-600" : "text-slate-700"
                      }`}>
                        {item.variacaoPercentual.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consolidated Table of Volumetric Litrage Balance */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-black text-slate-900">Tabela Consolidada de Litragem</h4>
                <p className="text-xs text-slate-500 font-medium">Resumo do cálculo diário de sobra/perda volumétrica</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreviewModal({
                      isOpen: true,
                      reportType: "litrage",
                      title: "CONCILIAÇÃO E BALANÇO DE LITRAGEM VOLUMÉTRICA",
                      subtitle: `Balanço diário em litros ref: ${(selectedLitrageDate || "").split("-").reverse().join("/")}`,
                      onExportPDF: exportLitragePDF,
                      onExportCSV: exportLitrageCSV,
                    });
                  }}
                  className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Visualizar pré-visualização completa com cabeçalho e assinatura"
                >
                  <Eye className="h-4 w-4 text-indigo-500" />
                  Preview
                </button>
                <button
                  onClick={exportLitragePDF}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  Imprimir Relatório
                </button>
                <button
                  onClick={exportLitrageCSV}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="Exportar dados do balanço para planilha em formato CSV"
                >
                  <Download className="h-4 w-4 text-emerald-500" />
                  Exportar Planilha
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-3">Combustível</th>
                    <th className="p-3 text-right">Estoque Inicial Ontem</th>
                    <th className="p-3 text-right text-rose-500">(-) Venda Ontem</th>
                    <th className="p-3 text-right text-indigo-500">(+) Chegada Ontem</th>
                    <th className="p-3 text-right">(=) Est. Teórico Hoje</th>
                    <th className="p-3 text-right">(-) Est. Inicial Hoje</th>
                    <th className="p-3 text-right font-extrabold">Sobra / Perda (L)</th>
                    <th className="p-3 text-center">Status ANP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {litrageReconciliation.map((item) => (
                    <tr key={item.fuelType} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-extrabold text-slate-900">{item.fuelType}</td>
                      <td className="p-3 text-right font-mono">{item.estoqueInicialOntem.toLocaleString("pt-BR")} L</td>
                      <td className="p-3 text-right font-mono text-rose-600">{item.vendaOntem.toLocaleString("pt-BR")} L</td>
                      <td className="p-3 text-right font-mono text-indigo-600">{item.chegadaOntem.toLocaleString("pt-BR")} L</td>
                      <td className="p-3 text-right font-mono text-slate-900 font-bold">{item.estoqueTeoricoHoje.toLocaleString("pt-BR")} L</td>
                      <td className="p-3 text-right font-mono">{item.estoqueInicialHoje.toLocaleString("pt-BR")} L</td>
                      <td className={`p-3 text-right font-black font-mono ${
                        item.diferencaVolumetrica < 0 ? "text-rose-600" : item.diferencaVolumetrica > 0 ? "text-emerald-600" : "text-slate-800"
                      }`}>
                        {item.diferencaVolumetrica > 0 ? "+" : ""}{item.diferencaVolumetrica.toLocaleString("pt-BR")} L
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          item.dentroToleranciaAnp ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {item.dentroToleranciaAnp ? "OK (≤0,6%)" : "Atenção"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white text-xs font-black">
                  <tr>
                    <td className="p-3 uppercase">TOTAL GERAL</td>
                    <td className="p-3 text-right font-mono">{litrageTotals.estoqueInicialOntem.toLocaleString("pt-BR")} L</td>
                    <td className="p-3 text-right font-mono text-rose-300">{litrageTotals.vendaOntem.toLocaleString("pt-BR")} L</td>
                    <td className="p-3 text-right font-mono text-indigo-300">{litrageTotals.chegadaOntem.toLocaleString("pt-BR")} L</td>
                    <td className="p-3 text-right font-mono">{litrageTotals.estoqueTeoricoHoje.toLocaleString("pt-BR")} L</td>
                    <td className="p-3 text-right font-mono">{litrageTotals.estoqueInicialHoje.toLocaleString("pt-BR")} L</td>
                    <td className="p-3 text-right font-mono text-emerald-300">
                      {litrageTotals.diferencaVolumetrica > 0 ? "+" : ""}{litrageTotals.diferencaVolumetrica.toLocaleString("pt-BR")} L
                    </td>
                    <td className="p-3 text-center">--</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. VIEW: FECHAMENTO FINANCEIRO (VISÃO GERAL DO CAIXA)      */}
      {/* ========================================================= */}
      {view === "list" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-xs">
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button 
                onClick={() => setFilterPeriod("daily")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition cursor-pointer ${filterPeriod === "daily" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`}
              >
                Diário
              </button>
              <button 
                onClick={() => setFilterPeriod("monthly")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition cursor-pointer ${filterPeriod === "monthly" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`}
              >
                Mensal
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {filterPeriod === "daily" ? (
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              ) : (
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
            
            <div className="flex-1" />
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExportDailyBalancesPDF}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition text-[10px] font-black uppercase tracking-widest cursor-pointer"
              >
                <Download className="h-4 w-4 text-slate-500 hover:text-indigo-600" />
                Exportar PDF
              </button>
              <button 
                onClick={handleExportDailyBalancesCSV}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4 text-white" />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendas Combustível</p>
              <p className="text-xl font-black text-slate-900 mt-1 font-display">{formatCurrency(stats.combustivel)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lubrificantes</p>
              <p className="text-xl font-black text-emerald-600 mt-1 font-display">{formatCurrency(stats.lubrificantes)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outras Receitas</p>
              <p className="text-xl font-black text-amber-500 mt-1 font-display">{formatCurrency(stats.receitas)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Despesas</p>
              <p className="text-xl font-black text-rose-500 mt-1 font-display">{formatCurrency(stats.despesas)}</p>
            </div>
            <div className="bg-indigo-600 p-5 rounded-2xl border border-indigo-700 shadow-lg shadow-indigo-100">
              <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">Saldo Líquido</p>
              <p className="text-xl font-black text-white mt-1 font-display">{formatCurrency(stats.saldo)}</p>
            </div>
          </div>

          {/* Charts & Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                Desempenho no Período
              </h3>
              <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                        tickFormatter={(val) => `R$ ${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(val: number) => [formatCurrency(val), "Valor"]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={filterPeriod === "daily" ? 60 : 20}>
                        {chartData.map((entry: any, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || '#4f46e5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                    Sem dados para exibir
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                <PieChart className="h-4 w-4 text-indigo-600" />
                Distribuição por Meio de Pagamento
              </h3>
              
              {filteredBalances.length > 0 && filteredBalances[0]?.metodosPagamento ? (
                <div className="space-y-4">
                  {Object.entries(filteredBalances[0].metodosPagamento).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                          {key === 'dinheiro' && <DollarSign className="h-4 w-4 text-emerald-500" />}
                          {key === 'cartaoCredito' && <CreditCard className="h-4 w-4 text-indigo-500" />}
                          {key === 'cartaoDebito' && <CreditCard className="h-4 w-4 text-sky-500" />}
                          {key === 'pix' && <TrendingUp className="h-4 w-4 text-teal-500" />}
                          {key === 'prazo' && <Calendar className="h-4 w-4 text-amber-500" />}
                        </div>
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{key.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(val as number)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                  Sem dados para exibir
                </div>
              )}
              {/* Historical Table of Manual & Automatic Balances with Edit and Delete actions */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Histórico de Balanços Financeiros Registrados
                  </h3>
                  {!isReadOnly && (
                    <button
                      onClick={() => {
                        setEditingBalanceId(null);
                        resetBalanceForm();
                        setManualEntryType("financial");
                        setView("form");
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Novo Lançamento</span>
                    </button>
                  )}
                </div>

                {dailyBalances.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum balanço financeiro registrado ainda.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="p-3">Data</th>
                          <th className="p-3">Fechado Por</th>
                          <th className="p-3">Combustível</th>
                          <th className="p-3">Lubrificantes</th>
                          <th className="p-3">Outros</th>
                          <th className="p-3">Despesas</th>
                          <th className="p-3">Saldo Líquido</th>
                          {!isReadOnly && <th className="p-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {dailyBalances.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-bold text-slate-800">{new Date(b.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                            <td className="p-3 text-slate-600">{b.fechadoPor || "Sistema"}</td>
                            <td className="p-3 font-mono text-slate-700">{formatCurrency(b.vendaCombustivel)}</td>
                            <td className="p-3 font-mono text-slate-700">{formatCurrency(b.vendaLubrificantes)}</td>
                            <td className="p-3 font-mono text-slate-700">{formatCurrency(b.outrasReceitas)}</td>
                            <td className="p-3 font-mono text-rose-600">{formatCurrency(b.totalDespesas)}</td>
                            <td className="p-3 font-mono font-bold text-emerald-600">{formatCurrency(b.saldoFinal)}</td>
                            {!isReadOnly && (
                              <td className="p-3 text-right space-x-2">
                                <button
                                  onClick={() => handleEditBalance(b)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Editar este balanço"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBalance(b.id)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Excluir este balanço"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. VIEW: FORMULÁRIO DE LANÇAMENTO MANUAL NO BALANÇO DIÁRIO */}
      {/* ========================================================= */}
      {view === "form" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl max-w-4xl mx-auto animate-in slide-in-from-bottom duration-500 space-y-6">
          
          {/* Header & Subtab Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                <Edit3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Inserir Informações no Balanço Diário
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Lançamento manual de fechamento financeiro ou conciliação volumétrica de litragem
                </p>
              </div>
            </div>

            {/* Sub-tab Switcher: Financial vs Volumetric */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setManualEntryType("financial")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                  manualEntryType === "financial"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <DollarSign className="h-4 w-4" />
                <span>Balanço Financeiro</span>
              </button>
              <button
                type="button"
                onClick={() => setManualEntryType("volumetric")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                  manualEntryType === "volumetric"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Droplets className="h-4 w-4" />
                <span>Balanço Volumétrico (LMC)</span>
              </button>
            </div>
          </div>

          {/* FORM TYPE 1: FINANCIAL MANUAL BALANCE */}
          {manualEntryType === "financial" && (
            <form onSubmit={handleSaveBalance} className="space-y-8">
              
              {/* Primary Source Mode Option Selector: Manual vs Nozzle Closing Reader */}
              <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl border border-slate-800 space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black ${
                      balanceSourceMode === "nozzle_reader" ? "bg-amber-500 text-slate-950" : "bg-indigo-600 text-white"
                    }`}>
                      {balanceSourceMode === "nozzle_reader" ? <Zap className="h-6 w-6" /> : <Edit3 className="h-6 w-6" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                        Método de Apuração do Balanço
                      </span>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight">
                        {balanceSourceMode === "nozzle_reader" ? "Leitura Automática por Encerrantes de Bicos" : "Lançamento Direto Manual"}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {balanceSourceMode === "nozzle_reader" 
                          ? "Consolidação automática dos totais calculados via hodômetros das bombas e encerrantes do dia."
                          : "Digite ou ajuste os totais do balanço financeiro manualmente."}
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector Buttons */}
                  <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700/80 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBalanceSourceMode("manual")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                        balanceSourceMode === "manual"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>1. Balanço Manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceSourceMode("nozzle_reader");
                        handleAutoFillShiftData(formData.data || new Date().toISOString().split("T")[0]);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                        balanceSourceMode === "nozzle_reader"
                          ? "bg-amber-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Zap className="h-4 w-4" />
                      <span>2. Leitura de Encerrante</span>
                    </button>
                  </div>
                </div>

                {/* Nozzle Closing Breakdown Details when Leitura de Encerrante is selected */}
                {balanceSourceMode === "nozzle_reader" && (
                  <div className="pt-3 border-t border-slate-800 space-y-3 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Droplets className="h-4 w-4 text-amber-400" />
                        Encerrantes Registrados no Dia ({formData.data || new Date().toISOString().split("T")[0]})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAutoFillShiftData(formData.data || new Date().toISOString().split("T")[0])}
                        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="h-3.5 w-3.5" /> Re-sincronizar Leituras
                      </button>
                    </div>

                    {detailedNozzleClosings.length === 0 ? (
                      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 italic">
                        ⚠️ Nenhum encerrante de bico registrado para esta data ({formData.data}).
                        <br />
                        <span className="text-[10px] text-amber-400 font-bold">
                          Dica: Registre os encerrantes no menu "Turnos & Encerrantes" ou preencha o valor manualmente abaixo.
                        </span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto bg-slate-950/80 rounded-2xl border border-slate-800 p-2">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="text-slate-400 uppercase text-[9px] border-b border-slate-800">
                            <tr>
                              <th className="p-2">Bico / Bomba</th>
                              <th className="p-2">Combustível</th>
                              <th className="p-2 text-right">Litros Vendidos</th>
                              <th className="p-2 text-right">Preço/L</th>
                              <th className="p-2 text-right text-emerald-400">Total (R$)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-200">
                            {detailedNozzleClosings.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-slate-900/60">
                                <td className="p-2 font-bold text-white">{item.nozzleNumber} ({item.pumpName})</td>
                                <td className="p-2 text-slate-300">{item.fuelType}</td>
                                <td className="p-2 text-right font-bold">{Number(item.litrosVendidos).toFixed(2)} L</td>
                                <td className="p-2 text-right text-slate-400">R$ {Number(item.pricePerLiter).toFixed(2)}</td>
                                <td className="p-2 text-right font-bold text-emerald-400">{formatCurrency(Number(item.valorVendidoCalculado))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Entradas de Receita */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest border-l-4 border-indigo-500 pl-3">
                    Entradas de Receita (R$)
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                        Data de Competência
                      </label>
                      <input 
                        type="date"
                        required
                        value={formData.data}
                        onChange={(e) => setFormData({...formData, data: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                        Venda de Combustível (R$)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={formData.vendaCombustivel}
                        onChange={(e) => setFormData({...formData, vendaCombustivel: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                        Venda de Lubrificantes / Serviços (R$)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={formData.vendaLubrificantes}
                        onChange={(e) => setFormData({...formData, vendaLubrificantes: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                        Outras Receitas / Conveniência (R$)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={formData.outrasReceitas}
                        onChange={(e) => setFormData({...formData, outrasReceitas: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Saídas & Formas de Pagamento */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-l-4 border-rose-500 pl-3">
                    Saídas & Meios de Pagamento
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                        Total de Despesas Operacionais (R$)
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={formData.totalDespesas}
                        onChange={(e) => setFormData({...formData, totalDespesas: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-rose-50 border border-rose-100 rounded-2xl text-sm font-bold text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none"
                      />
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/80 space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-1">
                        Detalhamento por Meio de Pagamento
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Dinheiro</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.metodosPagamento?.dinheiro}
                            onChange={(e) => setFormData({...formData, metodosPagamento: {...formData.metodosPagamento!, dinheiro: Number(e.target.value)}})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">PIX</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.metodosPagamento?.pix}
                            onChange={(e) => setFormData({...formData, metodosPagamento: {...formData.metodosPagamento!, pix: Number(e.target.value)}})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">C. Crédito</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.metodosPagamento?.cartaoCredito}
                            onChange={(e) => setFormData({...formData, metodosPagamento: {...formData.metodosPagamento!, cartaoCredito: Number(e.target.value)}})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">C. Débito</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.metodosPagamento?.cartaoDebito}
                            onChange={(e) => setFormData({...formData, metodosPagamento: {...formData.metodosPagamento!, cartaoDebito: Number(e.target.value)}})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">A Prazo (Faturado / Convênio)</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.metodosPagamento?.prazo}
                            onChange={(e) => setFormData({...formData, metodosPagamento: {...formData.metodosPagamento!, prazo: Number(e.target.value)}})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsavel & Observacoes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    Fechado Por / Operador
                  </label>
                  <input 
                    type="text"
                    value={formData.fechadoPor || appState.users[0]?.nomeCompleto || "Gerente"}
                    onChange={(e) => setFormData({...formData, fechadoPor: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    Observações / Resumo do Fechamento
                  </label>
                  <input 
                    type="text"
                    value={formData.observacoes || ""}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none"
                    placeholder="Observações do balanço..."
                  />
                </div>
              </div>

              {/* Live Balance Preview Box */}
              <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 border border-slate-800 shadow-lg">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                    Cálculo do Saldo Líquido do Dia
                  </span>
                  <div className="text-xs text-slate-300 font-mono">
                    Receitas: {formatCurrency((formData.vendaCombustivel || 0) + (formData.vendaLubrificantes || 0) + (formData.outrasReceitas || 0))} | Despesas: {formatCurrency(formData.totalDespesas || 0)}
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Saldo Final Líquido</span>
                  <span className="text-2xl font-black text-emerald-400 font-display">
                    {formatCurrency(((formData.vendaCombustivel || 0) + (formData.vendaLubrificantes || 0) + (formData.outrasReceitas || 0)) - (formData.totalDespesas || 0))}
                  </span>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setView("list")}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-xl shadow-indigo-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingBalanceId ? "Atualizar Balanço Financeiro" : "Salvar & Registrar Balanço"}</span>
                </button>
              </div>
            </form>
          )}

          {/* FORM TYPE 2: VOLUMETRIC / LMC MANUAL ENTRY */}
          {manualEntryType === "volumetric" && (
            <form onSubmit={handleSaveLMC} className="space-y-8">
              
              <div className="bg-emerald-50/80 border border-emerald-100 p-4 rounded-2xl space-y-1">
                <span className="text-xs font-black text-emerald-900 uppercase tracking-tight flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-emerald-600" />
                  Registro / Ajuste Volumétrico do LMC (Livro Movimentação de Combustíveis)
                </span>
                <p className="text-[11px] text-emerald-700">
                  Permite lançar ou alterar manualmente medições físicas de estoque inicial, recebimento de nota fiscal e vendas em litros.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    Data de Referência
                  </label>
                  <input 
                    type="date"
                    required
                    value={lmcFormData.date}
                    onChange={(e) => setLmcFormData({...lmcFormData, date: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    Combustível
                  </label>
                  <select
                    value={lmcFormData.fuelType}
                    onChange={(e) => setLmcFormData({...lmcFormData, fuelType: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                  >
                    {FUEL_LMC_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">
                      Estoque Inicial (Stock do Dia Anterior - L)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const targetDate = lmcFormData.date;
                        if (!targetDate) return;
                        const d = new Date(targetDate + "T12:00:00");
                        d.setDate(d.getDate() - 1);
                        const yestStr = d.toISOString().split("T")[0];

                        const lmcOntem = lmc.find(
                          (r) => r.fuelType === lmcFormData.fuelType && r.date === yestStr
                        );
                        if (lmcOntem) {
                          const val = Number(lmcOntem.physicalStock) || Number(lmcOntem.openingStock) || 0;
                          setLmcFormData((prev) => ({ ...prev, openingStock: val }));
                        } else {
                          const mappedFuel = mapLmcFuelToTankFuel(lmcFormData.fuelType);
                          const matchedTanks = tanks.filter((t) => t.combustivel === mappedFuel);
                          const currentTotal = matchedTanks.reduce((acc, t) => acc + (Number(t.volumeAtual) || 0), 0);
                          setLmcFormData((prev) => ({ ...prev, openingStock: currentTotal }));
                        }
                      }}
                      className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1 cursor-pointer transition"
                    >
                      ⚡ Puxar do Salvo de Ontem
                    </button>
                  </div>
                  <input 
                    type="number"
                    step="1"
                    required
                    value={lmcFormData.openingStock}
                    onChange={(e) => setLmcFormData({...lmcFormData, openingStock: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    (+) Chegada de Carga / NFe (L)
                  </label>
                  <input 
                    type="number"
                    step="1"
                    value={lmcFormData.deliveryVolume}
                    onChange={(e) => setLmcFormData({...lmcFormData, deliveryVolume: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    (-) Vendas do Dia (L)
                  </label>
                  <input 
                    type="number"
                    step="1"
                    required
                    value={lmcFormData.litersSold}
                    onChange={(e) => setLmcFormData({...lmcFormData, litersSold: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-rose-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">
                    (=) Medição Física da Sonda / Régua (L)
                  </label>
                  <input 
                    type="number"
                    step="1"
                    required
                    value={lmcFormData.physicalStock}
                    onChange={(e) => setLmcFormData({...lmcFormData, physicalStock: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Live Volumetric Theoretical Preview Box */}
              {(() => {
                const teorico = Number(lmcFormData.openingStock || 0) + Number(lmcFormData.deliveryVolume || 0) - Number(lmcFormData.litersSold || 0);
                const dif = Number(lmcFormData.physicalStock || 0) - teorico;
                const perc = lmcFormData.litersSold > 0 ? (Math.abs(dif) / lmcFormData.litersSold) * 100 : 0;
                const conforme = perc <= 0.6;

                return (
                  <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-3 border border-slate-800 shadow-lg">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                          Cálculo Prévio em Tempo Real:
                        </span>
                        <p className="text-sm font-mono text-slate-200 mt-0.5">
                          Estoque Teórico = ({lmcFormData.openingStock} + {lmcFormData.deliveryVolume} - {lmcFormData.litersSold}) = <strong>{teorico.toLocaleString("pt-BR")} L</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Diferença Aferida</span>
                        <span className={`text-xl font-black font-mono ${dif < 0 ? "text-rose-400" : dif > 0 ? "text-emerald-400" : "text-white"}`}>
                          {dif > 0 ? "+" : ""}{dif.toLocaleString("pt-BR")} L ({perc.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-bold">
                      <span className={conforme ? "text-emerald-400" : "text-amber-400"}>
                        {conforme ? "✓ Dentro da Tolerância ANP (≤ 0,6%)" : "⚠️ Variação acima da Tolerância ANP (0,6%)"}
                      </span>
                      <span className="text-slate-400 text-[10px] uppercase font-mono">ANP E30 / B15 CONFORME</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setView("litrage")}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-xl shadow-emerald-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingLmcId ? "Atualizar Lançamento Volumétrico" : "Salvar Lançamento Volumétrico LMC"}</span>
                </button>
              </div>
            </form>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 4. VIEW: RELATÓRIOS DRE                                   */}
      {/* ========================================================= */}
      {view === "reports" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs h-fit">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
              <Filter className="h-4 w-4 text-indigo-600" />
              Configurar Relatório
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Período</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold">
                  <option>Balanço Diário (Data Única)</option>
                  <option>Balanço Mensal (Consolidado)</option>
                  <option>Relatório Customizado (Período)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Inicial</label>
                <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Final</label>
                <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold" />
              </div>

              <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer">
                <Search className="h-4 w-4" />
                Gerar Visualização
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs min-h-[500px] flex flex-col">
              <div className="flex justify-between items-start mb-10 pb-6 border-b border-slate-50">
                <div>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Relatório de Balanço Financeiro</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Status: Consolidado e Revisado</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 transition cursor-pointer"><Printer className="h-5 w-5" /></button>
                  <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 transition cursor-pointer"><Download className="h-5 w-5" /></button>
                </div>
              </div>

              {filteredBalances.length > 0 ? (
                <div className="space-y-8 flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Receita Bruta</p>
                      <p className="text-lg font-black text-indigo-600 font-display">{formatCurrency(stats.combustivel + stats.lubrificantes + stats.receitas)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Custo/Despesa</p>
                      <p className="text-lg font-black text-rose-500 font-display">{formatCurrency(stats.despesas)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Margem Oper.</p>
                      <p className="text-lg font-black text-emerald-600 font-display">{Math.round((stats.saldo / (stats.combustivel + stats.lubrificantes + stats.receitas || 1)) * 100)}%</p>
                    </div>
                    <div className="bg-indigo-600 p-4 rounded-2xl shadow-md">
                      <p className="text-[9px] font-black text-indigo-200 uppercase mb-1">Saldo Final</p>
                      <p className="text-lg font-black text-white font-display">{formatCurrency(stats.saldo)}</p>
                    </div>
                  </div>

                  <div className="overflow-hidden border border-slate-100 rounded-2xl">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="p-4">Data</th>
                          <th className="p-4">Combustível</th>
                          <th className="p-4">Lubrificantes</th>
                          <th className="p-4">Despesas</th>
                          <th className="p-4 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredBalances.map((b) => (
                          <tr key={b.id} className="text-[11px] font-bold text-slate-600 hover:bg-slate-50/50 transition">
                            <td className="p-4">{(b.data || "").split("-").reverse().join("/")}</td>
                            <td className="p-4">{formatCurrency(b.vendaCombustivel)}</td>
                            <td className="p-4">{formatCurrency(b.vendaLubrificantes)}</td>
                            <td className="p-4 text-rose-400">{formatCurrency(b.totalDespesas)}</td>
                            <td className="p-4 text-right font-black text-slate-900">{formatCurrency(b.saldoFinal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                  <BarChart3 className="h-16 w-16 mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Nenhum dado encontrado para os filtros selecionados</p>
                </div>
              )}

              <div className="mt-auto pt-8 flex justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
                <span>Gerado em: {new Date().toLocaleString()}</span>
                <span>Assinatura Digital: MEUPOSTO-SEC-HASH-8821</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewModal && (
        <ReportPreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal(null)}
          appState={appState}
          onUpdateReportCustomization={onUpdateReportCustomization}
          reportType={previewModal.reportType}
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

      {isClearModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Limpar Dados do Balanço
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Esta ação é irreversível. Selecione o que deseja excluir.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={clearOptions.financial}
                  onChange={(e) => setClearOptions(prev => ({ ...prev, financial: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Fechamento Financeiro</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">Exclui todos os balanços financeiros diários lançados e o histórico de caixa.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={clearOptions.lmc}
                  onChange={(e) => setClearOptions(prev => ({ ...prev, lmc: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Balanço Volumétrico / LMC</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">Exclui todos os lançamentos manuais de estoque e vendas físicas no LMC.</p>
                </div>
              </label>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer animate-none"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  let clearedActions: string[] = [];
                  if (clearOptions.financial) {
                    onUpdateBalances([]);
                    clearedActions.push("Balanços Financeiros");
                  }
                  if (clearOptions.lmc && onUpdateLmc) {
                    onUpdateLmc([]);
                    clearedActions.push("Balanço Volumétrico / LMC");
                  }
                  
                  if (clearedActions.length > 0) {
                    onAddAuditLog(
                      "DELETE", 
                      "Balanço", 
                      `Realizou a limpeza completa dos seguintes dados do balanço: ${clearedActions.join(", ")}`, 
                      "Crítico"
                    );
                    setSuccess(`Dados de ${clearedActions.join(" e ")} limpos com sucesso!`);
                    setTimeout(() => setSuccess(""), 4000);
                  }
                  setIsClearModalOpen(false);
                }}
                disabled={!clearOptions.financial && !clearOptions.lmc}
                className={`flex-1 py-2.5 px-4 text-white font-bold text-xs rounded-xl transition cursor-pointer animate-none ${
                  (!clearOptions.financial && !clearOptions.lmc)
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
