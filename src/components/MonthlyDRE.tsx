/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { AppState, DailyBalance } from "../types";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  Download,
  FileText,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calculator,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Wallet,
  QrCode,
  Receipt,
  FileSpreadsheet,
  FileDown,
  HelpCircle,
  Percent,
  Sparkles,
  PlusCircle,
  ArrowLeftRight
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from "recharts";
import ReportPreviewModal from "./ReportPreviewModal";
import { exportReportPDF, exportReportCSV } from "../utils/reportExporter";

interface MonthlyDREProps {
  appState: AppState;
  onNavigateToBalanco?: () => void;
}

type PeriodOption = "30days" | "currentMonth" | "lastMonth" | "60days" | "90days" | "custom";

export default function MonthlyDRE({ appState, onNavigateToBalanco }: MonthlyDREProps) {
  // Date calculation helpers
  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().substring(0, 10);
  }, []);

  const getPresetDates = (preset: PeriodOption): { start: string; end: string } => {
    const today = new Date();
    const end = today.toISOString().substring(0, 10);

    if (preset === "30days") {
      const startD = new Date();
      startD.setDate(startD.getDate() - 30);
      return { start: startD.toISOString().substring(0, 10), end };
    }

    if (preset === "currentMonth") {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      return { start: `${year}-${month}-01`, end };
    }

    if (preset === "lastMonth") {
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: prevMonthDate.toISOString().substring(0, 10),
        end: lastDayPrevMonth.toISOString().substring(0, 10)
      };
    }

    if (preset === "60days") {
      const startD = new Date();
      startD.setDate(startD.getDate() - 60);
      return { start: startD.toISOString().substring(0, 10), end };
    }

    if (preset === "90days") {
      const startD = new Date();
      startD.setDate(startD.getDate() - 90);
      return { start: startD.toISOString().substring(0, 10), end };
    }

    return { start: "2026-06-01", end };
  };

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("30days");
  const [startDate, setStartDate] = useState<string>(() => getPresetDates("30days").start);
  const [endDate, setEndDate] = useState<string>(() => getPresetDates("30days").end);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    receitas: true,
    pagamentos: true,
    despesas: true,
  });

  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    reportType: "dre";
    title: string;
    subtitle: string;
    onExportPDF: () => void;
    onExportCSV: () => void;
  }>({
    isOpen: false,
    reportType: "dre",
    title: "",
    subtitle: "",
    onExportPDF: () => {},
    onExportCSV: () => {},
  });

  // --- COMPARATIVE ANALYSIS STATE (Recharts) ---
  type CompPresetOption = "currentVsLastMonth" | "last30VsPrev30" | "custom";
  const [compPreset, setCompPreset] = useState<CompPresetOption>("currentVsLastMonth");

  // Default comparison dates
  const defaultCompDates = useMemo(() => {
    const today = new Date();
    const end1 = today.toISOString().substring(0, 10);
    const year = today.getFullYear();
    const month = today.getMonth();

    const start1 = new Date(year, month, 1).toISOString().substring(0, 10);
    const start2 = new Date(year, month - 1, 1).toISOString().substring(0, 10);
    const end2 = new Date(year, month, 0).toISOString().substring(0, 10);

    return {
      p1Label: "Mês Atual",
      p1Start: start1,
      p1End: end1,
      p2Label: "Mês Anterior",
      p2Start: start2,
      p2End: end2,
    };
  }, []);

  const [compP1Label, setCompP1Label] = useState<string>("Mês Atual");
  const [compP1Start, setCompP1Start] = useState<string>(() => defaultCompDates.p1Start);
  const [compP1End, setCompP1End] = useState<string>(() => defaultCompDates.p1End);

  const [compP2Label, setCompP2Label] = useState<string>("Mês Anterior");
  const [compP2Start, setCompP2Start] = useState<string>(() => defaultCompDates.p2Start);
  const [compP2End, setCompP2End] = useState<string>(() => defaultCompDates.p2End);

  const [compChartType, setCompChartType] = useState<"bar" | "line">("bar");

  const handleCompPresetChange = (preset: CompPresetOption) => {
    setCompPreset(preset);
    const today = new Date();
    const end1 = today.toISOString().substring(0, 10);

    if (preset === "currentVsLastMonth") {
      const year = today.getFullYear();
      const month = today.getMonth();
      const start1 = new Date(year, month, 1).toISOString().substring(0, 10);
      const start2 = new Date(year, month - 1, 1).toISOString().substring(0, 10);
      const end2 = new Date(year, month, 0).toISOString().substring(0, 10);

      setCompP1Label("Mês Atual");
      setCompP1Start(start1);
      setCompP1End(end1);
      setCompP2Label("Mês Anterior");
      setCompP2Start(start2);
      setCompP2End(end2);
    } else if (preset === "last30VsPrev30") {
      const d30 = new Date(); d30.setDate(d30.getDate() - 30);
      const d31 = new Date(); d31.setDate(d31.getDate() - 31);
      const d60 = new Date(); d60.setDate(d60.getDate() - 60);

      setCompP1Label("Últimos 30 Dias");
      setCompP1Start(d30.toISOString().substring(0, 10));
      setCompP1End(end1);
      setCompP2Label("30 Dias Anteriores");
      setCompP2Start(d60.toISOString().substring(0, 10));
      setCompP2End(d31.toISOString().substring(0, 10));
    }
  };

  // Helper to compute metrics for any arbitrary date range
  const computeMetricsForRange = (balances: DailyBalance[], start: string, end: string) => {
    const filtered = (balances || []).filter((b) => {
      const d = (b.data || "").substring(0, 10);
      return d >= start && d <= end;
    }).sort((a, b) => a.data.localeCompare(b.data));

    let totalCombustivel = 0;
    let totalLubrificantes = 0;
    let totalOutras = 0;
    let totalDespesas = 0;

    filtered.forEach((b) => {
      totalCombustivel += Number(b.vendaCombustivel) || 0;
      totalLubrificantes += Number(b.vendaLubrificantes) || 0;
      totalOutras += Number(b.outrasReceitas) || 0;
      totalDespesas += Number(b.totalDespesas) || 0;
    });

    const receitaBrutaTotal = totalCombustivel + totalLubrificantes + totalOutras;
    const lucroLiquido = receitaBrutaTotal - totalDespesas;
    const margemLiquida = receitaBrutaTotal > 0 ? (lucroLiquido / receitaBrutaTotal) * 100 : 0;
    const daysCount = filtered.length || 1;

    return {
      filtered,
      totalCombustivel,
      totalLubrificantes,
      totalOutras,
      receitaBrutaTotal,
      totalDespesas,
      lucroLiquido,
      margemLiquida,
      daysCount: filtered.length,
      mediaFaturamentoDiario: receitaBrutaTotal / daysCount,
    };
  };

  const metricsP1 = useMemo(() => {
    return computeMetricsForRange(appState.dailyBalances || [], compP1Start, compP1End);
  }, [appState.dailyBalances, compP1Start, compP1End]);

  const metricsP2 = useMemo(() => {
    return computeMetricsForRange(appState.dailyBalances || [], compP2Start, compP2End);
  }, [appState.dailyBalances, compP2Start, compP2End]);

  // Recharts Data Source for Categories Bar Chart
  const categoryChartData = useMemo(() => {
    return [
      {
        category: "Receita Bruta",
        [compP1Label]: metricsP1.receitaBrutaTotal,
        [compP2Label]: metricsP2.receitaBrutaTotal,
      },
      {
        category: "Combustíveis",
        [compP1Label]: metricsP1.totalCombustivel,
        [compP2Label]: metricsP2.totalCombustivel,
      },
      {
        category: "Lubrificantes",
        [compP1Label]: metricsP1.totalLubrificantes,
        [compP2Label]: metricsP2.totalLubrificantes,
      },
      {
        category: "Outras Receitas",
        [compP1Label]: metricsP1.totalOutras,
        [compP2Label]: metricsP2.totalOutras,
      },
      {
        category: "Despesas",
        [compP1Label]: metricsP1.totalDespesas,
        [compP2Label]: metricsP2.totalDespesas,
      },
      {
        category: "Lucro Líquido",
        [compP1Label]: metricsP1.lucroLiquido,
        [compP2Label]: metricsP2.lucroLiquido,
      },
    ];
  }, [metricsP1, metricsP2, compP1Label, compP2Label]);

  // Recharts Data Source for Daily Evolution Line Chart
  const dailyEvolutionChartData = useMemo(() => {
    const maxDays = Math.max(metricsP1.filtered.length, metricsP2.filtered.length);
    if (maxDays === 0) return [];

    return Array.from({ length: maxDays }, (_, i) => {
      const b1 = metricsP1.filtered[i];
      const b2 = metricsP2.filtered[i];
      const rec1 = b1 ? (Number(b1.vendaCombustivel) || 0) + (Number(b1.vendaLubrificantes) || 0) + (Number(b1.outrasReceitas) || 0) : 0;
      const rec2 = b2 ? (Number(b2.vendaCombustivel) || 0) + (Number(b2.vendaLubrificantes) || 0) + (Number(b2.outrasReceitas) || 0) : 0;
      const desp1 = b1 ? Number(b1.totalDespesas) || 0 : 0;
      const desp2 = b2 ? Number(b2.totalDespesas) || 0 : 0;

      return {
        day: `Dia ${i + 1}`,
        [`Receita (${compP1Label})`]: rec1,
        [`Receita (${compP2Label})`]: rec2,
        [`Lucro (${compP1Label})`]: rec1 - desp1,
        [`Lucro (${compP2Label})`]: rec2 - desp2,
      };
    });
  }, [metricsP1, metricsP2, compP1Label, compP2Label]);

  // Helper for computing delta variances
  const calcDelta = (v1: number, v2: number) => {
    const diff = v1 - v2;
    const pct = v2 !== 0 ? (diff / Math.abs(v2)) * 100 : (v1 !== 0 ? 100 : 0);
    return { diff, pct };
  };

  // Handle Preset Change
  const handlePeriodChange = (option: PeriodOption) => {
    setSelectedPeriod(option);
    if (option !== "custom") {
      const { start, end } = getPresetDates(option);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Toggle Section Tree
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter daily balances for the selected period
  const filteredBalances = useMemo(() => {
    return (appState.dailyBalances || []).filter((b) => {
      const d = (b.data || "").substring(0, 10);
      return d >= startDate && d <= endDate;
    }).sort((a, b) => a.data.localeCompare(b.data));
  }, [appState.dailyBalances, startDate, endDate]);

  // Consolidate Financial Metrics
  const metrics = useMemo(() => {
    let totalCombustivel = 0;
    let totalLubrificantes = 0;
    let totalOutras = 0;
    let totalDespesas = 0;

    let totalDinheiro = 0;
    let totalCartaoCredito = 0;
    let totalCartaoDebito = 0;
    let totalPix = 0;
    let totalPrazo = 0;

    filteredBalances.forEach((b) => {
      totalCombustivel += Number(b.vendaCombustivel) || 0;
      totalLubrificantes += Number(b.vendaLubrificantes) || 0;
      totalOutras += Number(b.outrasReceitas) || 0;
      totalDespesas += Number(b.totalDespesas) || 0;

      if (b.metodosPagamento) {
        totalDinheiro += Number(b.metodosPagamento.dinheiro) || 0;
        totalCartaoCredito += Number(b.metodosPagamento.cartaoCredito) || 0;
        totalCartaoDebito += Number(b.metodosPagamento.cartaoDebito) || 0;
        totalPix += Number(b.metodosPagamento.pix) || 0;
        totalPrazo += Number(b.metodosPagamento.prazo) || 0;
      }
    });

    const receitaBrutaTotal = totalCombustivel + totalLubrificantes + totalOutras;
    const lucroLiquido = receitaBrutaTotal - totalDespesas;
    const margemLiquida = receitaBrutaTotal > 0 ? (lucroLiquido / receitaBrutaTotal) * 100 : 0;

    const daysCount = filteredBalances.length || 1;
    const mediaFaturamentoDiario = receitaBrutaTotal / daysCount;
    const mediaLucroDiario = lucroLiquido / daysCount;

    // Highest Revenue Day
    let bestDay = { data: "-", valor: 0 };
    filteredBalances.forEach((b) => {
      const totalDay = (Number(b.vendaCombustivel) || 0) + (Number(b.vendaLubrificantes) || 0) + (Number(b.outrasReceitas) || 0);
      if (totalDay > bestDay.valor) {
        bestDay = { data: b.data, valor: totalDay };
      }
    });

    return {
      totalCombustivel,
      totalLubrificantes,
      totalOutras,
      receitaBrutaTotal,
      totalDespesas,
      lucroLiquido,
      margemLiquida,
      totalDinheiro,
      totalCartaoCredito,
      totalCartaoDebito,
      totalPix,
      totalPrazo,
      daysCount: filteredBalances.length,
      mediaFaturamentoDiario,
      mediaLucroDiario,
      bestDay
    };
  }, [filteredBalances]);

  // Export handlers
  const handleExportPDF = () => {
    exportReportPDF({
      appState,
      reportType: "dre",
      startDate,
      endDate
    });
  };

  const handleExportCSV = () => {
    exportReportCSV({
      appState,
      reportType: "dre",
      startDate,
      endDate
    });
  };

  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";
    const clean = dateStr.substring(0, 10);
    const parts = clean.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-indigo-400" />
                Demonstrativo de Resultado do Exercício
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold rounded-full border border-emerald-500/30">
                Consolidação Mensal & 30 Dias
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              DRE Mensal & Saúde Financeira
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Análise operacional detalhada do posto com apuração rápida de faturamento por combustível, lubrificantes, receitas extras, métodos de pagamento e despesas operacionais.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              onClick={() => {
                setPreviewModal({
                  isOpen: true,
                  reportType: "dre",
                  title: "DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE MENSAL)",
                  subtitle: `Período selecionado: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
                  onExportPDF: handleExportPDF,
                  onExportCSV: handleExportCSV,
                });
              }}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Eye className="h-4 w-4 text-indigo-400" />
              Preview DRE
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Exportar CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer border border-emerald-500"
            >
              <FileDown className="h-4 w-4" />
              Baixar PDF Oficial
            </button>
          </div>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Período de Análise DRE:</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handlePeriodChange("30days")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPeriod === "30days"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Últimos 30 Dias
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("currentMonth")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPeriod === "currentMonth"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Mês Atual
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("lastMonth")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPeriod === "lastMonth"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Mês Anterior
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("60days")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPeriod === "60days"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              60 Dias
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("90days")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPeriod === "90days"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              90 Dias
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("custom")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedPeriod === "custom"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>

        {/* Date Inputs if Custom Selected or Display Selected Span */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              Intervalo ativo: <strong className="text-slate-900">{formatDateBR(startDate)}</strong> até <strong className="text-slate-900">{formatDateBR(endDate)}</strong>
            </span>
            <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md text-[11px] border border-indigo-100">
              {metrics.daysCount} {metrics.daysCount === 1 ? "dia com registro" : "dias registrados"}
            </span>
          </div>

          {selectedPeriod === "custom" && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-xs text-slate-400">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Receita Bruta */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2 hover:border-emerald-300 transition">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Receita Bruta Total</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatBRL(metrics.receitaBrutaTotal)}
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-100 pt-2">
            <span>Combustíveis:</span>
            <strong className="text-slate-800">{formatBRL(metrics.totalCombustivel)}</strong>
          </div>
        </div>

        {/* Card 2: Total Despesas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2 hover:border-rose-300 transition">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Despesas Operacionais</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {formatBRL(metrics.totalDespesas)}
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-100 pt-2">
            <span>Comprometimento:</span>
            <strong className="text-rose-700">
              {metrics.receitaBrutaTotal > 0 ? ((metrics.totalDespesas / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}% da Receita
            </strong>
          </div>
        </div>

        {/* Card 3: Lucro Líquido / Prejuízo */}
        <div className={`border rounded-2xl p-5 shadow-sm space-y-2 transition ${
          metrics.lucroLiquido >= 0
            ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-300"
            : "bg-rose-50/50 border-rose-200 hover:border-rose-300"
        }`}>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Resultado Operacional (DRE)</span>
            <div className={`p-2 rounded-xl font-black text-xs ${
              metrics.lucroLiquido >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}>
              {metrics.lucroLiquido >= 0 ? "LUCRO" : "PREJUÍZO"}
            </div>
          </div>
          <div className={`text-2xl font-black ${metrics.lucroLiquido >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {formatBRL(metrics.lucroLiquido)}
          </div>
          <div className="text-[11px] text-slate-600 flex justify-between items-center border-t border-slate-200/60 pt-2">
            <span>Margem Líquida:</span>
            <strong className={metrics.lucroLiquido >= 0 ? "text-emerald-800 font-bold" : "text-rose-800 font-bold"}>
              {metrics.margemLiquida.toFixed(1)}%
            </strong>
          </div>
        </div>

        {/* Card 4: Média Diária */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2 hover:border-indigo-300 transition">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Média Diária de Venda</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatBRL(metrics.mediaFaturamentoDiario)}
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-100 pt-2">
            <span>Lucro Médio/Dia:</span>
            <strong className={metrics.mediaLucroDiario >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {formatBRL(metrics.mediaLucroDiario)}
            </strong>
          </div>
        </div>
      </div>

      {/* Comparative Performance Section (Recharts) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-100 flex items-center gap-1">
                <ArrowLeftRight className="h-3 w-3" />
                Análise Comparativa Recharts
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Comparativo de Performance Financeira
            </h2>
            <p className="text-slate-500 text-xs">
              Compare 2 períodos distintos (ex: Mês Atual vs Mês Anterior) para analisar variações de receita, despesas e margem líquida.
            </p>
          </div>

          {/* Controls: Preset Selector & Chart Type Toggle */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleCompPresetChange("currentVsLastMonth")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  compPreset === "currentVsLastMonth"
                    ? "bg-white text-slate-900 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mês Atual vs Mês Anterior
              </button>
              <button
                type="button"
                onClick={() => handleCompPresetChange("last30VsPrev30")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  compPreset === "last30VsPrev30"
                    ? "bg-white text-slate-900 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Últimos 30d vs 30d Anteriores
              </button>
              <button
                type="button"
                onClick={() => handleCompPresetChange("custom")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  compPreset === "custom"
                    ? "bg-white text-slate-900 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Personalizado
              </button>
            </div>

            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCompChartType("bar")}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  compChartType === "bar"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Gráfico de Barras"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Barras</span>
              </button>
              <button
                type="button"
                onClick={() => setCompChartType("line")}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  compChartType === "line"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Evolução Diária"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Evolução</span>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Period Input Controls */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Period 1 Controls */}
          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                Período 1 (Referência)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {metricsP1.daysCount} registros
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Rótulo</label>
                <input
                  type="text"
                  value={compP1Label}
                  onChange={(e) => setCompP1Label(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Início</label>
                <input
                  type="date"
                  value={compP1Start}
                  onChange={(e) => {
                    setCompP1Start(e.target.value);
                    setCompPreset("custom");
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Fim</label>
                <input
                  type="date"
                  value={compP1End}
                  onChange={(e) => {
                    setCompP1End(e.target.value);
                    setCompPreset("custom");
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Period 2 Controls */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Período 2 (Comparativo)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {metricsP2.daysCount} registros
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Rótulo</label>
                <input
                  type="text"
                  value={compP2Label}
                  onChange={(e) => setCompP2Label(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Início</label>
                <input
                  type="date"
                  value={compP2Start}
                  onChange={(e) => {
                    setCompP2Start(e.target.value);
                    setCompPreset("custom");
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Fim</label>
                <input
                  type="date"
                  value={compP2End}
                  onChange={(e) => {
                    setCompP2End(e.target.value);
                    setCompPreset("custom");
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Variance KPI Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Receita Bruta Comparison */}
          {(() => {
            const d = calcDelta(metricsP1.receitaBrutaTotal, metricsP2.receitaBrutaTotal);
            const isPos = d.diff >= 0;
            return (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                  <span>VARIÂNCIA DA RECEITA</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                    isPos ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPos ? "+" : ""}{d.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-black text-slate-900">{formatBRL(metricsP1.receitaBrutaTotal)}</span>
                  <span className="text-xs font-semibold text-slate-500">vs {formatBRL(metricsP2.receitaBrutaTotal)}</span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                  <span>Diferença bruta:</span>
                  <strong className={isPos ? "text-emerald-700" : "text-rose-600"}>
                    {isPos ? "+" : ""}{formatBRL(d.diff)}
                  </strong>
                </div>
              </div>
            );
          })()}

          {/* Despesas Operacionais Comparison */}
          {(() => {
            const d = calcDelta(metricsP1.totalDespesas, metricsP2.totalDespesas);
            const isReduced = d.diff <= 0; // Reducing expense is positive
            return (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                  <span>VARIÂNCIA DAS DESPESAS</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                    isReduced ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {d.diff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {d.diff > 0 ? "+" : ""}{d.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-black text-slate-900">{formatBRL(metricsP1.totalDespesas)}</span>
                  <span className="text-xs font-semibold text-slate-500">vs {formatBRL(metricsP2.totalDespesas)}</span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                  <span>Diferença bruta:</span>
                  <strong className={isReduced ? "text-emerald-700" : "text-rose-600"}>
                    {d.diff > 0 ? "+" : ""}{formatBRL(d.diff)}
                  </strong>
                </div>
              </div>
            );
          })()}

          {/* Lucro Líquido Comparison */}
          {(() => {
            const d = calcDelta(metricsP1.lucroLiquido, metricsP2.lucroLiquido);
            const isPos = d.diff >= 0;
            return (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                  <span>VARIÂNCIA DO LUCRO LÍQUIDO</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-0.5 ${
                    isPos ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}>
                    {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPos ? "+" : ""}{d.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className={`text-sm font-black ${metricsP1.lucroLiquido >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                    {formatBRL(metricsP1.lucroLiquido)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">vs {formatBRL(metricsP2.lucroLiquido)}</span>
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                  <span>Diferença no lucro:</span>
                  <strong className={isPos ? "text-emerald-700" : "text-rose-600"}>
                    {isPos ? "+" : ""}{formatBRL(d.diff)}
                  </strong>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Recharts Render Area */}
        <div className="pt-2">
          <div className="h-72 w-full bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
            {compChartType === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#475569" }} axisLine={{ stroke: "#cbd5e1" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatBRL(Number(value) || 0), ""]}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "1px solid #334155", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey={compP1Label} fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey={compP2Label} fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyEvolutionChartData} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#475569" }} axisLine={{ stroke: "#cbd5e1" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatBRL(Number(value) || 0), ""]}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "1px solid #334155", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Line type="monotone" dataKey={`Receita (${compP1Label})`} stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey={`Receita (${compP2Label})`} stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey={`Lucro (${compP1Label})`} stroke="#6366f1" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey={`Lucro (${compP2Label})`} stroke="#34d399" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Main DRE Statement Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-slate-900 text-white p-4 md:px-6 md:py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold tracking-tight">Demonstrativo Estruturado de Resultado (DRE)</h2>
              <p className="text-slate-400 text-xs">Visão contábil do período de {formatDateBR(startDate)} a {formatDateBR(endDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToBalanco && (
              <button
                onClick={onNavigateToBalanco}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Lançar Balanço Diário
              </button>
            )}
          </div>
        </div>

        {/* Tree Structure Table */}
        <div className="divide-y divide-slate-200 text-xs text-slate-800">
          {/* Section 1: Receita Bruta */}
          <div className="bg-slate-50/80">
            <button
              type="button"
              onClick={() => toggleSection("receitas")}
              className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-100/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {expandedSections.receitas ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span className="font-extrabold text-slate-900 uppercase tracking-wide">
                  1. RECEITA OPERACIONAL BRUTA
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-emerald-700 font-extrabold text-sm">
                  {formatBRL(metrics.receitaBrutaTotal)}
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  100,0%
                </span>
              </div>
            </button>

            {expandedSections.receitas && (
              <div className="pl-8 pr-4 pb-3 space-y-1 bg-white border-t border-slate-100">
                {/* 1.1 Combustíveis */}
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>1.1 Venda de Combustíveis (Gasolina, Etanol e Diesel)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900 font-bold">{formatBRL(metrics.totalCombustivel)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalCombustivel / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                {/* 1.2 Lubrificantes */}
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>1.2 Venda de Lubrificantes, Óleos & Filtros</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900 font-bold">{formatBRL(metrics.totalLubrificantes)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalLubrificantes / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                {/* 1.3 Outras Receitas */}
                <div className="flex justify-between items-center py-2 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>1.3 Outras Receitas (Conveniência, Pista e Serviços)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900 font-bold">{formatBRL(metrics.totalOutras)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalOutras / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Formas de Pagamento / Meio de Captura */}
          <div className="bg-slate-50/80">
            <button
              type="button"
              onClick={() => toggleSection("pagamentos")}
              className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-100/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {expandedSections.pagamentos ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span className="font-extrabold text-slate-900 uppercase tracking-wide">
                  2. DETALHAMENTO POR FORMA DE PAGAMENTO (CAPTURA)
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-700 font-bold text-xs">
                  5 Modalidades
                </span>
              </div>
            </button>

            {expandedSections.pagamentos && (
              <div className="pl-8 pr-4 pb-3 space-y-1 bg-white border-t border-slate-100">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Dinheiro em Espécie</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900">{formatBRL(metrics.totalDinheiro)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalDinheiro / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-teal-600" />
                    <span>PIX / Pagamento Instantâneo</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900">{formatBRL(metrics.totalPix)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalPix / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Cartão de Crédito</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900">{formatBRL(metrics.totalCartaoCredito)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalCartaoCredito / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-sky-600" />
                    <span>Cartão de Débito</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900">{formatBRL(metrics.totalCartaoDebito)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalCartaoDebito / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 text-slate-700">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-amber-600" />
                    <span>Vendas a Prazo / Faturado</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-slate-900">{formatBRL(metrics.totalPrazo)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalPrazo / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Despesas Operacionais */}
          <div className="bg-slate-50/80">
            <button
              type="button"
              onClick={() => toggleSection("despesas")}
              className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-100/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {expandedSections.despesas ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
                <span className="font-extrabold text-slate-900 uppercase tracking-wide">
                  3. DESPESAS E CUSTOS OPERACIONAIS
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-rose-700 font-extrabold text-sm">
                  (-) {formatBRL(metrics.totalDespesas)}
                </span>
                <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  {metrics.receitaBrutaTotal > 0 ? ((metrics.totalDespesas / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </button>

            {expandedSections.despesas && (
              <div className="pl-8 pr-4 pb-3 space-y-1 bg-white border-t border-slate-100">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Despesas Totais Lançadas nos Balanços Diários</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <strong className="text-rose-600 font-bold">{formatBRL(metrics.totalDespesas)}</strong>
                    <span className="text-slate-500 w-12 text-right">
                      {metrics.receitaBrutaTotal > 0 ? ((metrics.totalDespesas / metrics.receitaBrutaTotal) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 flex justify-between items-center">
                  <span>Média de despesa por fechamento diário:</span>
                  <strong className="text-slate-800">{formatBRL(metrics.totalDespesas / (metrics.daysCount || 1))} / dia</strong>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Final Net Profit / Loss Result */}
          <div className={`p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            metrics.lucroLiquido >= 0 ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl">
                {metrics.lucroLiquido >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-white" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80 block">
                  RESULTADO OPERACIONAL LÍQUIDO DO PERÍODO
                </span>
                <h3 className="text-xl font-black text-white leading-tight">
                  {metrics.lucroLiquido >= 0 ? "LUCRO LÍQUIDO APURADO" : "PREJUÍZO APURADO NA OPERAÇÃO"}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-white/20 pt-3 sm:pt-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-white/80 block">Lucro/Prejuízo Total</span>
                <span className="text-2xl font-black tracking-tight">{formatBRL(metrics.lucroLiquido)}</span>
              </div>
              <div className="pl-4 border-l border-white/20">
                <span className="text-[10px] uppercase font-bold text-white/80 block">Margem Líquida</span>
                <span className="text-2xl font-black tracking-tight">{metrics.margemLiquida.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Evolution Chart / Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              Evolução Diária do Balanço (Últimos {metrics.daysCount} Dias Registrados)
            </h3>
            <p className="text-slate-500 text-xs">Acompanhamento diário de Receitas, Despesas e Saldo do Período</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Receita
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Despesa
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              Lucro
            </span>
          </div>
        </div>

        {/* Visual Daily Bars */}
        {filteredBalances.length > 0 ? (
          <div className="space-y-2 pt-2">
            {filteredBalances.map((b) => {
              const rec = (Number(b.vendaCombustivel) || 0) + (Number(b.vendaLubrificantes) || 0) + (Number(b.outrasReceitas) || 0);
              const desp = Number(b.totalDespesas) || 0;
              const lucro = rec - desp;
              const maxVal = Math.max(...filteredBalances.map(x => (Number(x.vendaCombustivel)||0) + (Number(x.vendaLubrificantes)||0) + (Number(x.outrasReceitas)||0))) || 1;
              const barWidth = Math.min(100, Math.max(8, (rec / maxVal) * 100));

              return (
                <div key={b.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {formatDateBR(b.data)}
                      <span className="text-[10px] font-normal text-slate-500">({b.fechadoPor || "Mariana Costa"})</span>
                    </span>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-600 font-medium">Rec: <strong className="text-slate-900">{formatBRL(rec)}</strong></span>
                      <span className="text-slate-600 font-medium">Desp: <strong className="text-rose-600">{formatBRL(desp)}</strong></span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        Lucro: {formatBRL(lucro)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar visual */}
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                      title={`Receita: ${formatBRL(rec)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Nenhum balanço diário registrado no período selecionado</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Selecione outro período de 30 dias nos filtros acima ou lance fechamentos diários na aba Balanço Diário para alimentar a DRE.
            </p>
            {onNavigateToBalanco && (
              <button
                onClick={onNavigateToBalanco}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm inline-flex items-center gap-1.5"
              >
                <PlusCircle className="h-4 w-4" />
                Ir para Balanço Diário
              </button>
            )}
          </div>
        )}
      </div>

      {/* DRE Report Modal Preview */}
      {previewModal.isOpen && (
        <ReportPreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal((prev) => ({ ...prev, isOpen: false }))}
          reportType={previewModal.reportType}
          title={previewModal.title}
          subtitle={previewModal.subtitle}
          appState={appState}
          onExportPDF={previewModal.onExportPDF}
          onExportCSV={previewModal.onExportCSV}
        />
      )}
    </div>
  );
}
