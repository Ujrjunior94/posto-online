/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import SubTabNavigation from "./SubTabNavigation";
import { AppState, NozzleCalibration, ANPQualityAudit, FuelType, FuelDelivery, ShiftOccurrence, ShiftSchedule, FuelTank } from "../types";
import {
  Thermometer,
  ShieldAlert,
  CheckCircle,
  Plus,
  Gauge,
  Sparkles,
  Truck,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
  FileDown,
  Lock,
  ChevronDown,
  ChevronUp,
  Eye,
  Search,
  Calculator,
  Filter,
  CheckCircle2,
  XCircle,
  Info,
  Table,
  Pencil,
  Edit3,
  RefreshCw,
  RotateCcw,
  X,
  Save,
} from "lucide-react";
import { FUEL_TYPES } from "./TanksManagement";
import ReportPreviewModal from "./ReportPreviewModal";
import ANPOfficialTableModal from "./ANPOfficialTableModal";
import { exportReportPDF, exportReportCSV } from "../utils/reportExporter";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function getDensityCorrectionFactor(fuel: FuelType | string): number {
  const f = (fuel || "").toString().toUpperCase();
  if (f.includes("ETANOL")) return 0.00110;
  if (f.includes("GASOLINA")) return 0.00092;
  if (f.includes("DIESEL") || f.includes("S10") || f.includes("S500")) return 0.00065;
  return 0.00080;
}

export function calculateD20(densidadeMedida: number, temperaturaMedida: number, fuel: FuelType | string): number {
  const factor = getDensityCorrectionFactor(fuel);
  return densidadeMedida * (1 + factor * (temperaturaMedida - 20));
}

export interface FuelComplianceResult {
  densidadeCorrigida: number;
  densidadeMin: number;
  densidadeMax: number;
  densidadeOk: boolean;
  teorOk: boolean;
  aspectoOk: boolean;
  impurezasOk: boolean;
  conforme: boolean;
  teorCalculadoOuEsperado: number;
  teorMin: number;
  teorMax: number;
  mensagem: string;
}

export function checkFuelCompliance(
  fuel: FuelType | string,
  densidadeMedida: number,
  temperaturaMedida: number,
  teorInformado: number = 0,
  aspectoVisual: "Límpido e Isento" | "Turvo" | "Com Impurezas" = "Límpido e Isento",
  presencaImpurezas: boolean = false
): FuelComplianceResult {
  const d20 = calculateD20(densidadeMedida, temperaturaMedida, fuel);
  const fuelUpper = (fuel || "").toString().toUpperCase();

  let densidadeMin = 0.7150;
  let densidadeMax = 0.7750;
  let teorMin = 0;
  let teorMax = 0;
  let teorCalculadoOuEsperado = 0;
  let teorOk = true;
  let mensagem = "";

  if (fuelUpper.includes("ETANOL")) {
    densidadeMin = 0.8076;
    densidadeMax = 0.8110;
    // Cálculo do teor alcoólico do etanol em massa (% M/M / °INPM):
    // D20 = 0.8076 g/cm³ -> 93.8% M/M
    // D20 = 0.8110 g/cm³ -> 92.5% M/M
    const massPct = 93.8 - ((d20 - 0.8076) / 0.0034) * 1.3;
    teorCalculadoOuEsperado = Math.min(100, Math.max(0, Number(massPct.toFixed(1))));
    teorMin = 92.5;
    teorMax = 93.8;
    teorOk = teorCalculadoOuEsperado >= teorMin && teorCalculadoOuEsperado <= teorMax;
  } else if (fuelUpper.includes("PREMIUM")) {
    densidadeMin = 0.7700;
    densidadeMax = 0.8000;
    teorMin = 25.0; // ANP 2026 Premium
    teorMax = 30.0;
    teorCalculadoOuEsperado = (teorInformado <= 0 || teorInformado > 50) ? 27.0 : teorInformado;
    teorOk = teorCalculadoOuEsperado >= teorMin && teorCalculadoOuEsperado <= teorMax;
  } else if (fuelUpper.includes("GASOLINA")) {
    densidadeMin = 0.7150;
    densidadeMax = 0.7750;
    teorMin = 26.0; // ANP 2026: E27/E30 standard range
    teorMax = 30.0;
    teorCalculadoOuEsperado = (teorInformado <= 0 || teorInformado > 50) ? 27.0 : teorInformado;
    teorOk = teorCalculadoOuEsperado >= teorMin && teorCalculadoOuEsperado <= teorMax;
  } else if (fuelUpper.includes("S500")) {
    densidadeMin = 0.8200;
    densidadeMax = 0.8650;
    teorMin = 14.0; // Biodiesel B14/B15
    teorMax = 15.5;
    const effTeor = (teorInformado > 20 || teorInformado <= 0) ? 15.0 : teorInformado;
    teorCalculadoOuEsperado = effTeor;
    teorOk = effTeor === 0 || (effTeor >= teorMin && effTeor <= teorMax);
  } else if (fuelUpper.includes("DIESEL") || fuelUpper.includes("S10") || fuelUpper.includes("DMA")) {
    densidadeMin = 0.8200;
    densidadeMax = 0.8500;
    teorMin = 14.0; // Biodiesel B14/B15
    teorMax = 15.5;
    const effTeor = (teorInformado > 20 || teorInformado <= 0) ? 15.0 : teorInformado;
    teorCalculadoOuEsperado = effTeor;
    teorOk = effTeor === 0 || (effTeor >= teorMin && effTeor <= teorMax);
  }

  const densidadeOk = d20 >= densidadeMin && d20 <= densidadeMax;
  const aspectoOk = aspectoVisual === "Límpido e Isento";
  const impurezasOk = !presencaImpurezas;

  const conforme = densidadeOk && teorOk && aspectoOk && impurezasOk;

  if (!conforme) {
    const motivos: string[] = [];
    if (!densidadeOk) motivos.push(`Massa específica D20 (${(d20 * 1000).toFixed(1)} kg/m³) fora da faixa ANP (${(densidadeMin * 1000).toFixed(1)} - ${(densidadeMax * 1000).toFixed(1)} kg/m³)`);
    if (!teorOk) {
      if (fuel === "Etanol") {
        motivos.push(`Teor Alcoólico em Massa (${teorCalculadoOuEsperado.toFixed(1)}% M/M) fora do permitido (92.5% - 93.8% M/M)`);
      } else if (fuel.includes("Gasolina")) {
        motivos.push(`Teor de Etanol Anidro (${teorCalculadoOuEsperado.toFixed(1)}%) fora do limite regulamentar (${teorMin.toFixed(1)}% - ${teorMax.toFixed(1)}%)`);
      } else if (fuel.includes("Diesel")) {
        motivos.push(`Teor de Biodiesel (${teorCalculadoOuEsperado.toFixed(1)}%) fora do limite B14/B15`);
      }
    }
    if (!aspectoOk) motivos.push("Aspecto visual não atende o critério Límpido e Isento");
    if (!impurezasOk) motivos.push("Presença detectada de partículas/impurezas");
    mensagem = "Não Conforme (ANP 2026): " + motivos.join("; ");
  } else {
    mensagem = "Conforme: Combustível aprovado em conformidade com as normas ANP.";
  }

  return {
    densidadeCorrigida: Number(d20.toFixed(4)),
    densidadeMin,
    densidadeMax,
    densidadeOk,
    teorOk,
    aspectoOk,
    impurezasOk,
    conforme,
    teorCalculadoOuEsperado,
    teorMin,
    teorMax,
    mensagem
  };
}

