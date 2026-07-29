/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { UserRole, EscalaPattern, ShiftSchedule, User } from "../types";
import {
  Sparkles,
  Camera,
  UploadCloud,
  FileSpreadsheet,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Zap,
  Info,
  ShieldAlert,
  Brain,
  FileText,
} from "lucide-react";

export interface AIRecognizedUserItem {
  id: string;
  nomeCompleto: string;
  cargo: UserRole;
  email: string;
  telefone: string;
  isExisting: boolean;
  selected: boolean;
}

export interface MatrixStats {
  diasEncontrados: number;
  funcionariosEncontrados: number;
  registrosEsperados: number;
  registrosImportados: number;
  isComplete: boolean;
  statusText: string;
  interruptedAtDay?: string;
  diasList: string[];
  funcionariosList: string[];
}

export interface ValidationReport {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  duplicatesCount: number;
  invalidDatesCount: number;
  matrixStats: MatrixStats;
}

export interface AIRecognizedModalData {
  imagePreview?: string;
  documentName?: string;
  documentType?: "image" | "pdf" | "spreadsheet" | "sample";
  monthAndYear?: { mes: number; ano: number };
  recognizedUsers: AIRecognizedUserItem[];
  schedules: any[];
  events: any[];
  learnedPatterns?: EscalaPattern[];
  validationReport: ValidationReport;
}

interface OCRPlannerImporterProps {
  cnpjPosto: string;
  users: User[];
  existingShifts: ShiftSchedule[];
  activeMonth: { name: string; days: number; offset: number; year: number; monthNum: number };
  onConfirmImport: (data: {
    recognizedUsers: AIRecognizedUserItem[];
    schedules: any[];
    events: any[];
    learnedPatterns: EscalaPattern[];
  }) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  className?: string;
}

/**
 * Validates shift schedules to prevent conflicts, duplicate assignments, invalid dates, and matrix completeness.
 */
