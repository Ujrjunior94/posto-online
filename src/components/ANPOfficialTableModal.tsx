/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  X,
  Table,
  FileDown,
  Search,
  Filter,
  Calculator,
  CheckCircle2,
  XCircle,
  Info,
  Sparkles,
  GitCompare,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { FuelType } from "../types";
import { FUEL_TYPES } from "./TanksManagement";
import { checkFuelCompliance } from "./ANPQualityControl";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ANPOfficialTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFuel?: FuelType;
}

export default function ANPOfficialTableModal({
  isOpen,
  onClose,
  initialFuel = "Gasolina Comum",
}: ANPOfficialTableModalProps) {
  const [activeTab, setActiveTab] = useState<"especificacoes" | "matriz" | "cruzamento">(
    "especificacoes"
  );

  const [densitySearchTerm, setDensitySearchTerm] = useState("");
  const [densityCategoryFilter, setDensityCategoryFilter] = useState<
    "Todos" | "Gasolinas" | "Etanol" | "Diesel" | "Outros"
  >("Todos");

  // Calculator State (Tab 1 & Quick Calc)
  const [calcFuel, setCalcFuel] = useState<FuelType>(initialFuel);
  const [calcMeas, setCalcMeas] = useState<number>(
    initialFuel === "Etanol" ? 0.809 : initialFuel.includes("Diesel") ? 0.835 : 0.742
  );
  const [calcTemp, setCalcTemp] = useState<number>(25.0);

  // Matrix State (Tab 2)
  const [matrixFuel, setMatrixFuel] = useState<FuelType>(initialFuel);
  const [matrixBaseDensity, setMatrixBaseDensity] = useState<number>(0.7400);

  // Triple Cross Check State (Tab 3)
  const [crossFuel, setCrossFuel] = useState<FuelType>(initialFuel);

  // Amostra 1: Nota Fiscal / Distribuidora
  const [nfDensity, setNfDensity] = useState<number>(0.7420);
  const [nfTemp, setNfTemp] = useState<number>(20.0);

  // Amostra 2: Tanque do Posto (Antes da Carga)
  const [tankDensity, setTankDensity] = useState<number>(0.7410);
  const [tankTemp, setTankTemp] = useState<number>(24.5);

  // Amostra 3: Proveta do Caminhão (Descarga)
  const [truckDensity, setTruckDensity] = useState<number>(0.7430);
  const [truckTemp, setTruckTemp] = useState<number>(26.0);
  const [truckEthanolPercent, setTruckEthanolPercent] = useState<number>(27.0);

  if (!isOpen) return null;

  // Compute D20 for Matrix Table
  const getFactor = (fuel: FuelType) => {
    if (fuel === "Etanol" || (fuel as string) === "Etanol Aditivado") return 0.00084;
    if (fuel.includes("Gasolina")) return 0.00072;
    return 0.00068; // Diesel and others
  };

  const calculateD20 = (fuel: FuelType, densityObs: number, tempObs: number) => {
    const f = getFactor(fuel);
    return densityObs + f * (tempObs - 20);
  };

  // Cross check compliance calculations
  const nfComp = checkFuelCompliance(crossFuel, nfDensity, nfTemp, 27, "Límpido e Isento", false);
  const tankComp = checkFuelCompliance(crossFuel, tankDensity, tankTemp, 27, "Límpido e Isento", false);
  const truckComp = checkFuelCompliance(
    crossFuel,
    truckDensity,
    truckTemp,
    truckEthanolPercent,
    "Límpido e Isento",
    false
  );

  // ANP allowed maximum delta between delivery/invoice and tank sample is typically 0.0030 g/cm³ (3.0 kg/m³)
  const deltaNfTruck = Math.abs(nfComp.densidadeCorrigida - truckComp.densidadeCorrigida);
  const deltaTankTruck = Math.abs(tankComp.densidadeCorrigida - truckComp.densidadeCorrigida);
  const maxAllowedDelta = 0.0030;

  const deltaNfTruckOk = deltaNfTruck <= maxAllowedDelta;
  const deltaTankTruckOk = deltaTankTruck <= maxAllowedDelta;

  const allCrossOk =
    nfComp.conforme &&
    tankComp.conforme &&
    truckComp.conforme &&
    deltaNfTruckOk &&
    deltaTankTruckOk;

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RELATÓRIO OFICIAL DE CRUZAMENTO E REGULARIDADE ANP (2026)", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Agência Nacional do Petróleo, Gás Natural e Biocombustíveis • Emissão: ${new Date().toLocaleDateString("pt-BR")} - ${new Date().toLocaleTimeString("pt-BR")}`,
      14,
      24
    );

    if (activeTab === "cruzamento") {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Combustível Analisado: ${crossFuel}`, 14, 32);

      const crossRows = [
        [
          "Amostra Nota Fiscal (NF)",
          `${nfDensity.toFixed(4)} g/cm³`,
          `${nfTemp.toFixed(1)} °C`,
          `${nfComp.densidadeCorrigida.toFixed(4)} g/cm³ (${(nfComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)`,
          nfComp.conforme ? "CONFORME ANP" : "REPROVADO",
        ],
        [
          "Amostra Tanque do Posto",
          `${tankDensity.toFixed(4)} g/cm³`,
          `${tankTemp.toFixed(1)} °C`,
          `${tankComp.densidadeCorrigida.toFixed(4)} g/cm³ (${(tankComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)`,
          tankComp.conforme ? "CONFORME ANP" : "REPROVADO",
        ],
        [
          "Amostra Proveta Caminhão",
          `${truckDensity.toFixed(4)} g/cm³`,
          `${truckTemp.toFixed(1)} °C`,
          `${truckComp.densidadeCorrigida.toFixed(4)} g/cm³ (${(truckComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)`,
          truckComp.conforme ? "CONFORME ANP" : "REPROVADO",
        ],
      ];

      autoTable(doc, {
        startY: 36,
        head: [["Origem da Amostra", "Densid. Medida", "Temp.", "Densid. Corrigida (D20)", "Status Limites"]],
        body: crossRows,
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RESULTADO DO CRUZAMENTO DE DADOS:", 14, finalY);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`- Variação NF vs Proveta: ${(deltaNfTruck * 1000).toFixed(1)} kg/m³ (${deltaNfTruckOk ? "Aprovado <= 3,0 kg/m³" : "Fora da Tolerância"})`, 14, finalY + 6);
      doc.text(`- Variação Tanque vs Proveta: ${(deltaTankTruck * 1000).toFixed(1)} kg/m³ (${deltaTankTruckOk ? "Aprovado <= 3,0 kg/m³" : "Fora da Tolerância"})`, 14, finalY + 12);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      if (allCrossOk) {
        doc.setTextColor(16, 185, 129);
        doc.text("PARECER FINAL: LOTE APROVADO E CONFORME NORMA ANP 2026", 14, finalY + 22);
      } else {
        doc.setTextColor(225, 29, 72);
        doc.text("PARECER FINAL: LOTE REPROVADO - BLOQUEAR DESCARGA E NOTIFICAR ANP", 14, finalY + 22);
      }
    } else {
      const tableRows = [
        ["Gasolina C Comum", "Res. ANP 807/2020 & Lei 14.993/2024", "0,7150 - 0,7750 g/cm³", "715,0 - 775,0 kg/m³", "Etanol: 26,0% a 30,0% v/v", "50 mg/kg", "Conforme 2026"],
        ["Gasolina C Aditivada", "Res. ANP 807/2020 & Lei 14.993/2024", "0,7150 - 0,7750 g/cm³", "715,0 - 775,0 kg/m³", "Etanol: 26,0% a 30,0% v/v + Deterg.", "50 mg/kg", "Conforme 2026"],
        ["Gasolina Premium", "Res. ANP 807/2020 & Lei 14.993/2024", "0,7700 - 0,8000 g/cm³", "770,0 - 800,0 kg/m³", "Etanol: 25,0% a 30,0% v/v (98 RON)", "50 mg/kg", "Conforme 2026"],
        ["Etanol Hidratado Comum", "Res. ANP 907/2022", "0,8076 - 0,8110 g/cm³", "807,6 - 811,0 kg/m³", "Teor 92,5% - 93,8% °INPM", "Isento", "Conforme 2026"],
        ["Etanol Hidratado Aditivado", "Res. ANP 907/2022", "0,8076 - 0,8110 g/cm³", "807,6 - 811,0 kg/m³", "Teor 92,5% - 93,8% °INPM + Adit.", "Isento", "Conforme 2026"],
        ["Óleo Diesel S10 Comum", "Res. ANP 968/2024", "0,8200 - 0,8500 g/cm³", "820,0 - 850,0 kg/m³", "Biodiesel B15 (14%-15%)", "10 mg/kg", "Conforme 2026"],
        ["Óleo Diesel S10 Aditivado", "Res. ANP 968/2024", "0,8200 - 0,8500 g/cm³", "820,0 - 850,0 kg/m³", "Biodiesel B15 + Aditivo", "10 mg/kg", "Conforme 2026"],
        ["Óleo Diesel S500", "Res. ANP 968/2024", "0,8200 - 0,8650 g/cm³", "820,0 - 865,0 kg/m³", "Biodiesel B15 (Agro/Frota)", "500 mg/kg", "Conforme 2026"],
        ["Querosene de Aviação (QAV-1)", "Res. ANP 856/2021", "0,7750 - 0,8400 g/cm³", "775,0 - 840,0 kg/m³", "Aviação Comercial / Executiva", "3.000 mg/kg", "Vigente"],
        ["Óleo Diesel Marinho (DMA)", "Res. ANP 968/2024", "0,8200 - 0,8900 g/cm³", "820,0 - 890,0 kg/m³", "Uso Náutico e Marítimo", "1.000 mg/kg", "Vigente"]
      ];

      autoTable(doc, {
        startY: 28,
        head: [["Produto ANP", "Norma ANP", "Faixa D20 (g/cm³)", "Faixa D20 (kg/m³)", "Requisitos / Mistura", "Enxofre Máx.", "Status"]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    }

    doc.save("Tabela_Oficial_Cruzamento_ANP_2026.pdf");
  };

  const tableData = [
    {
      id: "gasolina_comum",
      nome: "Gasolina C Comum",
      categoria: "Gasolinas",
      resolucaoANP: "Res. ANP 807/2020 & Lei 14.993/2024",
      d20MinGcm3: "0,7150",
      d20MaxGcm3: "0,7750",
      d20MinKgm3: "715,0",
      d20MaxKgm3: "775,0",
      misturaAdicional: "Etanol Anidro: 26,0% a 30,0% v/v (E27/E30)",
      octanagemOuFulgor: "Mín. 93,0 RON",
      enxofreMax: "50 mg/kg (S50)",
      status2026: "Conforme 2026",
      badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      id: "gasolina_aditivada",
      nome: "Gasolina C Aditivada",
      categoria: "Gasolinas",
      resolucaoANP: "Res. ANP 807/2020 & Lei 14.993/2024",
      d20MinGcm3: "0,7150",
      d20MaxGcm3: "0,7750",
      d20MinKgm3: "715,0",
      d20MaxKgm3: "775,0",
      misturaAdicional: "Etanol Anidro: 26,0% a 30,0% v/v + Detergente",
      octanagemOuFulgor: "Mín. 93,0 RON",
      enxofreMax: "50 mg/kg (S50)",
      status2026: "Conforme 2026",
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
    },
    {
      id: "gasolina_premium",
      nome: "Gasolina Premium / Podium",
      categoria: "Gasolinas",
      resolucaoANP: "Res. ANP 807/2020 & Lei 14.993/2024",
      d20MinGcm3: "0,7700",
      d20MaxGcm3: "0,8000",
      d20MinKgm3: "770,0",
      d20MaxKgm3: "800,0",
      misturaAdicional: "Etanol Anidro: 25,0% a 30,0% v/v",
      octanagemOuFulgor: "Mín. 98,0 RON (Alta Octanagem)",
      enxofreMax: "50 mg/kg (S50)",
      status2026: "Conforme 2026",
      badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    },
    {
      id: "etanol_hidratado_comum",
      nome: "Etanol Hidratado Comum (EHC)",
      categoria: "Etanol",
      resolucaoANP: "Res. ANP 907/2022",
      d20MinGcm3: "0,8076",
      d20MaxGcm3: "0,8110",
      d20MinKgm3: "807,6",
      d20MaxKgm3: "811,0",
      misturaAdicional: "Teor Alcoólico: 92,5% a 93,8% °INPM (% M/M)",
      octanagemOuFulgor: "Condutividade: Máx. 500 µS/m",
      enxofreMax: "Isento",
      status2026: "Conforme 2026",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      id: "etanol_hidratado_aditivado",
      nome: "Etanol Hidratado Aditivado (EHA)",
      categoria: "Etanol",
      resolucaoANP: "Res. ANP 907/2022",
      d20MinGcm3: "0,8076",
      d20MaxGcm3: "0,8110",
      d20MinKgm3: "807,6",
      d20MaxKgm3: "811,0",
      misturaAdicional: "Teor Alcoólico: 92,5% a 93,8% °INPM + Aditivo",
      octanagemOuFulgor: "Condutividade: Máx. 500 µS/m",
      enxofreMax: "Isento",
      status2026: "Conforme 2026",
      badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
    },
    {
      id: "diesel_s10_comum",
      nome: "Óleo Diesel S10 Comum",
      categoria: "Diesel",
      resolucaoANP: "Res. ANP 968/2024 (B15)",
      d20MinGcm3: "0,8200",
      d20MaxGcm3: "0,8500",
      d20MinKgm3: "820,0",
      d20MaxKgm3: "850,0",
      misturaAdicional: "Biodiesel (B15): 14,0% a 15,0% v/v",
      octanagemOuFulgor: "Ponto de Fulgor: Mín. 38,0 °C",
      enxofreMax: "10 mg/kg (S10)",
      status2026: "Conforme 2026",
      badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
    },
    {
      id: "diesel_s10_aditivado",
      nome: "Óleo Diesel S10 Aditivado",
      categoria: "Diesel",
      resolucaoANP: "Res. ANP 968/2024 (B15)",
      d20MinGcm3: "0,8200",
      d20MaxGcm3: "0,8500",
      d20MinKgm3: "820,0",
      d20MaxKgm3: "850,0",
      misturaAdicional: "Biodiesel (B15): 14,0% a 15,0% v/v + Aditivo",
      octanagemOuFulgor: "Ponto de Fulgor: Mín. 38,0 °C",
      enxofreMax: "10 mg/kg (S10)",
      status2026: "Conforme 2026",
      badgeColor: "bg-slate-200 text-slate-900 border-slate-400",
    },
    {
      id: "diesel_s500",
      nome: "Óleo Diesel S500 Comum",
      categoria: "Diesel",
      resolucaoANP: "Res. ANP 968/2024 (B15)",
      d20MinGcm3: "0,8200",
      d20MaxGcm3: "0,8650",
      d20MinKgm3: "820,0",
      d20MaxKgm3: "865,0",
      misturaAdicional: "Biodiesel (B15): 14,0% a 15,0% v/v",
      octanagemOuFulgor: "Ponto de Fulgor: Mín. 38,0 °C",
      enxofreMax: "500 mg/kg (S500)",
      status2026: "Conforme 2026",
      badgeColor: "bg-rose-50 text-rose-800 border-rose-200",
    },
    {
      id: "querosene_aviacao_qav",
      nome: "Querosene de Aviação (QAV-1)",
      categoria: "Outros",
      resolucaoANP: "Res. ANP 856/2021",
      d20MinGcm3: "0,7750",
      d20MaxGcm3: "0,8400",
      d20MinKgm3: "775,0",
      d20MaxKgm3: "840,0",
      misturaAdicional: "Combustível Puro de Aviação",
      octanagemOuFulgor: "Ponto de Fulgor: Mín. 38,0 °C",
      enxofreMax: "3.000 mg/kg",
      status2026: "Vigente",
      badgeColor: "bg-sky-50 text-sky-800 border-sky-200",
    },
    {
      id: "diesel_marinho",
      nome: "Óleo Diesel Marinho (DMA)",
      categoria: "Outros",
      resolucaoANP: "Res. ANP 968/2024",
      d20MinGcm3: "0,8200",
      d20MaxGcm3: "0,8900",
      d20MinKgm3: "820,0",
      d20MaxKgm3: "890,0",
      misturaAdicional: "Uso Náutico e Marítimo",
      octanagemOuFulgor: "Ponto de Fulgor: Mín. 60,0 °C",
      enxofreMax: "1.000 mg/kg",
      status2026: "Vigente",
      badgeColor: "bg-cyan-50 text-cyan-800 border-cyan-200",
    },
  ];

  const filteredData = tableData.filter((item) => {
    if (densityCategoryFilter !== "Todos" && item.categoria !== densityCategoryFilter) {
      return false;
    }
    if (densitySearchTerm.trim()) {
      const term = densitySearchTerm.toLowerCase();
      return (
        item.nome.toLowerCase().includes(term) ||
        item.resolucaoANP.toLowerCase().includes(term) ||
        item.d20MinGcm3.includes(term) ||
        item.d20MaxGcm3.includes(term) ||
        item.d20MinKgm3.includes(term) ||
        item.d20MaxKgm3.includes(term) ||
        item.misturaAdicional.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const calcComp = checkFuelCompliance(calcFuel, calcMeas, calcTemp, 27, "Límpido e Isento", false);

  // Generate Matrix Temperature Grid (15°C to 35°C, 5 density step variations)
  const tempRange = [15, 18, 20, 22, 25, 28, 30, 32, 35];
  const densityDeltas = [-0.010, -0.005, 0, 0.005, 0.010];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div className="bg-slate-900 border border-indigo-500/30 w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-4 sm:p-5 border-b border-indigo-800/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/40 rounded-2xl text-indigo-300">
              <Table className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider rounded-full">
                  Vigência 2026 - ANP
                </span>
                <span className="text-[10px] text-indigo-300 font-mono hidden sm:inline">Lei nº 14.993/2024 & NBR 5992</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white font-display mt-0.5">
                Tabela Oficial Completa de Cruzamento & Verificação ANP
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={downloadPDF}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileDown className="h-4 w-4" />
              <span>Baixar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector Navigation Bar */}
        <div className="bg-slate-900 px-5 pt-3 pb-0 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("especificacoes")}
            className={`px-4 py-2.5 rounded-t-2xl text-xs font-bold transition flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === "especificacoes"
                ? "bg-slate-950 text-indigo-300 border-indigo-500/40 border-b-transparent shadow-sm"
                : "bg-slate-900/60 text-slate-400 border-transparent hover:text-white hover:bg-slate-800"
            }`}
          >
            <Table className="h-4 w-4 text-indigo-400" />
            <span>1. Especificações ANP 2026</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("matriz")}
            className={`px-4 py-2.5 rounded-t-2xl text-xs font-bold transition flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === "matriz"
                ? "bg-slate-950 text-indigo-300 border-indigo-500/40 border-b-transparent shadow-sm"
                : "bg-slate-900/60 text-slate-400 border-transparent hover:text-white hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <span>2. Matriz de Conversão D20 (ABNT)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cruzamento")}
            className={`px-4 py-2.5 rounded-t-2xl text-xs font-bold transition flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === "cruzamento"
                ? "bg-slate-950 text-rose-300 border-rose-500/40 border-b-transparent shadow-sm"
                : "bg-slate-900/60 text-slate-400 border-transparent hover:text-white hover:bg-slate-800"
            }`}
          >
            <GitCompare className="h-4 w-4 text-rose-400" />
            <span className="flex items-center gap-1.5">
              <span>3. Cruzamento de Dados (NF x Tanque x Proveta)</span>
              <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black rounded-md uppercase">
                Resultado Final
              </span>
            </span>
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 bg-slate-950 text-slate-100 flex-1">
          {/* TAB 1: ESPECIFICAÇÕES OFICIAIS ANP */}
          {activeTab === "especificacoes" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Quick Calculator Tool */}
              <div className="bg-slate-900/90 border border-indigo-500/20 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-200">
                      Simulador Rápido de Correção D20 (ABNT NBR 5992)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                    $D_&#123;20&#125; = D_t + f \times (t - 20)$
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Combustível</label>
                    <select
                      value={calcFuel}
                      onChange={(e) => {
                        const f = e.target.value as FuelType;
                        setCalcFuel(f);
                        if (f === "Etanol") setCalcMeas(0.809);
                        else if (f.includes("Gasolina")) setCalcMeas(f === "Gasolina Premium" ? 0.780 : 0.742);
                        else if (f.includes("Diesel")) setCalcMeas(0.835);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {FUEL_TYPES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Densidade Medida (g/cm³)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={calcMeas}
                      onChange={(e) => setCalcMeas(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Temperatura (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={calcTemp}
                      onChange={(e) => setCalcTemp(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      calcComp.conforme
                        ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                        : "bg-rose-950/60 border-rose-500/40 text-rose-200"
                    }`}
                  >
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">D20 Corrigida</span>
                      <span className="text-xs font-black font-mono">
                        {calcComp.densidadeCorrigida.toFixed(4).replace(".", ",")} g/cm³
                      </span>
                      <span className="text-[9px] block font-mono opacity-80">
                        ({(calcComp.densidadeCorrigida * 1000).toFixed(1).replace(".", ",")} kg/m³)
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                        calcComp.conforme
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-rose-600 text-white border-rose-500 animate-pulse"
                      }`}
                    >
                      {calcComp.conforme ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {calcComp.conforme ? "CONFORME" : "REPROVADO"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="h-3.5 w-3.5 text-indigo-400" /> Categoria:
                  </span>
                  {(["Todos", "Gasolinas", "Etanol", "Diesel", "Outros"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDensityCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        densityCategoryFilter === cat
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar combustível ou norma..."
                    value={densitySearchTerm}
                    onChange={(e) => setDensitySearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Specs Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-700">
                        <th className="p-3 pl-4">Produto ANP</th>
                        <th className="p-3">Norma ANP</th>
                        <th className="p-3 text-center bg-indigo-900/40 text-indigo-200 border-x border-indigo-800/40">
                          Massa Específica D20 (g/cm³)
                        </th>
                        <th className="p-3 text-center bg-slate-800 text-white">Massa Específica D20 (kg/m³)</th>
                        <th className="p-3">Mistura / Requisito</th>
                        <th className="p-3 text-center">Enxofre Máx.</th>
                        <th className="p-3 text-right pr-4">Status 2026</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredData.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 pl-4 font-bold text-white">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                              {item.nome}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">{item.resolucaoANP}</td>
                          <td className="p-3 text-center bg-indigo-950/30 border-x border-indigo-900/40 font-mono font-black text-indigo-300 text-xs">
                            {item.d20MinGcm3} a {item.d20MaxGcm3}
                          </td>
                          <td className="p-3 text-center bg-slate-900/80 font-mono font-bold text-white text-xs">
                            {item.d20MinKgm3} a {item.d20MaxKgm3}
                          </td>
                          <td className="p-3 text-[11px]">
                            <span className="font-semibold block text-slate-200">{item.misturaAdicional}</span>
                            <span className="text-[10px] text-slate-400 block">{item.octanagemOuFulgor}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-300 text-xs">
                            {item.enxofreMax}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> {item.status2026}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIZ DE CONVERSÃO DE TEMPERATURA D20 */}
          {activeTab === "matriz" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-emerald-400" />
                    Tabela ABNT NBR 5992 — Matriz de Cruzamento Temperatura x Densidade
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cruzamento de temperatura observada (°C) vs densidade lida ($D_t$) para determinação automática da Massa Específica a 20°C ($D_{20}$).
                  </p>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <select
                    value={matrixFuel}
                    onChange={(e) => {
                      const f = e.target.value as FuelType;
                      setMatrixFuel(f);
                      if (f === "Etanol") setMatrixBaseDensity(0.8090);
                      else if (f.includes("Gasolina")) setMatrixBaseDensity(0.7420);
                      else setMatrixBaseDensity(0.8350);
                    }}
                    className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Base Dt:</span>
                    <input
                      type="number"
                      step="0.005"
                      value={matrixBaseDensity}
                      onChange={(e) => setMatrixBaseDensity(Number(e.target.value))}
                      className="w-20 bg-transparent text-xs font-mono font-bold text-white focus:outline-none text-right"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">g/cm³</span>
                  </div>
                </div>
              </div>

              {/* Matrix Grid */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-slate-300 uppercase text-[10px] font-bold tracking-wider">
                        <th className="p-3 text-left pl-4 bg-slate-800/90 sticky left-0 z-10 border-r border-slate-700">
                          Densidade Lida ($D_t$)
                        </th>
                        {tempRange.map((t) => (
                          <th
                            key={t}
                            className={`p-2 font-mono font-bold ${
                              t === 20 ? "bg-indigo-900 text-indigo-200 border-x border-indigo-700" : ""
                            }`}
                          >
                            {t}°C
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                      {densityDeltas.map((delta, idx) => {
                        const dObs = Number((matrixBaseDensity + delta).toFixed(4));
                        return (
                          <tr key={idx} className="hover:bg-slate-800/50 transition">
                            <td className="p-3 text-left pl-4 font-bold text-white bg-slate-900 sticky left-0 z-10 border-r border-slate-800">
                              <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md">
                                {dObs.toFixed(4)} g/cm³
                              </span>
                            </td>
                            {tempRange.map((temp) => {
                              const d20 = calculateD20(matrixFuel, dObs, temp);
                              const comp = checkFuelCompliance(
                                matrixFuel,
                                dObs,
                                temp,
                                27,
                                "Límpido e Isento",
                                false
                              );

                              return (
                                <td
                                  key={temp}
                                  className={`p-2 transition text-xs ${
                                    temp === 20 ? "bg-indigo-950/40 border-x border-indigo-900/50" : ""
                                  }`}
                                >
                                  <div
                                    className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${
                                      comp.conforme
                                        ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                                        : "bg-rose-950/50 border-rose-500/40 text-rose-300"
                                    }`}
                                  >
                                    <div>{d20.toFixed(4)}</div>
                                    <div className="text-[9px] opacity-75">
                                      ({(d20 * 1000).toFixed(1)} kg/m³)
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Legenda de Conformidade:</strong> Células verdes indicam resultado $D_{20}$ dentro da faixa regulamentada pela ANP para {matrixFuel}. Células vermelhas indicam violação da especificação oficial.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: CRUZAMENTO TRIPLE E CONFERÊNCIA DE RESULTADO FINAL */}
          {activeTab === "cruzamento" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-rose-500/30 text-rose-300 border border-rose-400/30 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                      <GitCompare className="h-3 w-3" /> Auditoria Tripla de Combustível
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Res. ANP 807 / 907 / 968</span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    Cruzamento Completo: Nota Fiscal vs Tanque do Posto vs Amostra de Descarga
                  </h3>
                  <p className="text-xs text-slate-400">
                    Insira as leituras de cada etapa para auditoria de convergência de densidade $D_{20}$ e emissão do parecer final de concordância.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Combustível em Auditoria</label>
                  <select
                    value={crossFuel}
                    onChange={(e) => {
                      const f = e.target.value as FuelType;
                      setCrossFuel(f);
                      if (f === "Etanol") {
                        setNfDensity(0.8090);
                        setTankDensity(0.8085);
                        setTruckDensity(0.8095);
                      } else if (f.includes("Gasolina")) {
                        setNfDensity(0.7420);
                        setTankDensity(0.7410);
                        setTruckDensity(0.7430);
                      } else {
                        setNfDensity(0.8350);
                        setTankDensity(0.8340);
                        setTruckDensity(0.8360);
                      }
                    }}
                    className="bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3 Input Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Amostra 1: Nota Fiscal */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase text-indigo-300 flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-indigo-400" />
                      1. Nota Fiscal / Distribuidora
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Documento</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Densidade Faturada D20 (g/cm³)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={nfDensity}
                        onChange={(e) => setNfDensity(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Temperatura de Referência (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={nfTemp}
                        onChange={(e) => setNfTemp(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-between ${
                        nfComp.conforme
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                          : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-sans">D20 NF Corrigida</span>
                        <span>{nfComp.densidadeCorrigida.toFixed(4)} g/cm³</span>
                        <span className="text-[9px] block text-slate-400 font-sans">
                          ({(nfComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold">
                        {nfComp.conforme ? "CONFORME" : "REPROVADO"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amostra 2: Tanque do Posto */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                      <Table className="h-4 w-4 text-amber-400" />
                      2. Tanque do Posto (Antes da Carga)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Estoque</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Densidade Medida Tanque (g/cm³)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={tankDensity}
                        onChange={(e) => setTankDensity(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Temperatura do Tanque (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tankTemp}
                        onChange={(e) => setTankTemp(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-between ${
                        tankComp.conforme
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                          : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-sans">D20 Tanque Corrigida</span>
                        <span>{tankComp.densidadeCorrigida.toFixed(4)} g/cm³</span>
                        <span className="text-[9px] block text-slate-400 font-sans">
                          ({(tankComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold">
                        {tankComp.conforme ? "CONFORME" : "REPROVADO"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amostra 3: Proveta do Caminhão */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1.5">
                      <Thermometer className="h-4 w-4 text-emerald-400" />
                      3. Amostra Proveta (Caminhão)
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Teste Direto</span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Densidade Lida (g/cm³)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={truckDensity}
                          onChange={(e) => setTruckDensity(Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Temp. Amostra (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={truckTemp}
                          onChange={(e) => setTruckTemp(Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {crossFuel.includes("Gasolina") && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          Teor de Etanol Proveta 100ml (% v/v)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={truckEthanolPercent}
                          onChange={(e) => setTruckEthanolPercent(Number(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div
                      className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-between ${
                        truckComp.conforme
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                          : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block font-sans">D20 Proveta Corrigida</span>
                        <span>{truckComp.densidadeCorrigida.toFixed(4)} g/cm³</span>
                        <span className="text-[9px] block text-slate-400 font-sans">
                          ({(truckComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold">
                        {truckComp.conforme ? "CONFORME" : "REPROVADO"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cross-Reference Delta & Final Result Verdict Card */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  allCrossOk
                    ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-100 shadow-xl"
                    : "bg-rose-950/90 border-rose-500/60 text-rose-100 shadow-2xl animate-pulse"
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-3 rounded-2xl border ${
                        allCrossOk
                          ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                          : "bg-rose-500/30 border-rose-400/50 text-rose-200"
                      }`}
                    >
                      {allCrossOk ? <ShieldCheck className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest block text-slate-300">
                        AUDITORIA FINAL DE CONCORDÂNCIA DE DADOS
                      </span>
                      <h4 className="text-base sm:text-lg font-black font-display mt-0.5">
                        {allCrossOk
                          ? "LOTE APROVADO — CRUZAMENTO DE DADOS 100% CONFLUENADO E DENTRO DA NORMA"
                          : "REPROVADO / DIVERGÊNCIA CRÍTICA DE MASSA ESPECÍFICA DE DESCARGA"}
                      </h4>
                    </div>
                  </div>

                  <span
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shadow-md shrink-0 ${
                      allCrossOk
                        ? "bg-emerald-600 text-white border-emerald-400"
                        : "bg-rose-600 text-white border-rose-400"
                    }`}
                  >
                    {allCrossOk ? "PARECER: AUTORIZADO" : "PARECER: RECUSAR CARGA"}
                  </span>
                </div>

                {/* Detailed Delta Metrics Table */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 font-mono text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">
                      Delta (Nota Fiscal vs Proveta)
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{(deltaNfTruck * 1000).toFixed(1)} kg/m³</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-sans font-bold ${
                          deltaNfTruckOk
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {deltaNfTruckOk ? "Tolerado (≤ 3,0 kg/m³)" : "Excedido!"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 font-mono text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">
                      Delta (Tanque vs Proveta)
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{(deltaTankTruck * 1000).toFixed(1)} kg/m³</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-sans font-bold ${
                          deltaTankTruckOk
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {deltaTankTruckOk ? "Tolerado (≤ 3,0 kg/m³)" : "Excedido!"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 font-mono text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">
                      Limites Oficiais ANP {crossFuel}
                    </span>
                    <div className="text-slate-200 font-bold">
                      {(truckComp.densidadeMin * 1000).toFixed(1)} a {(truckComp.densidadeMax * 1000).toFixed(1)} kg/m³
                    </div>
                  </div>
                </div>

                {!allCrossOk && (
                  <div className="mt-3 text-xs bg-rose-900/50 p-3 rounded-xl border border-rose-700/60 text-rose-200 font-medium">
                    <strong>Atenção Regulatória (ANP):</strong> Há divergência superior à margem permitida de 0,0030 g/cm³ (3,0 kg/m³) ou um dos parâmetros está fora da faixa regulamentada da Resolução ANP 2026. A retenção da amostra testemunha e o bloqueio da descarga são obrigatórios.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-900 p-4 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Sistema Oficial de Qualidade & Controle de Postos • ANP 2026 / ABNT NBR 5992
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer ml-auto"
          >
            Fechar Tabela ANP
          </button>
        </div>
      </div>
    </div>
  );
}