interface ANPQualityControlProps {
  appState: AppState;
  userRole: string;
  cnpjPosto: string;
  onUpdateCalibrations: (calibrations: NozzleCalibration[]) => void;
  onUpdateQualityAudits: (audits: ANPQualityAudit[]) => void;
  onUpdateDeliveries: (deliveries: FuelDelivery[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  onUpdateShifts?: (shifts: ShiftSchedule[]) => void;
  onUpdateTanks?: (tanks: FuelTank[]) => void;
  onUpdateReportCustomization?: (customs: Partial<AppState>) => void;
  onClearData?: () => void;
}

export default function ANPQualityControl({
  appState,
  userRole,
  cnpjPosto,
  onUpdateCalibrations,
  onUpdateQualityAudits,
  onUpdateDeliveries,
  onAddAuditLog,
  onUpdateShifts,
  onUpdateTanks,
  onUpdateReportCustomization,
  onClearData,
}: ANPQualityControlProps) {
  const { calibrations = [], qualityAudits = [], nozzles = [], deliveries = [] } = appState;
  const fuelDeliveries = deliveries;
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

  // Active view inside Quality tab: "afericao" (Calibrations), "laudo" (Chemical Quality), "entregas" (Fuel Deliveries), "especificacoes_2026" (ANP 2026 Specs Table)
  const [activeSubTab, setActiveSubTab] = useState<"afericao" | "laudo" | "entregas" | "especificacoes_2026" | "tabela_conferencia">("afericao");

  // Selection state for batch actions
  const [selectedCalibrations, setSelectedCalibrations] = useState<{ [key: string]: boolean }>({});
  const [selectedQualityAudits, setSelectedQualityAudits] = useState<{ [key: string]: boolean }>({});

  // Nozzle calibration form state
  const [calNozzleId, setCalNozzleId] = useState("");
  const [calVolumeMedido, setCalVolumeMedido] = useState(20.0);
  const [calDesvioMl, setCalDesvioMl] = useState(0); // in mL (-120 to 120, step 20)
  const [calOperador, setCalOperador] = useState("");

  // Chemical quality audit state
  const [qCombustivel, setQCombustivel] = useState<FuelType>("Gasolina Comum");
  const [qDensidade, setQDensidade] = useState(0.742); // g/cm3
  const [qTemperatura, setQTemperatura] = useState(23.0); // °C
  const [qTeorEtanol, setQTeorEtanol] = useState(27); // % (only applies to gasolines)
  const [qAspecto, setQAspecto] = useState<"Límpido e Isento" | "Turvo" | "Com Impurezas">("Límpido e Isento");
  const [qImpurezas, setQImpurezas] = useState(false);
  const [qResponsavel, setQResponsavel] = useState("");

  // Vínculo Nota Fiscal com Laudo ANP
  const [qNumeroNotaFiscal, setQNumeroNotaFiscal] = useState("");
  const [qFornecedorNota, setQFornecedorNota] = useState("");
  const [qDeliveryId, setQDeliveryId] = useState("");
  const [qNumeroLaudoFornecedor, setQNumeroLaudoFornecedor] = useState("");

  // Modal para vincular Nota Fiscal a um Laudo já existente
  const [linkingAuditModal, setLinkingAuditModal] = useState<ANPQualityAudit | null>(null);
  const [linkModalNfe, setLinkModalNfe] = useState("");
  const [linkModalFornecedor, setLinkModalFornecedor] = useState("");
  const [linkModalDeliveryId, setLinkModalDeliveryId] = useState("");
  const [linkModalLaudoFornecedor, setLinkModalLaudoFornecedor] = useState("");

  // ANP Specific Gravity / Mass Density Lookup Table state
  const [densitySearchTerm, setDensitySearchTerm] = useState("");
  const [densityCategoryFilter, setDensityCategoryFilter] = useState<"Todos" | "Gasolinas" | "Etanol" | "Diesel" | "Outros">("Todos");
  const [densityCalcFuel, setDensityCalcFuel] = useState<FuelType>("Gasolina Comum");
  const [densityCalcMeas, setDensityCalcMeas] = useState<number>(0.7420);
  const [densityCalcTemp, setDensityCalcTemp] = useState<number>(24.0);

  // Deliveries state
  const [delDate, setDelDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [delNfe, setDelNfe] = useState("");
  const [delCombustivel, setDelCombustivel] = useState<FuelType>("Gasolina Comum");
  const [delVolume, setDelVolume] = useState(10000);
  const [delPlaca, setDelPlaca] = useState("");
  const [delMotorista, setDelMotorista] = useState("");
  const [delDensidade, setDelDensidade] = useState(0.7420);
  const [delTemperatura, setDelTemperatura] = useState(23.0);

  // Modal for Official ANP Table
  const [showANPTableModal, setShowANPTableModal] = useState(false);
  const [densityUnit, setDensityUnit] = useState<"g/cm3" | "kg/m3">("g/cm3");

  // Editing state for saved Quality Audits (Recálculo e atualização de laudos já salvos)
  const [editingAudit, setEditingAudit] = useState<ANPQualityAudit | null>(null);
  const [editAuditData, setEditAuditData] = useState("");
  const [editAuditCombustivel, setEditAuditCombustivel] = useState<FuelType>("Gasolina Comum");
  const [editAuditDensidade, setEditAuditDensidade] = useState("");
  const [editAuditTemperatura, setEditAuditTemperatura] = useState("");
  const [editAuditTeorEtanol, setEditAuditTeorEtanol] = useState("");
  const [editAuditAspecto, setEditAuditAspecto] = useState<"Límpido e Isento" | "Turvo" | "Com Impurezas">("Límpido e Isento");
  const [editAuditImpurezas, setEditAuditImpurezas] = useState(false);
  const [editAuditResponsavel, setEditAuditResponsavel] = useState("");

  // Editing state for saved Deliveries (Recálculo e atualização de cargas já salvas)
  const [editingDelivery, setEditingDelivery] = useState<FuelDelivery | null>(null);
  const [editDelDate, setEditDelDate] = useState("");
  const [editDelNfe, setEditDelNfe] = useState("");
  const [editDelCombustivel, setEditDelCombustivel] = useState<FuelType>("Gasolina Comum");
  const [editDelVolume, setEditDelVolume] = useState("");
  const [editDelPlaca, setEditDelPlaca] = useState("");
  const [editDelMotorista, setEditDelMotorista] = useState("");
  const [editDelDensidade, setEditDelDensidade] = useState("");
  const [editDelTemperatura, setEditDelTemperatura] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [isSpecsExpanded, setIsSpecsExpanded] = useState(true);

  const handleExportDeliveriesPDF = () => {
    exportReportPDF({
      appState,
      reportType: "deliveries",
      startDate: "2020-01-01",
      endDate: "2030-12-31"
    });
  };

  const handleExportDeliveriesCSV = () => {
    exportReportCSV({
      appState,
      reportType: "deliveries",
      startDate: "2020-01-01",
      endDate: "2030-12-31"
    });
  };

  // ANP deviation rules: acceptable standard deviation is -100 to +100 mL.
  const handleCreateCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!calNozzleId) {
      setError("Selecione o bico correspondente.");
      return;
    }

    const dev = Number(calDesvioMl);
    if (isNaN(dev) || dev < -120 || dev > 120) {
      setError("O desvio na aferição deve estar entre -120 mL e +120 mL.");
      return;
    }

    const conforme = dev >= -100 && dev <= 100;
    
    const nozzle = nozzles.find(n => n.id === calNozzleId);
    const precoPorLitro = nozzle ? nozzle.precoPorLitro : 0;
    const valorReais = Number(calVolumeMedido) * precoPorLitro;

    const newCal: NozzleCalibration = {
      id: "cal_" + Date.now(),
      data: new Date().toISOString().split("T")[0],
      nozzleId: calNozzleId,
      volumeMedido: Number(calVolumeMedido),
      desvioMl: dev,
      conforme,
      operadorResponsavel: calOperador || "Supervisor Geral",
      valorReais,
    };

    onUpdateCalibrations([...calibrations, newCal]);
    onAddAuditLog("CREATE", "Qualidade", `Registrou aferição física de ${calVolumeMedido}L para o bico ${calNozzleId}. Desvio: ${dev} ml`, "Regular");

    setSuccess(
      conforme
        ? `Aferição de bico salva: Conforme padrão ANP (desvio: ${dev} ml).`
        : `ALERTA: Aferição salva! O bico está FORA dos limites técnicos de -100 a +100 mL (desvio: ${dev} ml).`
    );
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleCreateQualityAudit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const comp = checkFuelCompliance(
      qCombustivel,
      Number(qDensidade),
      Number(qTemperatura),
      Number(qTeorEtanol),
      qAspecto,
      qImpurezas
    );

    const newAuditId = "qa_" + Date.now();
    const newAudit: ANPQualityAudit = {
      id: newAuditId,
      data: new Date().toISOString().split("T")[0],
      combustivel: qCombustivel,
      densidade: Number(qDensidade),
      temperatura: Number(qTemperatura),
      densidadeCorrigida: comp.densidadeCorrigida,
      teorEtanol: comp.teorCalculadoOuEsperado,
      aspectoVisual: qAspecto,
      presencaImpurezas: qImpurezas,
      conforme: comp.conforme,
      responsavelTecnico: qResponsavel || "Químico Técnico",
      numeroNotaFiscal: qNumeroNotaFiscal.trim() || undefined,
      fornecedorNota: qFornecedorNota.trim() || undefined,
      deliveryId: qDeliveryId || undefined,
      numeroLaudoFornecedor: qNumeroLaudoFornecedor.trim() || undefined,
    };

    onUpdateQualityAudits([...qualityAudits, newAudit]);

    // Se vinculou uma entrega/carga cadastrada, vincular o ID do laudo na entrega
    if (qDeliveryId && fuelDeliveries.length > 0) {
      const updatedDeliveries = fuelDeliveries.map((del) => {
        if (del.id === qDeliveryId) {
          return {
            ...del,
            qualityAuditId: newAuditId,
            fornecedor: qFornecedorNota.trim() || del.fornecedor,
            nfe: qNumeroNotaFiscal.trim() || del.nfe || del.invoiceNumber,
          };
        }
        return del;
      });
      onUpdateDeliveries(updatedDeliveries);
    }

    if (comp.conforme) {
      onAddAuditLog(
        "CREATE",
        "Qualidade",
        `Emitiu laudo químico ANP para ${qCombustivel}. D20: ${comp.densidadeCorrigida} g/cm³. Status: CONFORME`,
        "Regular"
      );
      setSuccess(
        `Laudo ANP gerado: CONFORME! Massa específica corrigida a 20°C: ${comp.densidadeCorrigida.toFixed(4)} g/cm³ (${qCombustivel === "Etanol" ? `Teor Alcoólico: ${comp.teorCalculadoOuEsperado.toFixed(1)}% M/M` : `Teor: ${comp.teorCalculadoOuEsperado.toFixed(1)}%`}).`
      );
    } else {
      // 1. Bloquear automaticamente o(s) tanque(s) do combustível correspondente
      const affectedTanks = (appState.tanks || []).filter(
        (t) => t.combustivel === qCombustivel
      );

      let tankNamesStr = "";
      if (affectedTanks.length > 0 && onUpdateTanks) {
        tankNamesStr = affectedTanks.map((t) => t.identificador).join(", ");
        const updatedTanks = appState.tanks.map((t) => {
          if (t.combustivel === qCombustivel) {
            return {
              ...t,
              observacoes: `[🚨 TANQUE BLOQUEADO POR QUALIDADE ANP - ${new Date().toLocaleDateString("pt-BR")}] Reprovado no teste de conformidade. Motivo: ${comp.mensagem}`,
            };
          }
          return t;
        });
        onUpdateTanks(updatedTanks);
      }

      // 2. Disparar ocorrência bloqueante automática no sistema de turnos/escalas
      const todayStr = new Date().toISOString().split("T")[0];
      const nowTimeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const occMsg = `🚨 OCORRÊNCIA BLOQUEANTE (QUALIDADE ANP): O combustível ${qCombustivel} foi REPROVADO no teste de conformidade. ${comp.mensagem}. O(s) Tanque(s) de ${qCombustivel} (${tankNamesStr || "Não especificado"}) foi(ram) BLOQUEADO(S) para operação e abastecimento até drenagem e laudo conforme.`;

      if (onUpdateShifts && appState.shifts && appState.shifts.length > 0) {
        const newOcc: ShiftOccurrence = {
          id: "oco_block_anp_" + Date.now(),
          tipo: "Problema na Pista",
          descricao: occMsg,
          dataHora: `${todayStr} ${nowTimeStr}`,
        };

        const activeShiftIndex = appState.shifts.findIndex((s) => s.status === "Em Andamento");
        const targetIndex = activeShiftIndex !== -1 ? activeShiftIndex : appState.shifts.length - 1;

        const updatedShifts = appState.shifts.map((s, idx) => {
          if (idx === targetIndex) {
            return {
              ...s,
              occurrences: [...(s.occurrences || []), newOcc],
            };
          }
          return s;
        });
        onUpdateShifts(updatedShifts);
      }

      onAddAuditLog(
        "CREATE",
        "Qualidade",
        `ALERTA DE REPROVAÇÃO ANP: ${qCombustivel} reprovado. ${comp.mensagem}. Ocorrência Bloqueante e Bloqueio de Tanque executados automaticamente.`,
        "Bloqueio ANP"
      );

      setError(
        `🚨 ALERTA CRÍTICO ANP: Combustível REPROVADO! ${comp.mensagem}. OCORRÊNCIA BLOQUEANTE registrada automaticamente na escala e Tanque(s) de ${qCombustivel} (${tankNamesStr || "Geral"}) BLOQUEADO(S).`
      );
    }
  };

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delNfe.trim() || !delMotorista.trim() || !delPlaca.trim()) {
      alert("Preencha todos os campos da NF-e.");
      return;
    }

    const newDel: FuelDelivery = {
      id: "del_" + Date.now(),
      data: delDate,
      nfe: delNfe,
      combustivel: delCombustivel,
      volumeRecebido: Number(delVolume),
      placaCaminhao: delPlaca,
      motorista: delMotorista,
      stationCnpj: cnpjPosto,
    };

    onUpdateDeliveries([...fuelDeliveries, newDel]);
    onAddAuditLog("CREATE", "Estoque", `Recebeu carga de combustível NF-e ${delNfe}: ${delVolume}L de ${delCombustivel}`, "Regular");

    setSuccess(`Carga de combustível registrada com sucesso! NF-e ${delNfe}.`);
    setTimeout(() => setSuccess(""), 3000);