export function validateScheduleEntries(
  schedules: any[],
  users: User[],
  activeYear: number,
  activeMonthNum: number,
  totalDaysInMonth: number = 31
): ValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];
  let duplicatesCount = 0;
  let invalidDatesCount = 0;

  // Filter out non-employee schedules like "Evento Geral"
  const validSchedules = (schedules || []).filter(
    (s) => s.frentistaResponsavel && typeof s.frentistaResponsavel === "string" && s.frentistaResponsavel.trim().toLowerCase() !== "evento geral"
  );

  // Collect distinct employees found in the schedules (fallback to registered users if empty)
  const employeeNamesSet = new Set<string>();
  validSchedules.forEach((s) => {
    const name = s.frentistaResponsavel.trim();
    if (name) employeeNamesSet.add(name);
  });
  if (employeeNamesSet.size === 0 && users && users.length > 0) {
    users.forEach((u) => {
      if (u.nomeCompleto) employeeNamesSet.add(u.nomeCompleto.trim());
    });
  }
  const funcionariosList = Array.from(employeeNamesSet);
  const funcionariosEncontrados = funcionariosList.length;

  // Collect distinct dates
  const datesSet = new Set<string>();
  validSchedules.forEach((s) => {
    const dStr = String(s.data || s.dayOfWeek || "").trim();
    if (dStr) datesSet.add(dStr);
  });

  const sortedDates = Array.from(datesSet).sort();
  const diasEncontrados = sortedDates.length > 0 ? sortedDates.length : totalDaysInMonth;

  const registrosEsperados = diasEncontrados * funcionariosEncontrados;
  const registrosImportados = validSchedules.length;

  // Check matrix completeness for every day x employee
  const gridMap = new Set<string>();
  validSchedules.forEach((sch) => {
    const empName = (sch.frentistaResponsavel || "").trim().toLowerCase();
    const dStr = String(sch.data || sch.dayOfWeek || "").trim();
    gridMap.add(`${dStr}_${empName}`);
  });

  let interruptedAtDay: string | undefined = undefined;
  if (sortedDates.length > 0 && funcionariosList.length > 0) {
    for (const dStr of sortedDates) {
      for (const emp of funcionariosList) {
        const key = `${dStr}_${emp.toLowerCase()}`;
        if (!gridMap.has(key)) {
          interruptedAtDay = dStr;
          break;
        }
      }
      if (interruptedAtDay) break;
    }
  }

  const isComplete = registrosImportados === registrosEsperados && registrosEsperados > 0 && !interruptedAtDay;

  let statusText = "";
  if (isComplete) {
    statusText = "✓ Importação completa";
  } else if (interruptedAtDay) {
    statusText = `❌ Importação incompleta — Leitura interrompida no dia ${interruptedAtDay}`;
  } else {
    statusText = `❌ Importação incompleta — Esperados ${registrosEsperados}, importados ${registrosImportados}`;
  }

  const matrixStats: MatrixStats = {
    diasEncontrados,
    funcionariosEncontrados,
    registrosEsperados,
    registrosImportados,
    isComplete,
    statusText,
    interruptedAtDay,
    diasList: sortedDates,
    funcionariosList,
  };

  if (!isComplete) {
    errors.push(
      `Importação incompleta da matriz de escala: Foram importados ${registrosImportados} de ${registrosEsperados} registros esperados (${diasEncontrados} dias x ${funcionariosEncontrados} funcionários). ${statusText}`
    );
  }

  // Track map: "date_employeeName" -> array of shifts
  const empDateMap = new Map<string, string[]>();

  schedules.forEach((sch, index) => {
    const empName = (sch.frentistaResponsavel || sch.funcionario || "").trim();
    const dateStr = sch.data || sch.dayOfWeek || "";
    const shift = sch.turno || sch.shift || "Manhã (06h - 14h)";

    if (!empName || empName.toLowerCase() === "evento geral") return;

    if (dateStr.includes("-")) {
      const [y, m, d] = dateStr.split("-").map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
        errors.push(`Data inválida encontrada na linha #${index + 1}: ${dateStr}`);
        invalidDatesCount++;
      } else if (y !== activeYear || m !== activeMonthNum) {
        warnings.push(`Plantão de ${empName} (${dateStr}) pertence a mês/ano diferente do selecionado (${activeMonthNum}/${activeYear}).`);
      }
    }

    const key = `${dateStr.toLowerCase()}_${empName.toLowerCase()}`;
    if (!empDateMap.has(key)) {
      empDateMap.set(key, [shift]);
    } else {
      const existingShifts = empDateMap.get(key)!;
      if (!shift.toLowerCase().includes("folga") && existingShifts.some(s => !s.toLowerCase().includes("folga"))) {
        errors.push(`Conflito de duplicidade: ${empName} possui mais de 1 turno de trabalho agendado em ${dateStr}.`);
        duplicatesCount++;
      }
      existingShifts.push(shift);
    }
  });

  // Consecutive work days check
  const empConsecutiveMap = new Map<string, number>();
  const sortedSchedules = [...schedules].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  
  sortedSchedules.forEach((sch) => {
    const empName = (sch.frentistaResponsavel || "").trim();
    const shift = sch.turno || "";
    if (!empName) return;

    const currentCount = empConsecutiveMap.get(empName) || 0;
    if (shift.toLowerCase().includes("folga")) {
      empConsecutiveMap.set(empName, 0);
    } else {
      const newCount = currentCount + 1;
      empConsecutiveMap.set(empName, newCount);
      if (newCount === 7) {
        warnings.push(`Aviso de DSR: ${empName} possui 7 dias de trabalho sem folga intermediária. Recomenda-se alocar DSR.`);
      }
    }
  });

  return {
    isValid: errors.length === 0 && isComplete,
    warnings,
    errors,
    duplicatesCount,
    invalidDatesCount,
    matrixStats,
  };
}