    setDelNfe("");
    setDelMotorista("");
    setDelPlaca("");
  };

  const handleDeleteDelivery = (id: string) => {
    if (confirm("Deseja remover o registro desta entrega?")) {
      const filtered = fuelDeliveries.filter((d) => d.id !== id);
      onUpdateDeliveries(filtered);
      onAddAuditLog("DELETE", "Estoque", `Excluiu recebimento de carga ID ${id}`, "Regular");
    }
  };

  // Export selected calibrations to CSV
  const handleExportSelectedCSV = () => {
    const selectedIds = Object.keys(selectedCalibrations).filter((id) => selectedCalibrations[id]);
    if (selectedIds.length === 0) {
      alert("Selecione ao menos uma aferição na tabela abaixo para exportar.");
      return;
    }

    const rowsToExport = calibrations.filter((c) => selectedIds.includes(c.id));
    
    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
    const reportAddress = appState.reportHeaderAddress || "";
    const emissionDate = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

    let csvContent = "\ufeff"; // UTF-8 BOM
    csvContent += `EMPRESA:;${reportCompName}\n`;
    csvContent += `CNPJ:;${reportCnpj}\n`;
    if (reportAddress) {
      csvContent += `ENDEREÇO:;${reportAddress}\n`;
    }
    csvContent += `RELATÓRIO:;AFERIÇÃO DE BICOS - EXPORTAÇÃO PLANILHA\n`;
    csvContent += `EMISSÃO:;${emissionDate}\n\n`;

    // Header
    csvContent += "ID;Data;Bico;Volume Medido (L);Desvio (mL);Conforme;Responsável\n";

    rowsToExport.forEach((c) => {
      csvContent += `${c.id};${c.data};${c.nozzleId};${c.volumeMedido};${c.desvioMl};${c.conforme ? "SIM" : "NÃO"};${c.operadorResponsavel}\n`;
    });

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
    downloadLink.setAttribute("download", `afericoes_bico_${Date.now()}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);

    onAddAuditLog("DOWNLOAD", "Qualidade", `Exportou planilha com ${rowsToExport.length} aferições de vazão`, "Regular");
  };

  // Export selected calibrations to PDF
  const handleExportSelectedPDF = () => {
    const selectedIds = Object.keys(selectedCalibrations).filter((id) => selectedCalibrations[id]);
    if (selectedIds.length === 0) {
      alert("Selecione ao menos uma aferição na tabela abaixo para exportar.");
      return;
    }

    const rowsToExport = calibrations.filter((c) => selectedIds.includes(c.id));
    const doc = new jsPDF();
    const emissionDate = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

    const startX = 14;
    const endX = 196;
    const usableWidth = 182;

    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
    const reportAddress = appState.reportHeaderAddress || "";

    doc.setDrawColor(79, 70, 229); // Indigo-600 color theme
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

    doc.setTextColor(79, 70, 229);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(reportCompName, textX, 21);

    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`RELATÓRIO DE AFERIÇÃO DE BICOS • CNPJ: ${reportCnpj}`, textX, 26);
    if (reportAddress) {
      doc.setFontSize(6.5);
      doc.text(reportAddress.length > 80 ? reportAddress.substring(0, 80) + "..." : reportAddress, textX, 30);
    }

    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`Emissão: ${emissionDate}`, endX, 24, { align: "right" });

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(startX, 33, endX, 33);

    // Table
    const tableData = rowsToExport.map((c) => {
      const nozzle = nozzles.find((n) => n.id === c.nozzleId);
      const tank = nozzle ? (appState.tanks || []).find(t => t.id === nozzle.tanqueId) : null;
      const fuelInfo = tank ? `(${tank.combustivel})` : "";
      
      return [
        c.data.split("-").reverse().join("/"),
        nozzle ? `Bico ${nozzle.numeroBico} ${fuelInfo}` : c.nozzleId,
        `R$ ${(c.valorReais || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `${c.desvioMl > 0 ? "+" : ""}${c.desvioMl} mL`,
        c.conforme ? "CONFORME" : "NÃO CONFORME",
        c.operadorResponsavel,
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [["Data", "Bico / Produto", "Valor (R$)", "Desvio", "Veredicto", "Responsável"]],
      body: tableData,
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        3: { fontStyle: "bold" },
        4: { fontStyle: "bold" },
      },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    const totalVolume = rowsToExport.reduce((acc, c) => acc + c.volumeMedido, 0);
    const totalValor = rowsToExport.reduce((acc, c) => acc + (c.valorReais || 0), 0);

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Total de Aferições: ${rowsToExport.length}`, 14, finalY + 12);
    doc.text(`Volume Total Aferido: ${totalVolume} Litros`, 14, finalY + 18);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`VALOR TOTAL ACUMULADO: R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, finalY + 26);

    const sigY = finalY + 45;
    if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
      try {
        const sigWidth = 40;
        const sigHeight = 12;
        const sigX = (usableWidth / 2 + startX) - (sigWidth / 2);
        doc.addImage(appState.reportSignatureBase64, "PNG", sigX, sigY - 15, sigWidth, sigHeight);
      } catch (e) {
        console.error("Error adding signature image to PDF:", e);
      }
    }

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(startX + 50, sigY, endX - 50, sigY);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
    doc.text(signerName, usableWidth / 2 + startX, sigY + 4, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
    doc.text(signerRole, usableWidth / 2 + startX, sigY + 8, { align: "center" });

    doc.save(`relatorio_afericoes_${Date.now()}.pdf`);
    onAddAuditLog("DOWNLOAD", "Qualidade", `Exportou PDF com ${rowsToExport.length} aferições de vazão`, "Regular");
  };

  const handleExportAuditPDF = (audit: ANPQualityAudit) => {
    const doc = new jsPDF();
    const emissionDate = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

    const startX = 14;
    const endX = 196;
    const usableWidth = 182;

    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
    const reportAddress = appState.reportHeaderAddress || "";

    doc.setDrawColor(15, 23, 42); // Slate-900 color theme
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

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(reportCompName, textX, 21);

    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`LAUDO DE QUALIDADE ANP • CNPJ: ${reportCnpj}`, textX, 26);
    if (reportAddress) {
      doc.setFontSize(6.5);
      doc.text(reportAddress.length > 80 ? reportAddress.substring(0, 80) + "..." : reportAddress, textX, 30);
    }

    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`Laudo N°: ${audit.id}`, endX, 20, { align: "right" });
    doc.text(`Emissão: ${emissionDate}`, endX, 24, { align: "right" });

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(startX, 33, endX, 33);

    // Document Title Banner
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(14, 43, 182, 14, "F");
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(14, 43, 182, 14, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("CERTIFICADO DE ANÁLISE DE QUALIDADE DE COMBUSTÍVEL", 18, 51);

    // Product & Sampling Details Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("1. DADOS DA AMOSTRA E AMOSTRAGEM", 14, 69);
    doc.setLineWidth(0.3);
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(14, 71, 196, 71);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // slate-700
    
    // Left Column details
    doc.text(`Combustível Analisado:`, 14, 78);
    doc.setFont("helvetica", "bold");
    doc.text(`${audit.combustivel.toUpperCase()}`, 52, 78);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Data da Análise:`, 14, 84);
    doc.setFont("helvetica", "bold");
    doc.text(`${audit.data.split("-").reverse().join("/")}`, 42, 84);

    doc.setFont("helvetica", "normal");
    doc.text(`Responsável Técnico:`, 14, 90);
    doc.setFont("helvetica", "bold");
    doc.text(`${audit.responsavelTecnico}`, 50, 90);

    // Right Column details
    doc.setFont("helvetica", "normal");
    doc.text(`Aspecto Visual:`, 110, 78);
    doc.setFont("helvetica", "bold");
    doc.text(`${audit.aspectoVisual}`, 136, 78);

    doc.setFont("helvetica", "normal");
    doc.text(`Partículas/Água:`, 110, 84);
    doc.setFont("helvetica", "bold");
    doc.text(`${audit.presencaImpurezas ? "PRESENTE (FORA)" : "AUSENTE (CONFORME)"}`, 137, 84);

    doc.setFont("helvetica", "normal");
    doc.text(`Origem dos Limites:`, 110, 90);
    doc.setFont("helvetica", "bold");
    const resName = audit.combustivel === "Etanol" 
      ? "Res. ANP 907/2022" 
      : audit.combustivel.includes("Diesel") 
        ? "Res. ANP 968/2024" 
        : "Res. ANP 807/2020";
    doc.text(resName, 142, 90);

    // 2. Technical Measurements Table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("2. ENSAIOS REALIZADOS E ESPECIFICAÇÕES", 14, 104);
    doc.line(14, 106, 196, 106);

    // Calculate compliance results
    const comp = checkFuelCompliance(
      audit.combustivel,
      audit.densidade,
      audit.temperatura,
      audit.teorEtanol,
      audit.aspectoVisual,
      audit.presencaImpurezas
    );

    const factor = getDensityCorrectionFactor(audit.combustivel);
    const observedDensityKg = audit.densidade * 1000;
    const correctedDensityKg = (audit.densidadeCorrigida || comp.densidadeCorrigida) * 1000;
    const minDensityKg = comp.densidadeMin * 1000;
    const maxDensityKg = comp.densidadeMax * 1000;

    // Define table data
    const tableRows = [
      [
        "Temperatura da Amostra",
        `${audit.temperatura.toFixed(1)} °C`,
        "Informativo",
        "—",
        "CONFORME"
      ],
      [
        "Massa Específica Observada (ρt)",
        `${observedDensityKg.toFixed(1)} kg/m³`,
        "Informativo",
        "—",
        "CONFORME"
      ],
      [
        "Coeficiente de Expansão Térmica (α)",
        `${factor.toFixed(5)}`,
        "Constante de cálculo",
        "—",
        "CONFORME"
      ],
      [
        "Massa Específica Corrigida a 20°C (ρ₂₀)",
        `${correctedDensityKg.toFixed(1)} kg/m³`,
        `${minDensityKg.toFixed(1)} a ${maxDensityKg.toFixed(1)} kg/m³`,
        `${audit.densidadeCorrigida ? audit.densidadeCorrigida.toFixed(4) : comp.densidadeCorrigida.toFixed(4)} g/cm³`,
        comp.densidadeOk ? "CONFORME" : "NÃO CONFORME"
      ]
    ];

    if (audit.combustivel === "Etanol") {
      tableRows.push([
        "Teor Alcoólico em Massa (INPM)",
        `${audit.teorEtanol.toFixed(1)}% m/m`,
        "92,5% a 93,8% m/m",
        "—",
        comp.teorOk ? "CONFORME" : "NÃO CONFORME"
      ]);
    } else if (audit.combustivel.includes("Gasolina")) {
      tableRows.push([
        "Teor de Etanol Anidro",
        `${audit.teorEtanol.toFixed(1)}% v/v`,
        `${comp.teorMin.toFixed(1)}% a ${comp.teorMax.toFixed(1)}% v/v`,
        "—",
        comp.teorOk ? "CONFORME" : "NÃO CONFORME"
      ]);
    } else if (audit.combustivel === "Diesel S10") {
      tableRows.push([
        "Teor de Biodiesel Estimado",
        `${audit.teorEtanol.toFixed(1)}% v/v`,
        "14,0% a 15,0% v/v",
        "—",
        comp.teorOk ? "CONFORME" : "NÃO CONFORME"
      ]);
    }

    tableRows.push([
      "Aspecto Visual",
      audit.aspectoVisual,
      "Límpido e Isento",
      "—",
      comp.aspectoOk ? "CONFORME" : "NÃO CONFORME"
    ]);

    tableRows.push([
      "Presença de Impurezas / Água",
      audit.presencaImpurezas ? "Detectado" : "Não Detectado",
      "Ausente",
      "—",
      comp.impurezasOk ? "CONFORME" : "NÃO CONFORME"
    ]);

    autoTable(doc, {
      startY: 110,
      head: [["Ensaio / Parâmetro", "Resultado Obtido", "Especificação ANP", "Unidade Secundária", "Veredicto"]],
      body: tableRows,
      headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, cellPadding: 3.5 },
      columnStyles: {
        1: { fontStyle: "bold" },
        4: { fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.section === "body") {
          if (data.cell.text[0] === "CONFORME") {
            data.cell.styles.textColor = [16, 185, 129]; // emerald-600
          } else if (data.cell.text[0] === "NÃO CONFORME") {
            data.cell.styles.textColor = [239, 68, 68]; // rose-500
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 190;

    // 3. Final Evaluation Callout Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("3. CONCLUSÃO E PARECER TÉCNICO", 14, finalY + 12);
    doc.line(14, finalY + 14, 196, finalY + 14);

    if (comp.conforme) {
      // Success callout box
      doc.setFillColor(240, 253, 250); // emerald-50
      doc.rect(14, finalY + 18, 182, 22, "F");
      doc.setDrawColor(167, 243, 208); // emerald-200
      doc.rect(14, finalY + 18, 182, 22, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(4, 120, 87); // emerald-700
      doc.text("PRODUTO APROVADO PARA COMERCIALIZAÇÃO", 18, finalY + 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(6, 95, 70); // emerald-800
      const lines = doc.splitTextToSize(
        `O combustível analisado de lote diário encontra-se em CONFORME com as resoluções vigentes da ANP (Agência Nacional do Petróleo, Gás Natural e Biocombustíveis), apresentando valores de massa específica D20 e demais parâmetros qualitativos de teor alcoólico/mistura e aspecto físico rigorosamente dentro dos limites legais de tolerância.`,
        174
      );
      doc.text(lines, 18, finalY + 29);
    } else {
      // Failure callout box
      doc.setFillColor(254, 242, 242); // rose-50
      doc.rect(14, finalY + 18, 182, 24, "F");
      doc.setDrawColor(254, 202, 202); // rose-200
      doc.rect(14, finalY + 18, 182, 24, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(185, 28, 28); // rose-700
      doc.text("PRODUTO REPROVADO — FORA DOS PADRÕES ANP", 18, finalY + 24);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(153, 27, 27); // rose-800
      const lines = doc.splitTextToSize(
        `ATENÇÃO: Foram identificados desvios nos limites de conformidade regulamentares da ANP para este combustível. Por medida de segurança e conformidade legal, o respectivo tanque de armazenamento foi preventivamente bloqueado no sistema e as operações comerciais devem ser suspensas de imediato até nova auditoria técnica de purificação ou correção.`,
        174
      );
      doc.text(lines, 18, finalY + 29);
    }

    // 4. Signatures Area
    const signY = finalY + 62;
    doc.setLineWidth(0.4);
    doc.setDrawColor(148, 163, 184); // slate-400
    
    // Line 1
    doc.line(18, signY, 90, signY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(audit.responsavelTecnico, 18, signY + 4, { maxWidth: 72 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Responsável Técnico / Químico", 18, signY + 8);

    // Line 2
    if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
      try {
        const sigWidth = 35;
        const sigHeight = 11;
        const sigX = 138; // Center over the 120 to 192 line
        doc.addImage(appState.reportSignatureBase64, "PNG", sigX, signY - 14, sigWidth, sigHeight);
      } catch (e) {
        console.error("Error drawing signature on ANP Quality audit:", e);
      }
    }

    doc.line(120, signY, 192, signY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const signerNameANP = appState.reportSignatureName || "Assinatura do Supervisor / Gerente";
    doc.text(signerNameANP, 120, signY + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const signerRoleANP = appState.reportSignatureRole || "Responsável pela Validação";
    doc.text(signerRoleANP, 120, signY + 8);

    // Footer Page
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Documento gerado eletronicamente pelo módulo Meu Posto ERP de Controle de Qualidade ANP.`, 14, 285);
    doc.text(`ID de Autenticação: ${audit.id.toUpperCase()}`, 14, 289);

    doc.save(`laudo_qualidade_${audit.combustivel.replace(" ", "_")}_${audit.id}.pdf`);
    onAddAuditLog("DOWNLOAD", "Qualidade", `Exportou PDF do laudo de qualidade para ${audit.combustivel} (ID: ${audit.id})`, "Regular");
  };

  const handleSelectAllCalibrations = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSel: { [key: string]: boolean } = {};
      calibrations.forEach((c) => {
        newSel[c.id] = true;
      });
      setSelectedCalibrations(newSel);
    } else {
      setSelectedCalibrations({});
    }
  };

  const handleToggleSelectCalibration = (id: string) => {
    setSelectedCalibrations((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Selection handlers for Quality Audits (Laudos)
  const handleSelectAllQualityAudits = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSel: { [key: string]: boolean } = {};
      qualityAudits.forEach((a) => {
        newSel[a.id] = true;
      });
      setSelectedQualityAudits(newSel);
    } else {
      setSelectedQualityAudits({});
    }
  };

  const handleToggleSelectQualityAudit = (id: string) => {
    setSelectedQualityAudits((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Export selected Quality Audits to PDF
  const handleExportSelectedQualityAuditsPDF = () => {
    const selectedIds = Object.keys(selectedQualityAudits).filter((id) => selectedQualityAudits[id]);
    if (selectedIds.length === 0) {
      alert("Selecione ao menos um laudo na tabela abaixo para exportar.");
      return;
    }

    const rowsToExport = qualityAudits.filter((a) => selectedIds.includes(a.id));
    const doc = new jsPDF();
    const emissionDate = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

    const startX = 14;
    const endX = 196;
    const usableWidth = 182;

    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
    const reportAddress = appState.reportHeaderAddress || "";

    doc.setDrawColor(79, 70, 229);
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

    doc.setTextColor(79, 70, 229);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(reportCompName, textX, 21);

    doc.setTextColor(75, 85, 99);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`RELATÓRIO DE LAUDOS SELECIONADOS • CNPJ: ${reportCnpj}`, textX, 26);
    if (reportAddress) {
      doc.setFontSize(6.5);
      doc.text(reportAddress.length > 80 ? reportAddress.substring(0, 80) + "..." : reportAddress, textX, 30);
    }

    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`Emissão: ${emissionDate}`, endX, 24, { align: "right" });

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(startX, 33, endX, 33);

    // Title banner
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 40, 182, 14, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 40, 182, 14, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`RELATÓRIO DE QUALIDADE E NOTAS FISCAIS (${rowsToExport.length} LAUDO(S) SELECIONADO(S))`, 18, 48);

    // Table of selected quality audits
    const tableData = rowsToExport.map((a) => {
      const dt = a.data.split("-").reverse().join("/");
      const fuel = a.combustivel;
      const nfeStr = a.numeroNotaFiscal ? `${a.numeroNotaFiscal}${a.fornecedorNota ? ` - ${a.fornecedorNota}` : ""}` : "Sem Nota Vinculada";
      const d20Str = a.densidadeCorrigida ? `${a.densidadeCorrigida.toFixed(4)} g/cm³` : `${a.densidade.toFixed(4)} g/cm³`;
      const alcoholStr = a.teorEtanol !== undefined ? `${a.teorEtanol}%` : "-";
      const statusStr = a.conforme ? "CONFORME" : "REPROVADO";

      return [dt, fuel, nfeStr, d20Str, alcoholStr, statusStr, a.responsavelTecnico || "Técnico"];
    });

    autoTable(doc, {
      startY: 60,
      head: [["Data", "Combustível", "Nota Fiscal / Fornecedor", "Massa Esp. D20", "Teor", "Veredicto", "Responsável"]],
      body: tableData,
      headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 3 },
      columnStyles: {
        0: { halign: "center" },
        1: { fontStyle: "bold" },
        3: { fontStyle: "bold", halign: "right" },
        4: { halign: "center" },
        5: { halign: "center", fontStyle: "bold" },
      },
      didParseCell: function (data: any) {
        if (data.row.section === "body" && data.column.index === 5) {
          if (data.cell.text[0] === "CONFORME") {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (data.cell.text[0] === "REPROVADO") {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fillColor = [254, 242, 242];
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    const totalConformes = rowsToExport.filter((a) => a.conforme).length;
    const totalReprovados = rowsToExport.length - totalConformes;

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`RESUMO EXECUTIVO DA SELEÇÃO:`, 14, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Total de Laudos Analisados: ${rowsToExport.length}`, 14, finalY + 16);
    doc.text(`Aprovados / Conformes: ${totalConformes}`, 14, finalY + 21);
    doc.text(`Reprovados / Fora do Padrão: ${totalReprovados}`, 14, finalY + 26);

    const sigY = finalY + 45;
    if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
      try {
        const sigWidth = 40;
        const sigHeight = 12;
        const sigX = (usableWidth / 2 + startX) - (sigWidth / 2);
        doc.addImage(appState.reportSignatureBase64, "PNG", sigX, sigY - 15, sigWidth, sigHeight);
      } catch (e) {
        console.error("Error adding signature image to PDF:", e);
      }
    }

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(startX + 50, sigY, endX - 50, sigY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
    doc.text(signerName, usableWidth / 2 + startX, sigY + 4, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
    doc.text(signerRole, usableWidth / 2 + startX, sigY + 8, { align: "center" });

    doc.save(`relatorio_laudos_selecionados_${Date.now()}.pdf`);
    onAddAuditLog("DOWNLOAD", "Qualidade", `Exportou PDF com ${rowsToExport.length} laudos selecionados`, "Regular");
  };

  // Export selected Quality Audits to CSV
  const handleExportSelectedQualityAuditsCSV = () => {
    const selectedIds = Object.keys(selectedQualityAudits).filter((id) => selectedQualityAudits[id]);
    if (selectedIds.length === 0) {
      alert("Selecione ao menos um laudo na tabela abaixo para exportar.");
      return;
    }

    const rowsToExport = qualityAudits.filter((a) => selectedIds.includes(a.id));
    const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
    const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
    const reportAddress = appState.reportHeaderAddress || "";
    const emissionDate = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;

    let csvContent = "\ufeff"; // UTF-8 BOM
    csvContent += `EMPRESA:;${reportCompName}\n`;
    csvContent += `CNPJ:;${reportCnpj}\n`;
    if (reportAddress) {
      csvContent += `ENDEREÇO:;${reportAddress}\n`;
    }
    csvContent += `RELATÓRIO:;LAUDOS QUÍMICOS SELECIANADOS - EXPORTAÇÃO PLANILHA\n`;
    csvContent += `EMISSÃO:;${emissionDate}\n\n`;

    csvContent += "ID;Data;Combustivel;Nota Fiscal;Fornecedor;Densidade Medida (g/cm3);Temperatura (C);Densidade 20C (g/cm3);Teor Etanol (%);Aspecto Visual;Impurezas;Status;Responsavel\n";

    rowsToExport.forEach((a) => {
      const dt = a.data;
      const fuel = a.combustivel;
      const nfe = (a.numeroNotaFiscal || "-").replace(/;/g, ",");
      const forn = (a.fornecedorNota || "-").replace(/;/g, ",");
      const dens = a.densidade;
      const temp = a.temperatura;
      const d20 = a.densidadeCorrigida ? a.densidadeCorrigida.toFixed(4) : "";
      const alcohol = a.teorEtanol !== undefined ? a.teorEtanol : "";
      const aspecto = a.aspectoVisual;
      const imp = a.presencaImpurezas ? "SIM" : "NÃO";
      const status = a.conforme ? "CONFORME" : "REPROVADO";
      const resp = (a.responsavelTecnico || "").replace(/;/g, ",");

      csvContent += `${a.id};${dt};${fuel};${nfe};${forn};${dens};${temp};${d20};${alcohol};${aspecto};${imp};${status};${resp}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", `laudos_selecionados_${Date.now()}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);

    onAddAuditLog("DOWNLOAD", "Qualidade", `Exportou planilha com ${rowsToExport.length} laudos selecionados`, "Regular");
  };

  // Open invoice linking modal for an existing audit
  const handleOpenLinkModal = (audit: ANPQualityAudit) => {
    setLinkingAuditModal(audit);
    setLinkModalNfe(audit.numeroNotaFiscal || "");
    setLinkModalFornecedor(audit.fornecedorNota || "");
    setLinkModalDeliveryId(audit.deliveryId || "");
    setLinkModalLaudoFornecedor(audit.numeroLaudoFornecedor || "");
  };

  // Save linked invoice to audit
  const handleSaveInvoiceLinkModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkingAuditModal) return;

    const updatedAudits = qualityAudits.map((a) => {
      if (a.id === linkingAuditModal.id) {
        return {
          ...a,
          numeroNotaFiscal: linkModalNfe.trim() || undefined,
          fornecedorNota: linkModalFornecedor.trim() || undefined,
          deliveryId: linkModalDeliveryId || undefined,
          numeroLaudoFornecedor: linkModalLaudoFornecedor.trim() || undefined,
        };
      }
      return a;
    });

    onUpdateQualityAudits(updatedAudits);

    // If a delivery was selected, update its qualityAuditId
    if (linkModalDeliveryId && fuelDeliveries.length > 0) {
      const updatedDeliveries = fuelDeliveries.map((del) => {
        if (del.id === linkModalDeliveryId) {
          return {
            ...del,
            qualityAuditId: linkingAuditModal.id,
            fornecedor: linkModalFornecedor.trim() || del.fornecedor,
            nfe: linkModalNfe.trim() || del.nfe || del.invoiceNumber,
          };
        }
        return del;
      });
      onUpdateDeliveries(updatedDeliveries);
    }

    onAddAuditLog(
      "UPDATE",
      "Qualidade",
      `Vinculou Nota Fiscal ${linkModalNfe || "N/A"} ao Laudo Químico ID ${linkingAuditModal.id}`,
      "Regular"
    );

    setLinkingAuditModal(null);
    setSuccess(`Nota Fiscal e Distribuidora vinculadas com sucesso ao Laudo Químico!`);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleDeleteCalibration = (id: string) => {
    if (confirm("Deseja realmente excluir esta aferição de bico?")) {
      const filtered = calibrations.filter((c) => c.id !== id);
      onUpdateCalibrations(filtered);
      onAddAuditLog("DELETE", "Qualidade", `Excluiu aferição ID ${id}`, "Regular");
    }
  };

  const handleDeleteQualityAudit = (id: string) => {
    if (confirm("Deseja realmente excluir este laudo químico?")) {
      const filtered = qualityAudits.filter((a) => a.id !== id);
      onUpdateQualityAudits(filtered);
      onAddAuditLog("DELETE", "Qualidade", `Excluiu laudo químico ID ${id}`, "Regular");
    }
  };

  // 🔄 Recalcular correção D20 para um laudo salvo existente
  const handleRecalculateSingleAudit = (audit: ANPQualityAudit) => {
    const comp = checkFuelCompliance(
      audit.combustivel,
      Number(audit.densidade),
      Number(audit.temperatura),
      Number(audit.teorEtanol),
      audit.aspectoVisual,
      audit.presencaImpurezas
    );

    const updatedAudits = qualityAudits.map((a) => {
      if (a.id === audit.id) {
        return {
          ...a,
          densidadeCorrigida: comp.densidadeCorrigida,
          teorEtanol: comp.teorCalculadoOuEsperado,
          conforme: comp.conforme,
        };
      }
      return a;
    });

    onUpdateQualityAudits(updatedAudits);
    onAddAuditLog(
      "UPDATE",
      "Qualidade",
      `Recalculou a correção D20 (${comp.densidadeCorrigida} g/cm³) para laudo salvo ID ${audit.id} (${audit.combustivel}).`,
      "Regular"
    );

    setSuccess(`Correção D20 recalculada com sucesso! D20 a 20°C: ${comp.densidadeCorrigida.toFixed(4)} g/cm³ (${comp.conforme ? "CONFORME" : "FORA DE PADRÃO"}).`);
    setTimeout(() => setSuccess(""), 4500);
  };

  // 🔄 Recalcular em lote todas as correções de laudos salvos
  const handleRecalculateAllAudits = () => {
    if (qualityAudits.length === 0) return;

    let totalRecalculated = 0;
    const updatedAudits = qualityAudits.map((audit) => {
      const comp = checkFuelCompliance(
        audit.combustivel,
        Number(audit.densidade),
        Number(audit.temperatura),
        Number(audit.teorEtanol),
        audit.aspectoVisual,
        audit.presencaImpurezas
      );
      totalRecalculated++;
      return {
        ...audit,
        densidadeCorrigida: comp.densidadeCorrigida,
        teorEtanol: comp.teorCalculadoOuEsperado,
        conforme: comp.conforme,
      };
    });

    onUpdateQualityAudits(updatedAudits);
    onAddAuditLog(
      "UPDATE",
      "Qualidade",
      `Recalculou em lote as correções D20 de ${totalRecalculated} laudos salvos.`,
      "Regular"
    );

    setSuccess(`Todos os ${totalRecalculated} laudos salvos tiveram suas correções recalculadas e atualizadas conforme padrões ANP!`);
    setTimeout(() => setSuccess(""), 5000);
  };

  // ✏️ Abrir modal de edição para laudo salvo
  const handleOpenEditAuditModal = (audit: ANPQualityAudit) => {
    setEditingAudit(audit);
    setEditAuditData(audit.data);
    setEditAuditCombustivel(audit.combustivel);
    setEditAuditDensidade(String(audit.densidade));
    setEditAuditTemperatura(String(audit.temperatura));
    setEditAuditTeorEtanol(String(audit.teorEtanol));
    setEditAuditAspecto(audit.aspectoVisual);
    setEditAuditImpurezas(audit.presencaImpurezas);
    setEditAuditResponsavel(audit.responsavelTecnico);
  };

  // 💾 Salvar laudo editado recalculando correções automaticamente
  const handleSaveEditedAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAudit) return;

    const comp = checkFuelCompliance(
      editAuditCombustivel,
      Number(editAuditDensidade),
      Number(editAuditTemperatura),
      Number(editAuditTeorEtanol),
      editAuditAspecto,
      editAuditImpurezas
    );

    const updatedAudits = qualityAudits.map((a) => {
      if (a.id === editingAudit.id) {
        return {
          ...a,
          data: editAuditData,
          combustivel: editAuditCombustivel,
          densidade: Number(editAuditDensidade),
          temperatura: Number(editAuditTemperatura),
          densidadeCorrigida: comp.densidadeCorrigida,
          teorEtanol: comp.teorCalculadoOuEsperado,
          aspectoVisual: editAuditAspecto,
          presencaImpurezas: editAuditImpurezas,
          conforme: comp.conforme,
          responsavelTecnico: editAuditResponsavel || "Responsável Técnico",
        };
      }
      return a;
    });

    onUpdateQualityAudits(updatedAudits);
    onAddAuditLog(
      "UPDATE",
      "Qualidade",
      `Atualizou medições e recalculou a correção D20 (${comp.densidadeCorrigida} g/cm³) para laudo de ${editAuditCombustivel}. Veredicto: ${comp.conforme ? "CONFORME" : "FORA DE PADRÃO"}`,
      "Regular"
    );

    setEditingAudit(null);
    setSuccess(`Laudo salvo atualizado e recalculado com sucesso! D20 a 20°C: ${comp.densidadeCorrigida.toFixed(4)} g/cm³ (${comp.conforme ? "CONFORME" : "NÃO CONFORME"}).`);
    setTimeout(() => setSuccess(""), 4500);
  };

  // ✏️ Abrir modal de edição para carga/entrega salva
  const handleOpenEditDeliveryModal = (delivery: FuelDelivery) => {
    setEditingDelivery(delivery);
    setEditDelDate(delivery.data || delivery.date || new Date().toISOString().split("T")[0]);
    setEditDelNfe(delivery.nfe || delivery.invoiceNumber || "");
    setEditDelCombustivel(((delivery.combustivel || delivery.fuelType) as FuelType) || "Gasolina Comum");
    setEditDelVolume(String(delivery.volumeRecebido || delivery.volume || 10000));
    setEditDelPlaca(delivery.placaCaminhao || delivery.truckPlate || "");
    setEditDelMotorista(delivery.motorista || delivery.driverName || "");
    setEditDelDensidade(String(delivery.densidadeMedida || 0.7420));
    setEditDelTemperatura(String(delivery.temperaturaMedida || 23.0));
  };

  // 💾 Salvar entrega editada recalculando conformidade
  const handleSaveEditedDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;

    const dens = Number(editDelDensidade) || 0.7420;
    const temp = Number(editDelTemperatura) || 23.0;
    const comp = checkFuelCompliance(editDelCombustivel, dens, temp);

    const updatedDeliveries = fuelDeliveries.map((d) => {
      if (d.id === editingDelivery.id) {
        return {
          ...d,
          data: editDelDate,
          date: editDelDate,
          nfe: editDelNfe,
          invoiceNumber: editDelNfe,
          combustivel: editDelCombustivel,
          fuelType: editDelCombustivel,
          volumeRecebido: Number(editDelVolume),
          volume: Number(editDelVolume),
          placaCaminhao: editDelPlaca,
          truckPlate: editDelPlaca,
          motorista: editDelMotorista,
          driverName: editDelMotorista,
          densidadeMedida: dens,
          temperaturaMedida: temp,
          densidadeCorrigida: comp.densidadeCorrigida,
          conforme: comp.conforme,
        };
      }
      return d;
    });

    onUpdateDeliveries(updatedDeliveries);
    onAddAuditLog(
      "UPDATE",
      "Estoque",
      `Atualizou carga/recebimento NF-e ${editDelNfe} e recalculou conformidade D20 (${comp.densidadeCorrigida} g/cm³).`,
      "Regular"
    );

    setEditingDelivery(null);
    setSuccess(`Carga/Recebimento salvo atualizado e recalculado com sucesso! D20: ${comp.densidadeCorrigida.toFixed(4)} g/cm³.`);
    setTimeout(() => setSuccess(""), 4500);
  };

  const filteredDeliveries = fuelDeliveries.filter((d) => d.stationCnpj === cnpjPosto);

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Vazão, Qualidade e NF-e"
        titleIcon={<Thermometer className="h-5 w-5" />}
        subtitle="Controle aferições mecânicas, emita laudos químicos de conformidade ANP e dê entrada nas notas de entrega"
        activeTab={activeSubTab}
        onChange={(tabId) => setActiveSubTab(tabId as any)}
        tabs={[
          {
            id: "afericao",
            label: "Teste 20L",
            icon: <Gauge className="h-4 w-4" />,
            badge: calibrations.length,
          },
          {
            id: "laudo",
            label: "Laudo Químico",
            icon: <Thermometer className="h-4 w-4" />,
            badge: qualityAudits.length,
          },
          {
            id: "entregas",
            label: "Entregas NF-e",
            icon: <Truck className="h-4 w-4" />,
            badge: fuelDeliveries.length,
          },
          {
            id: "especificacoes_2026",
            label: "Tabela Massa Específica",
            icon: <Calculator className="h-4 w-4" />,
          },
          {
            id: "tabela_conferencia",
            label: "Tabela de Conferência",
            icon: <FileText className="h-4 w-4" />,
          },
        ]}
        rightElement={
          !isReadOnly ? (
            <button
              type="button"
              onClick={() => {
                if (onClearData) {
                  onClearData();
                } else if (confirm("Deseja apagar todos os laudos e registros de qualidade ANP?")) {
                  onUpdateQualityAudits([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Limpar laudos e testes de qualidade ANP"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Limpar Testes ANP</span>
            </button>
          ) : null
        }
      />

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      {/* RENDER ACTIVE DEPARTMENT MODULE */}
      {activeSubTab === "afericao" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Left */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-indigo-600" />
              Lançar Aferição Física
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Extraia o volume padrão do bico no galão aferidor certificado. O desvio máximo aceito pela ANP é de <strong>-100 a +100 mL</strong> (ou -0.5% a +0.5% sobre o volume medido).
            </p>

            <form onSubmit={handleCreateCalibration} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Selecione o Bico *</label>
                <select
                  required
                  value={calNozzleId}
                  onChange={(e) => setCalNozzleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="">Selecione o Bico</option>
                  {nozzles.map((n) => {
                    const tank = (appState.tanks || []).find((t) => t.id === n.tanqueId);
                    return (
                      <option key={n.id} value={n.id}>
                        Bico {n.numeroBico} ({tank ? tank.combustivel : "Sem combustível"}) - Bomba {n.bombaAssociada}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vol. Galão (L) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    required
                    value={calVolumeMedido}
                    onChange={(e) => setCalVolumeMedido(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                    placeholder="Ex: 20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desvio Manual (mL) *</label>
                  <input
                    type="number"
                    required
                    min="-120"
                    max="120"
                    step="1"
                    value={calDesvioMl}
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (val < -120) val = -120;
                      if (val > 120) val = 120;
                      setCalDesvioMl(val);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                    placeholder="De -120 a +120"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Ajustar Desvio (mL)</span>
                  <span className={`text-xs font-mono font-black ${calDesvioMl >= -100 && calDesvioMl <= 100 ? "text-emerald-600" : "text-rose-600 animate-pulse"}`}>
                    {calDesvioMl > 0 ? `+${calDesvioMl}` : calDesvioMl} mL
                  </span>
                </div>
                <input
                  type="range"
                  min="-120"
                  max="120"
                  step="1"
                  value={calDesvioMl}
                  onChange={(e) => setCalDesvioMl(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[8px] text-slate-400 font-mono font-semibold">
                  <span>-120 mL</span>
                  <span className="text-emerald-600">-100 mL</span>
                  <span>0 mL</span>
                  <span className="text-emerald-600">+100 mL</span>
                  <span>+120 mL</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Atalhos de Calibração</label>
                <div className="grid grid-cols-5 gap-1">
                  {[-120, -100, 0, 100, 120].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCalDesvioMl(val)}
                      className={`py-1 text-center rounded text-[9px] font-bold border transition cursor-pointer ${
                        calDesvioMl === val
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      {val > 0 ? `+${val}` : val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operador Responsável *</label>
                <input
                  type="text"
                  required
                  value={calOperador}
                  onChange={(e) => setCalOperador(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ex: Carlos Santos"
                />
              </div>

              {/* Status block live preview */}
              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Veredicto Rápido</p>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase ${
                    calDesvioMl >= -100 && calDesvioMl <= 100
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "bg-rose-50 text-rose-700 border border-rose-100 animate-pulse"
                  }`}
                >
                  {calDesvioMl >= -100 && calDesvioMl <= 100 ? "DENTRO DOS LIMITES (-100 a +100ml)" : "FORA DE CALIBRAÇÃO!"}
                </span>
              </div>

              <button
                type="submit"
                disabled={isReadOnly}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Salvar Aferição
              </button>
            </form>
          </div>

          {/* Table list Right */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-slate-800">Histórico de Aferição de Bicos</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPreviewModal({
                        isOpen: true,
                        reportType: "anp",
                        title: "LAUDO DE QUALIDADE ANP • AFERIÇÕES",
                        subtitle: "Aferições de vazão em bicos medidores",
                        onExportPDF: handleExportSelectedPDF,
                        onExportCSV: handleExportSelectedCSV,
                      });
                    }}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer"
                    title="Visualizar pré-visualização do laudo completo com cabeçalho e assinatura configurados"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-500" />
                    Preview
                  </button>
                  <button
                    onClick={handleExportSelectedCSV}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportSelectedPDF}
                    className="px-3 py-1.5 bg-indigo-600 border border-indigo-700 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    PDF
                  </button>
                </div>
              </div>

              {/* Cumulative summary for selected calibrations */}
              {Object.values(selectedCalibrations).filter(Boolean).length > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase block">Total Selecionado</span>
                    <span className="text-lg font-black text-indigo-700">
                      R$ {calibrations
                        .filter(c => selectedCalibrations[c.id])
                        .reduce((acc, c) => acc + (c.valorReais || 0), 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase block">Litros Totais</span>
                    <span className="text-sm font-bold text-indigo-600">
                      {calibrations
                        .filter(c => selectedCalibrations[c.id])
                        .reduce((acc, c) => acc + c.volumeMedido, 0)} L
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        onChange={handleSelectAllCalibrations}
                        className="rounded border-slate-300 h-3.5 w-3.5 text-indigo-600"
                      />
                    </th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Bico</th>
                    <th className="py-2.5 px-3">Valor (R$)</th>
                    <th className="py-2.5 px-3">Desvio Medido</th>
                    <th className="py-2.5 px-3">Veredicto</th>
                    <th className="py-2.5 px-3">Operador</th>
                    <th className="py-2.5 px-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {calibrations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">Nenhuma aferição física registrada ainda.</td>
                    </tr>
                  ) : (
                    calibrations
                      .slice()
                      .reverse()
                      .map((cal) => {
                        const b = nozzles.find((nozzle) => nozzle.id === cal.nozzleId);
                        const isChecked = !!selectedCalibrations[cal.id];
                        return (
                          <tr key={cal.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectCalibration(cal.id)}
                                className="rounded border-slate-300 h-3.5 w-3.5 text-indigo-600"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600">{cal.data.split("-").reverse().join("/")}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-800">
                                Bico {b ? b.numeroBico : "Bico Geral"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                              R$ {(cal.valorReais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {cal.desvioMl > 0 ? `+${cal.desvioMl}` : cal.desvioMl} mL
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${
                                  cal.conforme
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-rose-50 text-rose-700 border-rose-100 animate-pulse"
                                }`}
                              >
                                {cal.conforme ? "CONFORME" : "REJEITADO"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{cal.operadorResponsavel}</td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleDeleteCalibration(cal.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                title="Excluir Registro"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "laudo" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chemical Form Left */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Lançar Teste Químico ANP
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              A regulamentação ANP estabelece parâmetros químicos estritos: Gasolinas de até <strong>27%</strong> de etanol anidro, e aspecto visual transparente (límpido e isento de sedimentos/água).
            </p>

            <form onSubmit={handleCreateQualityAudit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Combustível Selecionado *</label>
                <select
                  value={qCombustivel}
                  onChange={(e) => {
                    const newFuel = e.target.value as FuelType;
                    setQCombustivel(newFuel);
                    if (newFuel === "Etanol") setQDensidade(0.809);
                    else if (newFuel.includes("Gasolina")) setQDensidade(newFuel === "Gasolina Premium" ? 0.780 : 0.742);
                    else if (newFuel.includes("Diesel")) setQDensidade(0.835);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(() => {
                  const comp = checkFuelCompliance(
                    qCombustivel,
                    Number(qDensidade),
                    Number(qTemperatura),
                    Number(qTeorEtanol),
                    qAspecto,
                    qImpurezas
                  );
                  return (
                    <div className="col-span-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Densidade Medida (g/cm³) *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowANPTableModal(true)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Table className="h-3 w-3" /> Tabela ANP
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.0001"
                          required
                          value={qDensidade}
                          onChange={(e) => setQDensidade(Number(e.target.value))}
                          className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-black transition-all ${
                            !comp.densidadeOk
                              ? "bg-rose-50 border-2 border-rose-500 text-rose-900 ring-2 ring-rose-200 animate-pulse focus:ring-rose-500"
                              : "bg-emerald-50/40 border-2 border-emerald-500/80 text-emerald-950 focus:ring-emerald-500"
                          }`}
                        />
                        <div className="absolute right-2.5 top-2.5 pointer-events-none">
                          {!comp.densidadeOk ? (
                            <AlertTriangle className="h-4 w-4 text-rose-600 animate-bounce" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                      </div>

                      {!comp.densidadeOk ? (
                        <div className="p-2 bg-rose-100/90 border border-rose-300 rounded-lg text-[10px] font-bold text-rose-800 flex items-start gap-1.5 mt-1">
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-black uppercase block text-rose-950">FORA DA MARGEM ANP 2026!</span>
                            <span>
                              D20 ({(comp.densidadeCorrigida * 1000).toFixed(1)} kg/m³) fora do permitido: <strong>{(comp.densidadeMin * 1000).toFixed(1)} a {(comp.densidadeMax * 1000).toFixed(1)} kg/m³</strong>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-semibold text-emerald-800 flex items-center gap-1.5 mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>
                            D20: {(comp.densidadeCorrigida * 1000).toFixed(1)} kg/m³ (Faixa: {(comp.densidadeMin * 1000).toFixed(1)} - {(comp.densidadeMax * 1000).toFixed(1)} kg/m³)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temperatura Medida (°C) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={qTemperatura}
                    onChange={(e) => setQTemperatura(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {qCombustivel === "Etanol" ? "Teor Alcoólico (% M/M)" : "Teor Anidro/Biodiesel (%)"}
                  </label>
                  <input
                    type="number"
                    required={qCombustivel.includes("Gasolina")}
                    disabled={qCombustivel === "Etanol" || qCombustivel.includes("Diesel")}
                    value={
                      qCombustivel === "Etanol"
                        ? checkFuelCompliance(qCombustivel, Number(qDensidade), Number(qTemperatura), Number(qTeorEtanol), qAspecto, qImpurezas).teorCalculadoOuEsperado
                        : qCombustivel.includes("Gasolina")
                          ? qTeorEtanol
                          : 0
                    }
                    onChange={(e) => setQTeorEtanol(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {qCombustivel === "Etanol" && (
                    <span className="text-[9px] text-indigo-600 font-semibold block mt-0.5">
                      Calculado via D20 (Norma ANP 92,5% - 93,8% M/M)
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Aspecto Visual</label>
                  <select
                    value={qAspecto}
                    onChange={(e) => setQAspecto(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Límpido e Isento">Límpido e Isento</option>
                    <option value="Turvo">Turvo</option>
                    <option value="Com Impurezas">Com Impurezas</option>
                  </select>
                </div>
              </div>

              {(() => {
                const comp = checkFuelCompliance(
                  qCombustivel,
                  Number(qDensidade),
                  Number(qTemperatura),
                  Number(qTeorEtanol),
                  qAspecto,
                  qImpurezas
                );
                const factor = getDensityCorrectionFactor(qCombustivel);
                
                const observedDensityKg = Number(qDensidade) * 1000;
                const correctedDensityKg = comp.densidadeCorrigida * 1000;
                const minDensityKg = comp.densidadeMin * 1000;
                const maxDensityKg = comp.densidadeMax * 1000;
                const appliedCorrectionKg = factor * observedDensityKg * (Number(qTemperatura) - 20);
                
                const displayFuelName = qCombustivel === "Gasolina Comum" || qCombustivel === "Gasolina Aditivada" 
                  ? "GASOLINA C" 
                  : qCombustivel === "Gasolina Premium" 
                    ? "GASOLINA PREMIUM C" 
                    : qCombustivel === "Etanol" 
                      ? "ETANOL EHC" 
                      : qCombustivel.toUpperCase();
                
                const anpResolution = qCombustivel === "Etanol" 
                  ? "Res. ANP 907/2022" 
                  : qCombustivel.includes("Diesel") 
                    ? "Res. ANP 968/2024" 
                    : "Res. ANP 807/2020";

                return (
                  <div className="space-y-4 pt-2">
                    {/* 1. Status Approved / Reproved Header */}
                    <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                      comp.conforme 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-rose-50 text-rose-800 border-rose-200 animate-pulse"
                    }`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        comp.conforme ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      }`}>
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider">
                          {comp.conforme ? "APROVADO" : "REPROVADO"}
                        </h4>
                        <p className="text-[10px] opacity-90 font-semibold">
                          {comp.conforme 
                            ? `Dentro das especificações ANP (${minDensityKg.toFixed(1)} - ${maxDensityKg.toFixed(1)} kg/m³)` 
                            : `Fora dos padrões regulamentares ANP (${minDensityKg.toFixed(1)} - ${maxDensityKg.toFixed(1)} kg/m³)`}
                        </p>
                      </div>
                    </div>

                    {/* 2. Fuel - Specific Gravity Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                          {displayFuelName} — MASSA ESPECÍFICA A 20°C
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-4xl font-black tracking-tight ${comp.densidadeOk ? "text-slate-900" : "text-rose-600 font-extrabold animate-pulse"}`}>
                            {correctedDensityKg.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500 font-bold">kg/m³</span>
                        </div>
                      </div>

                      {/* Slider Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/60">
                          <div className="absolute inset-y-0 left-[15%] right-[15%] bg-emerald-100/60" />
                          {(() => {
                            const range = maxDensityKg - minDensityKg;
                            const relativeVal = correctedDensityKg - minDensityKg;
                            let pct = range > 0 ? (relativeVal / range) * 70 + 15 : 50;
                            pct = Math.min(98, Math.max(2, pct));
                            return (
                              <div 
                                style={{ left: `${pct}%` }} 
                                className={`absolute -top-1 w-2.5 h-4.5 rounded-full -translate-x-1/2 transition-all duration-300 ${
                                  comp.densidadeOk 
                                    ? "bg-emerald-600 ring-2 ring-emerald-200 shadow-sm" 
                                    : "bg-rose-600 ring-2 ring-rose-200 animate-pulse"
                                }`}
                              />
                            );
                          })()}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                          <span>{minDensityKg.toFixed(1)}</span>
                          <span>{maxDensityKg.toFixed(1)} kg/m³</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Alcohol Content Card if Ethanol EHC */}
                    {qCombustivel === "Etanol" && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">
                            Grau Alcoólico (INPM)
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            comp.teorOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {comp.teorOk ? "OK" : "FORA"}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-3xl font-black tracking-tight ${comp.teorOk ? "text-slate-900" : "text-rose-600 font-extrabold"}`}>
                            {comp.teorCalculadoOuEsperado.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500 font-bold">% m/m</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          {comp.teorOk 
                            ? "Grau alcoólico dentro do especificado (mín. 92.5% m/m)" 
                            : "Grau alcoólico fora do especificado (mín. 92.5% m/m)"}
                        </p>
                      </div>
                    )}

                    {/* 4. Specifications Card (Collapsible) */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <button
                        type="button"
                        onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}
                        className="w-full px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between hover:bg-slate-100/50 transition font-bold text-slate-700"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-slate-500" />
                          Especificações ANP — {anpResolution}
                        </span>
                        {isSpecsExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </button>

                      {isSpecsExpanded && (
                        <div className="p-3.5 space-y-2 animate-in slide-in-from-top-1 duration-200">
                          <table className="w-full text-left text-[11px] text-slate-600">
                            <thead>
                              <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase">
                                <th className="pb-1.5">Parâmetro</th>
                                <th className="pb-1.5 text-right">Limite ANP</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-1.5 pr-2 font-semibold">Massa específica a 20°C (mín.)</td>
                                <td className="py-1.5 text-right font-semibold font-mono text-slate-800">{minDensityKg.toFixed(1)} kg/m³</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-1.5 pr-2 font-semibold">Massa específica a 20°C (máx.)</td>
                                <td className="py-1.5 text-right font-semibold font-mono text-slate-800">{maxDensityKg.toFixed(1)} kg/m³</td>
                              </tr>
                              {qCombustivel === "Etanol" && (
                                <>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="py-1.5 pr-2 font-semibold">Grau alcoólico (INPM) mín.</td>
                                    <td className="py-1.5 text-right font-semibold font-mono text-slate-800">92,5% m/m</td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="py-1.5 pr-2 font-semibold">Grau alcoólico (INPM) máx.</td>
                                    <td className="py-1.5 text-right font-semibold font-mono text-slate-800">93,8% m/m</td>
                                  </tr>
                                </>
                              )}
                              {qCombustivel.includes("Gasolina") && (
                                <>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="py-1.5 pr-2 font-semibold">Teor de Etanol Anidro mín.</td>
                                    <td className="py-1.5 text-right font-semibold font-mono text-slate-800">{comp.teorMin}% v/v</td>
                                  </tr>
                                  <tr className="hover:bg-slate-50/50">
                                    <td className="py-1.5 pr-2 font-semibold">Teor de Etanol Anidro máx.</td>
                                    <td className="py-1.5 text-right font-semibold font-mono text-slate-800">{comp.teorMax}% v/v</td>
                                  </tr>
                                </>
                              )}
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-1.5 pr-2 font-semibold">Temperatura de referência</td>
                                <td className="py-1.5 text-right font-semibold font-mono text-slate-800">20°C</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 5. Detailed Calculations Card (Collapsible) */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <button
                        type="button"
                        onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                        className="w-full px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between hover:bg-slate-100/50 transition font-bold text-slate-700"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                          <Thermometer className="h-4 w-4 text-slate-500" />
                          Detalhes do Cálculo
                        </span>
                        {isDetailsExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </button>

                      {isDetailsExpanded && (
                        <div className="p-3.5 space-y-3.5 text-xs text-slate-700 animate-in slide-in-from-top-1 duration-200">
                          <div className="space-y-1.5 font-semibold text-[11px]">
                            <div className="flex justify-between hover:bg-slate-50/50 py-0.5">
                              <span className="text-slate-500 font-medium">Densidade observada</span>
                              <span className="font-mono text-slate-800">{observedDensityKg.toFixed(1)} kg/m³</span>
                            </div>
                            <div className="flex justify-between hover:bg-slate-50/50 py-0.5">
                              <span className="text-slate-500 font-medium">Temperatura de medição</span>
                              <span className="font-mono text-slate-800">{Number(qTemperatura).toFixed(1)} °C</span>
                            </div>
                            <div className="flex justify-between hover:bg-slate-50/50 py-0.5">
                              <span className="text-slate-500 font-medium">Coef. expansão térmica (α)</span>
                              <span className="font-mono text-slate-800">{factor.toFixed(5)} kg/(m³·°C)</span>
                            </div>
                            <div className="flex justify-between hover:bg-slate-50/50 py-0.5">
                              <span className="text-slate-500 font-medium">Correção aplicada</span>
                              <span className="font-mono text-slate-800">{(appliedCorrectionKg >= 0 ? "+" : "")}{appliedCorrectionKg.toFixed(2)} kg/m³</span>
                            </div>
                            <div className="flex justify-between hover:bg-slate-50/50 py-0.5 border-t border-slate-100 pt-1.5">
                              <span className="text-slate-700 font-bold">Massa específica a 20°C</span>
                              <span className="font-mono font-black text-indigo-700 text-sm">{correctedDensityKg.toFixed(1)} kg/m³</span>
                            </div>
                          </div>

                          {/* Formula Box */}
                          <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl font-mono text-[10px] space-y-1">
                            <div className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Fórmula:</div>
                            <div className="text-slate-800 font-black text-[11.5px] tracking-wide text-center pt-0.5">
                              ρ₂₀ = ρt + α × ρt × (T - 20)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Locking trigger alert if failed */}
                    {!comp.conforme && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-[10px] font-semibold space-y-1 flex items-start gap-2">
                        <Lock className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <p className="uppercase font-black text-rose-700">Gatilho de Ocorrência Bloqueante:</p>
                          <p className="font-medium text-rose-800 leading-normal">
                            Ao salvar este laudo, o sistema gerará automaticamente uma <strong>Ocorrência Bloqueante</strong> na escala do turno e aplicará <strong>Bloqueio de Operação</strong> para o tanque de {qCombustivel}.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {false && (
                <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3.5 space-y-2 text-slate-700">
                  <div className="text-[10px] font-black uppercase text-sky-800 tracking-wide flex items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5 text-sky-600 animate-pulse" />
                    Cálculo Grau Alcoólico (v/v%)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight pt-1">
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-bold block">D20 Corrigida</span>
                      <span className="font-mono font-bold text-slate-800">
                        {(qDensidade + 0.00084 * (qTemperatura - 20)).toFixed(4)} g/cm³
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase font-bold block">Teor Alcoólico</span>
                      <span className={`font-mono font-black ${
                        (96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)) >= 95.1 &&
                        (96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)) <= 96.0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}>
                        {Math.min(100, Math.max(0, Number((96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)).toFixed(1))))}% v/v
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-sky-100/50 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium">Status da Portaria ANP:</span>
                    <span className={`font-black uppercase px-2 py-0.5 rounded text-[9px] ${
                      (96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)) >= 95.1 &&
                      (96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)) <= 96.0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"
                    }`}>
                      {(96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)) >= 95.1 &&
                      (96.0 - 264.7 * ((qDensidade + 0.00084 * (qTemperatura - 20)) - 0.8076)) <= 96.0
                        ? "CONFORME (95.1% - 96.0%)"
                        : "REPROVADO"
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Vínculo de Nota Fiscal / Carga */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                <label className="block text-[10px] font-bold text-indigo-900 uppercase flex items-center justify-between">
                  <span>📄 Vincular Nota Fiscal / Entrega (NF-e)</span>
                  <span className="text-[9px] font-normal text-indigo-600">Opcional</span>
                </label>
                
                {fuelDeliveries.length > 0 && (
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Cargas Cadastradas no Sistema</label>
                    <select
                      value={qDeliveryId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setQDeliveryId(id);
                        const del = fuelDeliveries.find((d) => d.id === id);
                        if (del) {
                          setQNumeroNotaFiscal(del.nfe || del.invoiceNumber || "");
                          setQFornecedorNota(del.fornecedor || "");
                          if (del.combustivel || del.fuelType) {
                            setQCombustivel((del.combustivel || del.fuelType) as FuelType);
                          }
                        }
                      }}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">Selecione uma Carga Registrada (Auto-preencher)</option>
                      {fuelDeliveries.map((del) => (
                        <option key={del.id} value={del.id}>
                          NF-e: {del.nfe || del.invoiceNumber || del.id} — {del.combustivel || del.fuelType} ({(del.volumeRecebido || del.volume || 0).toLocaleString("pt-BR")}L) — {del.data || del.date}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">N° Nota Fiscal (NF-e)</label>
                    <input
                      type="text"
                      value={qNumeroNotaFiscal}
                      onChange={(e) => setQNumeroNotaFiscal(e.target.value)}
                      placeholder="Ex: NF-e 10542"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Distribuidora / Refinaria</label>
                    <input
                      type="text"
                      value={qFornecedorNota}
                      onChange={(e) => setQFornecedorNota(e.target.value)}
                      placeholder="Ex: Vibra / Petrobras"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Químico Responsável *</label>
                <input
                  type="text"
                  required
                  value={qResponsavel}
                  onChange={(e) => setQResponsavel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ex: Roberto Silveira"
                />
              </div>

              <label className="flex items-start space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer text-[10.5px]">
                <input
                  type="checkbox"
                  checked={qImpurezas}
                  onChange={(e) => setQImpurezas(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 mt-0.5"
                />
                <span className="text-slate-600 leading-normal">Houve detecção de partículas, impurezas sólidas ou água livre na proveta de teste?</span>
              </label>

              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={isReadOnly}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Registrar Laudo Químico
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const comp = checkFuelCompliance(
                      qCombustivel,
                      Number(qDensidade),
                      Number(qTemperatura),
                      Number(qTeorEtanol),
                      qAspecto,
                      qImpurezas
                    );
                    const draftAudit: ANPQualityAudit = {
                      id: "draft_" + Date.now(),
                      data: new Date().toISOString().split("T")[0],
                      combustivel: qCombustivel,
                      densidade: Number(qDensidade),
                      temperatura: Number(qTemperatura),
                      densidadeCorrigida: comp.densidadeCorrigida,
                      teorEtanol: comp.teorCalculadoOuEsperado,
                      aspectoVisual: qAspecto,
                      presencaImpurezas: qImpurezas,
                      conforme: comp.conforme,
                      responsavelTecnico: qResponsavel || "Responsável Técnico (Rascunho)",
                      numeroNotaFiscal: qNumeroNotaFiscal || undefined,
                      fornecedorNota: qFornecedorNota || undefined,
                    };
                    handleExportAuditPDF(draftAudit);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  title="Exportar Rascunho do Laudo em PDF"
                >
                  <FileDown className="h-4 w-4 text-slate-600" />
                  PDF
                </button>
              </div>
            </form>
          </div>
 
          {/* List Right */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  Histórico de Laudos Químicos
                  <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    {qualityAudits.length} laudo(s)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Selecione laudos específicos para gerar relatórios consolidados em PDF/CSV ou vincule Notas Fiscais (NF-e).
                </p>
              </div>
              {qualityAudits.length > 0 && (
                <button
                  type="button"
                  onClick={handleRecalculateAllAudits}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-[11px] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 self-start sm:self-auto"
                  title="Recalcular correções D20 e conformidade de todos os laudos salvos"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
                  Recalcular Todos Salvos
                </button>
              )}
            </div>

            {/* Sticky Action Bar for Selected Quality Audits */}
            {Object.values(selectedQualityAudits).filter(Boolean).length > 0 && (
              <div className="p-3 bg-indigo-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2 duration-200">
                <span className="text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {Object.values(selectedQualityAudits).filter(Boolean).length} Laudo(s) Selecionado(s)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportSelectedQualityAuditsPDF}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Gerar Relatório Selecionados (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSelectedQualityAuditsCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Planilha (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQualityAudits({})}
                    className="px-2.5 py-1.5 bg-indigo-950 hover:bg-indigo-800 text-indigo-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        onChange={handleSelectAllQualityAudits}
                        checked={qualityAudits.length > 0 && Object.keys(selectedQualityAudits).filter(k => selectedQualityAudits[k]).length === qualityAudits.length}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Selecionar todos os laudos"
                      />
                    </th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Combustível</th>
                    <th className="py-2.5 px-3">Nota Fiscal / Distribuidora</th>
                    <th className="py-2.5 px-3">Métricas & D20</th>
                    <th className="py-2.5 px-3">Etanol</th>
                    <th className="py-2.5 px-3">Veredicto</th>
                    <th className="py-2.5 px-3">Resp. Técnico</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityAudits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 italic">Nenhum laudo químico emitido no sistema.</td>
                    </tr>
                  ) : (
                    qualityAudits
                      .slice()
                      .reverse()
                      .map((audit) => {
                        const isChecked = !!selectedQualityAudits[audit.id];
                        return (
                          <tr key={audit.id} className={`border-b border-slate-100 transition ${isChecked ? "bg-indigo-50/50" : "hover:bg-slate-50/40"}`}>
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectQualityAudit(audit.id)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-600">{audit.data.split("-").reverse().join("/")}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{audit.combustivel}</td>
                            <td className="py-2.5 px-3">
                              {audit.numeroNotaFiscal ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 font-bold text-indigo-700 text-[11px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    📄 {audit.numeroNotaFiscal}
                                  </span>
                                  {audit.fornecedorNota && (
                                    <div className="text-[10px] text-slate-500 font-medium">
                                      🏢 {audit.fornecedorNota}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLinkModal(audit)}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Clique para vincular uma Nota Fiscal a este Laudo"
                                >
                                  + Vincular NF-e
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                              <div>Medida: {audit.densidade.toFixed(4)} ({audit.temperatura}°C)</div>
                              <div className="font-bold text-indigo-700 text-[10.5px]">
                                D20: {audit.densidadeCorrigida ? audit.densidadeCorrigida.toFixed(4) : calculateD20(audit.densidade, audit.temperatura, audit.combustivel).toFixed(4)} g/cm³
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {audit.combustivel.includes("Gasolina") ? `${audit.teorEtanol}% v/v` : audit.combustivel === "Etanol" ? `${audit.teorEtanol}% M/M` : "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${
                                  audit.conforme
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-rose-50 text-rose-700 border-rose-100 animate-pulse"
                                }`}
                              >
                                {audit.conforme ? "APROVADO" : "FORA DE PADRÃO"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{audit.responsavelTecnico}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenLinkModal(audit)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Vincular/Editar Nota Fiscal"
                                >
                                  📄
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecalculateSingleAudit(audit)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Recalcular Correção D20 Instantaneamente"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAuditModal(audit)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="Editar & Recalcular Medições do Laudo Salvo"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportAuditPDF(audit)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Exportar Laudo em PDF"
                                >
                                  <FileDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQualityAudit(audit.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Excluir Registro"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "entregas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Carga Form Left */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-indigo-600" />
              Entrada de Carga (NF-e)
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Registre a chegada de caminhões-tanques da distribuidora. Faça o laudo de amostragem na proveta do combustível antes de descarregar o produto no tanque correto.
            </p>

            <form onSubmit={handleCreateDelivery} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Recebimento</label>
                  <input
                    type="date"
                    required
                    value={delDate}
                    onChange={(e) => setDelDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chave NF-e / ID *</label>
                  <input
                    type="text"
                    required
                    value={delNfe}
                    onChange={(e) => setDelNfe(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                    placeholder="Ex: 549382"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Combustível</label>
                  <select
                    value={delCombustivel}
                    onChange={(e) => setDelCombustivel(e.target.value as FuelType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer font-semibold"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Volume (L) *</label>
                  <input
                    type="number"
                    required
                    value={delVolume}
                    onChange={(e) => setDelVolume(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Placa Caminhão</label>
                  <input
                    type="text"
                    required
                    value={delPlaca}
                    onChange={(e) => setDelPlaca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: ABC-1234"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motorista</label>
                  <input
                    type="text"
                    required
                    value={delMotorista}
                    onChange={(e) => setDelMotorista(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Roberto Silveira"
                  />
                </div>
              </div>

              {/* Delivery Densidade Test & Visual Validation */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-700 flex items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5" /> Teste de Densidade na Descarga
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowANPTableModal(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Table className="h-3 w-3" /> Tabela ANP
                  </button>
                </div>

                {(() => {
                  const delComp = checkFuelCompliance(
                    delCombustivel,
                    delDensidade,
                    delTemperatura,
                    27,
                    "Límpido e Isento",
                    false
                  );

                  return (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                            Densidade Amostra (g/cm³)
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={delDensidade}
                            onChange={(e) => setDelDensidade(Number(e.target.value))}
                            className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono font-black ${
                              !delComp.densidadeOk
                                ? "bg-rose-50 border-2 border-rose-500 text-rose-900 ring-2 ring-rose-200 animate-pulse"
                                : "bg-emerald-50/50 border border-emerald-500 text-emerald-950"
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                            Temperatura (°C)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={delTemperatura}
                            onChange={(e) => setDelTemperatura(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                          />
                        </div>
                      </div>

                      {!delComp.densidadeOk ? (
                        <div className="p-2 bg-rose-100 border border-rose-300 rounded-lg text-[10px] font-bold text-rose-900 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          <span>
                            D20 Carga: {(delComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³ — <strong>FORA DA MARGEM ANP!</strong> (Permitido: {(delComp.densidadeMin * 1000).toFixed(1)} - {(delComp.densidadeMax * 1000).toFixed(1)} kg/m³)
                          </span>
                        </div>
                      ) : (
                        <div className="p-1.5 bg-emerald-100/70 border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>D20 Carga: {(delComp.densidadeCorrigida * 1000).toFixed(1)} kg/m³ — Carga Aprovada ANP 2026</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <button
                type="submit"
                disabled={isReadOnly}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Dar Entrada na Carga NF-e
              </button>
            </form>
          </div>

          {/* List Deliveries Right */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-800">Cargas e Recebimentos de Combustíveis</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreviewModal({
                      isOpen: true,
                      reportType: "deliveries",
                      title: "RELATÓRIO DE COMBUSTÍVEIS DESCARREGADOS (ENTREGAS NF-E)",
                      subtitle: "Histórico completo de recebimento de combustíveis e notas fiscais",
                      onExportPDF: handleExportDeliveriesPDF,
                      onExportCSV: handleExportDeliveriesCSV,
                    });
                  }}
                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer"
                  title="Visualizar pré-visualização do relatório de descarregamentos"
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  Preview
                </button>
                <button
                  onClick={handleExportDeliveriesCSV}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
                <button
                  onClick={handleExportDeliveriesPDF}
                  className="px-3 py-1.5 bg-emerald-600 border border-emerald-700 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-xl transition flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">NF-e</th>
                    <th className="py-2.5 px-3">Combustível</th>
                    <th className="py-2.5 px-3">Volume Recebido</th>
                    <th className="py-2.5 px-3">Motorista / Placa</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">Nenhum recebimento de carga registrado.</td>
                    </tr>
                  ) : (
                    filteredDeliveries
                      .slice()
                      .reverse()
                      .map((d) => (
                        <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{d.data.split("-").reverse().join("/")}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">#{d.nfe}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{d.combustivel}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {d.volumeRecebido.toLocaleString("pt-BR")} L
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {d.motorista} ({d.placaCaminhao})
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditDeliveryModal(d)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                title="Editar e Recalcular Carga Salva"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDelivery(d.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Remover Carga"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "especificacoes_2026" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-indigo-800/40 shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Tabela de Referência Oficial ANP 2026
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Lei nº 14.993/2024
                  </span>
                </div>
                <h3 className="text-xl font-black mt-2 text-white font-display flex items-center gap-2">
                  <Table className="h-6 w-6 text-indigo-400" />
                  Consulta de Massa Específica (D20) para Produtos ANP
                </h3>
                <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                  Tabela técnica oficial com limites de tolerância de massa específica a 20°C (g/cm³ e kg/m³), teores de etanol/biodiesel, octanagem e enxofre para todos os combustíveis comercializados no Brasil em 2026.
                </p>
              </div>

              {/* PDF & Export Options */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const doc = new jsPDF();
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(14);
                    doc.text("TABELA OFICIAL DE MASSA ESPECÍFICA DE COMBUSTÍVEIS (D20)", 14, 18);
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.text(`ANP & Regulamentações Vigentes (2026) • Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 14, 24);

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

                    doc.save("Tabela_Massa_Especifica_ANP_2026.pdf");
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Baixar Tabela PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Density & Temperature Verification Calculator */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-800 font-display">
                  Calculadora e Verificador Instantâneo de Massa Específica (D20)
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                Fórmula ABNT / NBR 5992: D20 = Dt + f × (t - 20)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Combustível a Testar
                </label>
                <select
                  value={densityCalcFuel}
                  onChange={(e) => setDensityCalcFuel(e.target.value as FuelType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Densidade Medida (g/cm³)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.6000"
                  max="0.9500"
                  value={densityCalcMeas}
                  onChange={(e) => setDensityCalcMeas(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Temperatura da Amostra (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="45"
                  value={densityCalcTemp}
                  onChange={(e) => setDensityCalcTemp(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Calculator Output */}
              {(() => {
                const comp = checkFuelCompliance(densityCalcFuel, densityCalcMeas, densityCalcTemp, 27, "Límpido e Isento", false);
                return (
                  <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    comp.conforme ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        D20 Corrigida:
                      </span>
                      <span className="text-sm font-black font-mono">
                        {comp.densidadeCorrigida.toFixed(4).replace(".", ",")} g/cm³
                      </span>
                      <span className="text-[10px] block font-mono">
                        ({(comp.densidadeCorrigida * 1000).toFixed(1).replace(".", ",")} kg/m³)
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-md border ${
                        comp.conforme ? "bg-emerald-600 text-white border-emerald-700" : "bg-rose-600 text-white border-rose-700"
                      }`}>
                        {comp.conforme ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> CONFORME
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" /> REPROVADO
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Search and Category Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Categoria:
              </span>
              {(["Todos", "Gasolinas", "Etanol", "Diesel", "Outros"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setDensityCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    densityCategoryFilter === cat
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar combustível, norma ou densidade..."
                value={densitySearchTerm}
                onChange={(e) => setDensitySearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Main Specific Gravity Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Tabela Oficial de Limites de Massa Específica D20 (20°C)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Valores regulamentares mínimos e máximos aceitos em fiscalizações da ANP e órgãos estaduais
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                Resoluções ANP 807/20, 907/22, 968/24 e Lei 14.993/24
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                    <th className="p-3.5 pl-5">Combustível / Produto ANP</th>
                    <th className="p-3.5">Resolução / Norma</th>
                    <th className="p-3.5 text-center bg-indigo-50/60 text-indigo-900 border-x border-indigo-100">
                      Massa Específica (g/cm³)
                    </th>
                    <th className="p-3.5 text-center bg-slate-200/50 text-slate-900">
                      Massa Específica (kg/m³)
                    </th>
                    <th className="p-3.5">Especificações / Mistura Obrigatória</th>
                    <th className="p-3.5 text-center">Enxofre Máx.</th>
                    <th className="p-3.5 text-right pr-5">Status 2026</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
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
                      aspectoPadrao: "Límpido e Isento",
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
                      aspectoPadrao: "Límpido e Isento",
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
                      aspectoPadrao: "Límpido e Isento",
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
                      aspectoPadrao: "Límpido, incolor e sem sedimentos",
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
                      aspectoPadrao: "Límpido e Isento",
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
                      aspectoPadrao: "Límpido e Isento (Amarelo claro)",
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
                      aspectoPadrao: "Límpido e Isento",
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
                      aspectoPadrao: "Límpido (Corante Vermelho)",
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
                      aspectoPadrao: "Límpido e Cristalino",
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
                      aspectoPadrao: "Límpido / Ligeiramente Turvo",
                      status2026: "Vigente",
                      badgeColor: "bg-cyan-50 text-cyan-800 border-cyan-200",
                    }
                  ]
                    .filter((item) => {
                      // Category Filter
                      if (densityCategoryFilter !== "Todos" && item.categoria !== densityCategoryFilter) {
                        return false;
                      }
                      // Text Search Filter
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
                    })
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 pl-5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${item.badgeColor}`}>
                              {item.nome}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-500 font-medium text-[11px]">
                          {item.resolucaoANP}
                        </td>
                        <td className="p-3.5 text-center bg-indigo-50/30 border-x border-indigo-100/50">
                          <span className="font-mono font-black text-indigo-900 text-xs">
                            {item.d20MinGcm3} a {item.d20MaxGcm3}
                          </span>
                        </td>
                        <td className="p-3.5 text-center bg-slate-100/40">
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {item.d20MinKgm3} a {item.d20MaxKgm3}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600 text-[11px]">
                          <div>
                            <span className="font-semibold block text-slate-800">{item.misturaAdicional}</span>
                            <span className="text-[10px] text-slate-400 block">{item.octanagemOuFulgor}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-slate-700 text-xs">
                          {item.enxofreMax}
                        </td>
                        <td className="p-3.5 text-right pr-5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> {item.status2026}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Regulatory Technical Notes & Tolerances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wide flex items-center gap-2 pb-2 border-b border-slate-800">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Procedimento de Medição com Termodensímetro
              </h4>
              <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
                <p>
                  <strong>1. Amostragem em Proveta de Vidro:</strong> Limpe a proveta e colete a amostra diretamente do bico de abastecimento evitando formação de bolhas.
                </p>
                <p>
                  <strong>2. Leitura do Densímetro e Termômetro:</strong> Insira o densímetro de vidro e o termômetro certificado pela ANP e aguarde a estabilização térmica por no mínimo 2 minutos.
                </p>
                <p>
                  <strong>3. Correção de Temperatura para 20°C:</strong> Aplique o fator de correção da tabela ABNT/NBR 5992 para converter a densidade lida à temperatura ambiente para a densidade padrão D20.
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2 pb-2 border-b border-slate-100">
                <Info className="h-4 w-4 text-indigo-600" />
                Exigências de Fiscalização e Lacres de Segurança
              </h4>
              <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
                <p>
                  • <strong>Amostra Testemunha:</strong> Todo posto revendedor é obrigado a manter frasco de 1 Litro com lacre numerado ANP de cada amostra recebida do caminhão tanque pelo prazo mínimo de 3 (três) dias.
                </p>
                <p>
                  • <strong>LMC Eletrônico:</strong> Os valores de massa específica D20 obtidos no teste de recebimento devem ser transcritos no Livro Movimentação de Combustíveis (LMC).
                </p>
                <p>
                  • <strong>Termodensímetro de Bico:</strong> Para Etanol Hidratado, o termodensímetro acoplado na bomba deve indicar o nível do flutuador rigorosamente na faixa vermelha/verde de conformidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "tabela_conferencia" && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-indigo-800/40 shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="px-2.5 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest rounded-full">
                  Mapeamento de Resultados ANP 2026
                </span>
                <h3 className="text-xl font-black mt-2 text-white font-display flex items-center gap-2">
                  <Table className="h-6 w-6 text-indigo-400" />
                  Tabela Completa de Conferência e Cruzamento de Dados
                </h3>
                <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                  Cruze a densidade medida com a temperatura para conferir instantaneamente a massa específica a 20°C (D20) e o veredicto de conformidade. Clique em qualquer célula para preencher o formulário de laudo.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[200px] max-w-md">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Combustível para Consulta</label>
                <select
                  value={qCombustivel}
                  onChange={(e) => setQCombustivel(e.target.value as FuelType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Unidade da Massa Específica</label>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDensityUnit("g/cm3")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      densityUnit === "g/cm3" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    g/cm³
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensityUnit("kg/m3")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      densityUnit === "kg/m3" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    kg/m³
                  </button>
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            {(() => {
              // Generate ranges centered around limits for the selected fuel
              let minD = 0.7100;
              let maxD = 0.7800;
              let stepD = 0.0050; // default for Gasolina
              
              if (qCombustivel === "Etanol") {
                minD = 0.8000;
                maxD = 0.8200;
                stepD = 0.0010;
              } else if (qCombustivel.includes("Gasolina")) {
                minD = qCombustivel === "Gasolina Premium" ? 0.7600 : 0.7100;
                maxD = qCombustivel === "Gasolina Premium" ? 0.8100 : 0.7800;
                stepD = 0.0030;
              } else if (qCombustivel.includes("Diesel")) {
                minD = 0.8100;
                maxD = qCombustivel === "Diesel S500" ? 0.8700 : 0.8600;
                stepD = 0.0030;
              }

              const densities: number[] = [];
              for (let d = minD; d <= maxD; d += stepD) {
                densities.push(Number(d.toFixed(4)));
              }

              // Temperatures from 15°C to 40°C (with steps of 2°C)
              const temps: number[] = [];
              for (let t = 15; t <= 39; t += 2) {
                temps.push(t);
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-3 px-3 text-left font-black text-slate-500 bg-slate-100 uppercase text-[10px] border-r border-slate-200 min-w-[130px]">
                          Dens. Observada / Temp
                        </th>
                        {temps.map((t) => (
                          <th key={t} className="py-3 px-1.5 font-bold text-slate-700 font-mono text-[10.5px]">
                            {t}°C
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {densities.map((dVal) => (
                        <tr key={dVal} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800 bg-slate-50 border-r border-slate-200 font-mono">
                            {densityUnit === "g/cm3" ? dVal.toFixed(4).replace(".", ",") : (dVal * 1000).toFixed(0)} {densityUnit === "g/cm3" ? "g/cm³" : "kg/m³"}
                          </td>
                          {temps.map((tVal) => {
                            const correctedD20 = calculateD20(dVal, tVal, qCombustivel);
                            const comp = checkFuelCompliance(qCombustivel, dVal, tVal, 27, "Límpido e Isento", false);
                            
                            return (
                              <td
                                key={tVal}
                                onClick={() => {
                                  setQDensidade(dVal);
                                  setQTemperatura(tVal);
                                  setActiveSubTab("laudo");
                                }}
                                className={`py-2 px-1 font-mono text-[11px] cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:z-10 transition border-r border-slate-100 last:border-r-0 ${
                                  comp.conforme
                                    ? "bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/70"
                                    : "bg-rose-50/50 text-rose-800 hover:bg-rose-100/70"
                                }`}
                                title={`Clique para preencher laudo com esta medição.\nD20: ${correctedD20.toFixed(4)} g/cm³ (${comp.conforme ? "CONFORME" : "REPROVADO"})`}
                              >
                                <div className="font-extrabold text-[10.5px]">
                                  {densityUnit === "g/cm3" ? correctedD20.toFixed(4).replace(".", ",") : (correctedD20 * 1000).toFixed(1).replace(".", ",")}
                                </div>
                                <div className="text-[8.5px] opacity-75 font-semibold">
                                  {comp.conforme ? "✓ Conforme" : "✗ Fora"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-200 inline-block" />
                  Combustível Conforme
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-3.5 h-3.5 rounded bg-rose-50 border border-rose-200 inline-block" />
                  Combustível Fora dos Limites ANP
                </span>
              </div>
              <p className="font-medium italic">
                * Toque em qualquer célula para preencher automaticamente o Laudo Químico oficial.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Modal de Edição & Recálculo de Laudo Químico Salvo */}
      {editingAudit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Editar & Recalcular Laudo Salvo</h3>
                  <p className="text-xs text-slate-400">Atualize dados de amostragem e recalcule a D20 a 20°C</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAudit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditedAudit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data do Laudo</label>
                  <input
                    type="date"
                    required
                    value={editAuditData}
                    onChange={(e) => setEditAuditData(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Combustível</label>
                  <select
                    value={editAuditCombustivel}
                    onChange={(e) => setEditAuditCombustivel(e.target.value as FuelType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dens. Lida (g/cm³)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editAuditDensidade}
                    onChange={(e) => setEditAuditDensidade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp. Lida (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editAuditTemperatura}
                    onChange={(e) => setEditAuditTemperatura(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teor Etanol (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editAuditTeorEtanol}
                    onChange={(e) => setEditAuditTeorEtanol(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: 27"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Aspecto Visual</label>
                  <select
                    value={editAuditAspecto}
                    onChange={(e) => setEditAuditAspecto(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Límpido e Isento">Límpido e Isento de Impurezas</option>
                    <option value="Turvo">Turvo</option>
                    <option value="Com Impurezas">Com Impurezas Visíveis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Responsável Técnico</label>
                  <input
                    type="text"
                    value={editAuditResponsavel}
                    onChange={(e) => setEditAuditResponsavel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editImpurezasCheck"
                  checked={editAuditImpurezas}
                  onChange={(e) => setEditAuditImpurezas(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="editImpurezasCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Detectou presença de água livre ou partículas em suspensão
                </label>
              </div>

              {/* Live Recalculation Preview Box */}
              {(() => {
                const dNum = Number(editAuditDensidade) || 0;
                const tNum = Number(editAuditTemperatura) || 0;
                const eNum = Number(editAuditTeorEtanol) || 0;
                const comp = checkFuelCompliance(editAuditCombustivel, dNum, tNum, eNum, editAuditAspecto, editAuditImpurezas);

                return (
                  <div className={`p-4 rounded-xl border space-y-2 ${
                    comp.conforme ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" : "bg-rose-50/70 border-rose-200 text-rose-950"
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5">
                        <Calculator className="h-4 w-4" />
                        Resultado da Correção Recalculada (D20)
                      </span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        comp.conforme ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-rose-100 border-rose-300 text-rose-800 animate-pulse"
                      }`}>
                        {comp.conforme ? "✓ APROVADO (CONFORME)" : "🚨 FORA DE PADRÃO"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] text-slate-500 font-bold block">Massa Específica D20 (20°C):</span>
                        <span className="font-mono font-black text-sm text-indigo-900">
                          {comp.densidadeCorrigida.toFixed(4)} g/cm³
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          ({(comp.densidadeCorrigida * 1000).toFixed(1)} kg/m³)
                        </span>
                      </div>

                      <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                        <span className="text-[10px] text-slate-500 font-bold block">Faixa ANP Exigida:</span>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {comp.densidadeMin.toFixed(4)} a {comp.densidadeMax.toFixed(4)} g/cm³
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Teor: {comp.teorCalculadoOuEsperado.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {!comp.conforme && (
                      <p className="text-[11px] text-rose-700 font-medium pt-1">
                        <strong>Motivo:</strong> {comp.mensagem}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAudit(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Salvar e Atualizar Correção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ Modal de Edição & Recálculo de Carga Salva */}
      {editingDelivery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Editar Carga & Recalcular Teste</h3>
                  <p className="text-xs text-slate-400">Atualize dados da NF-e e o laudo de recebimento</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDelivery(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditedDelivery} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={editDelDate}
                    onChange={(e) => setEditDelDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NF-e / Chave</label>
                  <input
                    type="text"
                    required
                    value={editDelNfe}
                    onChange={(e) => setEditDelNfe(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Combustível</label>
                  <select
                    value={editDelCombustivel}
                    onChange={(e) => setEditDelCombustivel(e.target.value as FuelType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Volume (L)</label>
                  <input
                    type="number"
                    required
                    value={editDelVolume}
                    onChange={(e) => setEditDelVolume(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Placa Caminhão</label>
                  <input
                    type="text"
                    value={editDelPlaca}
                    onChange={(e) => setEditDelPlaca(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motorista</label>
                  <input
                    type="text"
                    value={editDelMotorista}
                    onChange={(e) => setEditDelMotorista(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Densidade Medida (g/cm³)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editDelDensidade}
                    onChange={(e) => setEditDelDensidade(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Temp. Medida (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editDelTemperatura}
                    onChange={(e) => setEditDelTemperatura(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* D20 Recalculated Box */}
              {(() => {
                const d = Number(editDelDensidade) || 0.7420;
                const t = Number(editDelTemperatura) || 23.0;
                const comp = checkFuelCompliance(editDelCombustivel, d, t);
                return (
                  <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Correção D20 Recalculada</span>
                      <span className="font-mono font-black text-indigo-900 text-sm">{comp.densidadeCorrigida.toFixed(4)} g/cm³</span>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                      comp.conforme ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-rose-100 border-rose-300 text-rose-800"
                    }`}>
                      {comp.conforme ? "CONFORME ANP" : "NÃO CONFORME"}
                    </span>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Salvar e Atualizar Carga
                </button>
              </div>
            </form>
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

      {/* Official ANP Table Modal */}
      <ANPOfficialTableModal
        isOpen={showANPTableModal}
        onClose={() => setShowANPTableModal(false)}
        initialFuel={qCombustivel}
      />

      {/* Modal Vincular Nota Fiscal ao Laudo */}
      {linkingAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                📄 Vincular Nota Fiscal (NF-e) ao Laudo
              </h3>
              <button
                type="button"
                onClick={() => setLinkingAuditModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-1">
              <div><strong>Combustível:</strong> {linkingAuditModal.combustivel}</div>
              <div><strong>Data do Teste:</strong> {linkingAuditModal.data.split("-").reverse().join("/")}</div>
              <div><strong>D20:</strong> {linkingAuditModal.densidadeCorrigida ? linkingAuditModal.densidadeCorrigida.toFixed(4) : linkingAuditModal.densidade.toFixed(4)} g/cm³</div>
            </div>

            <form onSubmit={handleSaveInvoiceLinkModal} className="space-y-4">
              {fuelDeliveries.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Selecionar Carga Cadastrada
                  </label>
                  <select
                    value={linkModalDeliveryId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setLinkModalDeliveryId(id);
                      const del = fuelDeliveries.find((d) => d.id === id);
                      if (del) {
                        setLinkModalNfe(del.nfe || del.invoiceNumber || "");
                        setLinkModalFornecedor(del.fornecedor || "");
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione para vincular automaticamente</option>
                    {fuelDeliveries.map((del) => (
                      <option key={del.id} value={del.id}>
                        NF-e: {del.nfe || del.invoiceNumber || del.id} — {del.combustivel || del.fuelType} ({(del.volumeRecebido || del.volume || 0).toLocaleString("pt-BR")}L)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Número da Nota Fiscal (NF-e) *
                </label>
                <input
                  type="text"
                  required
                  value={linkModalNfe}
                  onChange={(e) => setLinkModalNfe(e.target.value)}
                  placeholder="Ex: NF-e 10542"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Distribuidora / Refinaria / Fornecedor
                </label>
                <input
                  type="text"
                  value={linkModalFornecedor}
                  onChange={(e) => setLinkModalFornecedor(e.target.value)}
                  placeholder="Ex: Vibra / Raízen / Ipiranga"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  N° do Laudo de Qualidade do Fornecedor (Opcional)
                </label>
                <input
                  type="text"
                  value={linkModalLaudoFornecedor}
                  onChange={(e) => setLinkModalLaudoFornecedor(e.target.value)}
                  placeholder="Ex: L-88942-A"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLinkingAuditModal(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                >
                  Salvar Vínculo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