export default function OCRPlannerImporter({
  cnpjPosto,
  users,
  existingShifts,
  activeMonth,
  onConfirmImport,
  onAddAuditLog,
  className = "",
}: OCRPlannerImporterProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [modalData, setModalData] = useState<AIRecognizedModalData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = async (e: React.ChangeEvent<HTMLInputElement>, sourceType: "photo" | "pdf" | "spreadsheet") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    onAddAuditLog("IMPORT", "OCR Escala", `Analisando arquivo de escala (${file.name}) com IA Gemini 3.6`, "Regular");

    try {
      let requestBody: any = {};
      let previewUrl = "";

      const isTextOrCsv =
        file.name.endsWith(".csv") ||
        file.name.endsWith(".txt") ||
        file.type.includes("csv") ||
        file.type.includes("text");

      if (isTextOrCsv) {
        const textContent = await file.text();
        requestBody = { textContent };
        previewUrl = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='300' viewBox='0 0 600 300'><rect width='600' height='300' fill='%230f172a'/><text x='300' y='60' fill='%2338bdf8' font-family='sans-serif' font-size='18' font-weight='bold' text-anchor='middle'>📊 PLANILHA / DOCUMENTO TEXTO</text><text x='300' y='100' fill='%2394a3b8' font-family='sans-serif' font-size='14' text-anchor='middle'>Arquivo: ${file.name}</text><text x='300' y='180' fill='%23f8fafc' font-family='sans-serif' font-size='13' text-anchor='middle'>Processado via Inteligência Artificial Gemini 3.6</text></svg>`;
      } else {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = resolve;
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const dataUrl = reader.result as string;
        previewUrl = dataUrl;
        const base64 = dataUrl.split(",")[1];
        const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        requestBody = { image: base64, mimeType };
      }

      const response = await fetch("/api/gemini/import-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || "Erro na API Gemini OCR de Escalas.");
      }

      const data = await response.json();

      // Extract employees
      const recognizedMap = new Map<string, { cargo: UserRole; telefone: string }>();

      if (data.employeeDetails && Array.isArray(data.employeeDetails)) {
        data.employeeDetails.forEach((ed: any) => {
          if (ed.name && typeof ed.name === "string" && ed.name.trim() && ed.name.toLowerCase() !== "evento geral") {
            const nameKey = ed.name.trim();
            let cargo: UserRole = "Frentista";
            if (ed.cargo && ["Gerente", "Supervisor", "Master", "Gerente Geral"].includes(ed.cargo)) {
              cargo = ed.cargo;
            }
            recognizedMap.set(nameKey, { cargo, telefone: ed.telefone || "(11) 99999-0000" });
          }
        });
      }

      if (data.employees && Array.isArray(data.employees)) {
        data.employees.forEach((empName: string) => {
          if (empName && typeof empName === "string" && empName.trim() && empName.toLowerCase() !== "evento geral") {
            const nameKey = empName.trim();
            if (!recognizedMap.has(nameKey)) {
              recognizedMap.set(nameKey, { cargo: "Frentista", telefone: "(11) 99999-0000" });
            }
          }
        });
      }

      const recognizedUserList: AIRecognizedUserItem[] = [];
      recognizedMap.forEach((details, empName) => {
        const existingUser = users.find(
          (u) => u.nomeCompleto.toLowerCase() === empName.toLowerCase() && (!u.cnpjPosto || u.cnpjPosto === cnpjPosto)
        );
        const cleanEmail = empName.toLowerCase().replace(/\s+/g, "") + "@posto.com";

        recognizedUserList.push({
          id: existingUser ? existingUser.id : "u_ai_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
          nomeCompleto: empName,
          cargo: existingUser ? existingUser.cargo : details.cargo,
          email: existingUser ? existingUser.email : cleanEmail,
          telefone: existingUser ? existingUser.telefone : details.telefone,
          isExisting: Boolean(existingUser),
          selected: true,
        });
      });

      // Parse learned patterns
      const parsedPatterns: EscalaPattern[] = (data.learnedPatterns || []).map((lp: any) => ({
        id: "pat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        funcionario: lp.funcionario,
        tipoEscala: (lp.tipoEscala as any) || "6x1",
        sequenciaTurnos: lp.sequenciaTurnos || ["Manhã (06h - 14h)", "Manhã (06h - 14h)", "Folga Geral"],
        diasTurno: lp.diasTurno || 6,
        diasFolga: lp.diasFolga || 1,
        historicoEscalasCount: 1,
        ultimaAtualizacao: new Date().toISOString().split("T")[0],
        confiancaIA: lp.confiancaIA || 98,
        stationCnpj: cnpjPosto,
        observacao: lp.observacao || "Apreendido via leitura inteligente OCR da foto/documento.",
      }));

      // Validate schedules extracted with precise days in month
      const valReport = validateScheduleEntries(
        data.schedules || [],
        users,
        activeMonth.year,
        activeMonth.monthNum,
        activeMonth.days
      );

      setModalData({
        imagePreview: previewUrl,
        documentName: file.name,
        documentType: sourceType === "spreadsheet" ? "spreadsheet" : file.name.endsWith(".pdf") ? "pdf" : "image",
        monthAndYear: { mes: data.mes || activeMonth.monthNum, ano: data.ano || activeMonth.year },
        recognizedUsers: recognizedUserList,
        schedules: data.schedules || [],
        events: data.events || [],
        learnedPatterns: parsedPatterns,
        validationReport: valReport,
      });

      onAddAuditLog("IMPORT", "OCR Escala", `Extração concluída: ${recognizedUserList.length} funcionários, ${parsedPatterns.length} padrões apreendidos`, "Regular");
    } catch (err: any) {
      console.error("OCR Import Error:", err);
      alert(`Falha na leitura da escala: ${err.message || "Verifique a qualidade e iluminação da foto."}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const handleConfirm = () => {
    if (!modalData) return;

    const stats = modalData.validationReport.matrixStats;
    if (!stats.isComplete) {
      if (!confirm(
        `⚠️ IMPORTAÇÃO INCOMPLETA DETECTADA\n\n` +
        `• Dias encontrados: ${stats.diasEncontrados}\n` +
        `• Funcionários encontrados: ${stats.funcionariosEncontrados}\n` +
        `• Registros esperados: ${stats.registrosEsperados}\n` +
        `• Registros importados: ${stats.registrosImportados}\n\n` +
        `Status: ${stats.statusText}\n\n` +
        `Deseja prosseguir com a gravação dos dados parciais mesmo assim?`
      )) {
        return;
      }
    }

    onConfirmImport({
      recognizedUsers: modalData.recognizedUsers,
      schedules: modalData.schedules,
      events: modalData.events,
      learnedPatterns: modalData.learnedPatterns || [],
    });
    setModalData(null);
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <input
        type="file"
        ref={cameraInputRef}
        onChange={(e) => handleProcessFile(e, "photo")}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleProcessFile(e, "photo")}
        accept="image/*,.pdf"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={(e) => handleProcessFile(e, "spreadsheet")}
        accept=".csv,.xlsx,.xls,.txt"
        className="hidden"
      />

      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        disabled={isImporting}
        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
        title="Fotografar escala da pista com câmera do dispositivo"
      >
        {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        <span>Tirar Foto</span>
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
        title="Enviar foto ou PDF da escala"
      >
        {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        <span>Foto / PDF (IA)</span>
      </button>

      <button
        type="button"
        onClick={() => docInputRef.current?.click()}
        disabled={isImporting}
        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
        title="Enviar planilha Excel/CSV ou texto da escala"
      >
        {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />}
        <span>Planilha / CSV</span>
      </button>

      {/* Modal View */}
      {modalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-6 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <BrainCircuit className="h-6 w-6 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                    OCR, Validação & Aprendizado Operacional
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Gemini 3.6
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-100 font-medium">
                    Análise completa do documento, validação de turnos e extração de regras da escala.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalData(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Validation Banner */}
            <div className={`px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${modalData.validationReport.isValid ? "bg-emerald-50 border-b border-emerald-200 text-emerald-900" : "bg-amber-50 border-b border-amber-200 text-amber-900"}`}>
              <div className="flex items-center gap-2 font-bold">
                {modalData.validationReport.isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span>
                  Relatório de Validação:{" "}
                  <strong>{modalData.validationReport.warnings.length} avisos</strong>,{" "}
                  <strong>{modalData.validationReport.errors.length} conflitos/erros</strong>.
                </span>
              </div>
              {modalData.validationReport.errors.length > 0 && (
                <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded border border-red-200">
                  ⚠️ Requer Revisão
                </span>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Document Preview & Stats */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-inner relative group">
                  <img
                    src={modalData.imagePreview}
                    alt="Documento Digitalizado"
                    className="w-full h-48 object-cover object-center group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-200">
                    📄 {modalData.documentName || "Documento Digitalizado"}
                  </div>
                </div>

                {/* Mandatory Matrix Validation Card */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3 shadow-md">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> Relatório de Integridade da Matriz
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${modalData.validationReport.matrixStats.isComplete ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                      {modalData.validationReport.matrixStats.isComplete ? "COMPLETA" : "INCOMPLETA"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>Dias encontrados:</span>
                      <span className="font-bold text-white">{modalData.validationReport.matrixStats.diasEncontrados}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Funcionários encontrados:</span>
                      <span className="font-bold text-white">{modalData.validationReport.matrixStats.funcionariosEncontrados}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Registros esperados:</span>
                      <span className="font-bold text-amber-300">{modalData.validationReport.matrixStats.registrosEsperados}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Registros importados:</span>
                      <span className={`font-bold ${modalData.validationReport.matrixStats.isComplete ? "text-emerald-400" : "text-rose-400"}`}>
                        {modalData.validationReport.matrixStats.registrosImportados}
                      </span>
                    </div>
                  </div>

                  <div className={`p-2 rounded-xl text-[11px] font-bold text-center border ${modalData.validationReport.matrixStats.isComplete ? "bg-emerald-950/60 text-emerald-300 border-emerald-800" : "bg-rose-950/60 text-rose-300 border-rose-800"}`}>
                    Status: {modalData.validationReport.matrixStats.statusText}
                  </div>
                </div>

                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs">
                    <Zap className="h-4 w-4 text-indigo-600" /> Resumo do Aprendizado de Padrões
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Plantões</span>
                      <span className="text-base font-black text-indigo-700">{modalData.schedules.length}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Equipe</span>
                      <span className="text-base font-black text-emerald-700">{modalData.recognizedUsers.length}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-100 text-center">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Padrões</span>
                      <span className="text-base font-black text-purple-700">{modalData.learnedPatterns?.length || 0}</span>
                    </div>
                  </div>

                  {modalData.learnedPatterns && modalData.learnedPatterns.length > 0 && (
                    <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-purple-900 uppercase block">Regras Mapeadas pela IA:</span>
                      <div className="space-y-1">
                        {modalData.learnedPatterns.slice(0, 4).map((pat, pIdx) => (
                          <div key={pIdx} className="bg-white p-2 rounded-xl border border-purple-100 text-[11px] flex justify-between items-center">
                            <span className="font-bold text-slate-800">{pat.funcionario}</span>
                            <span className="bg-purple-50 text-purple-700 font-black px-2 py-0.5 rounded text-[10px] border border-purple-200">
                              {pat.tipoEscala} ({pat.confiancaIA}% precisão)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Employees & Validation Warnings */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Equipe Reconhecida ({modalData.recognizedUsers.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Os funcionários abaixo serão vinculados ao Planner do posto.
                  </p>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {modalData.recognizedUsers.map((u, uIdx) => (
                    <div key={uIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-slate-800 block">{u.nomeCompleto}</span>
                        <span className="text-[10px] text-slate-500">{u.cargo} • {u.telefone}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isExisting ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                        {u.isExisting ? "Já Cadastrado" : "Novo Cadastro"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Validation Conflicts List */}
                {(modalData.validationReport.warnings.length > 0 || modalData.validationReport.errors.length > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2 text-xs">
                    <span className="font-black text-amber-900 block flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Alertas de Validação da IA:
                    </span>
                    <ul className="space-y-1 text-[11px] text-amber-800 max-h-32 overflow-y-auto pr-1">
                      {modalData.validationReport.errors.map((err, errIdx) => (
                        <li key={errIdx} className="font-bold text-red-700 flex items-center gap-1">
                          ❌ {err}
                        </li>
                      ))}
                      {modalData.validationReport.warnings.map((warn, warnIdx) => (
                        <li key={warnIdx} className="flex items-center gap-1">
                          ⚠️ {warn}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Gemini 3.6 • Mapeamento e Aprendizado de Padrões Operacionais
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalData(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-300" />
                  Confirmar e Salvar Escala
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
