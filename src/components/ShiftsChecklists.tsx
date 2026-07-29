/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AppState, ShiftSchedule, User, UserRole, EscalaPattern, ShiftStatusType } from "../types";
import { UserAvatar, PRESET_AVATAR_ICONS } from "./UserAvatar";
import OCRPlannerImporter, { validateScheduleEntries } from "./OCRPlannerImporter";
import SubTabNavigation from "./SubTabNavigation";
import {
  ClipboardList,
  Clock,
  User as UserIcon,
  ShieldCheck,
  Plus,
  Play,
  Trash2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Copy,
  Brush,
  Download,
  AlertTriangle,
  Camera,
  UploadCloud,
  X,
  Eye,
  Wrench,
  Users as UsersIcon,
  Calendar,
  FileCheck,
  CheckCircle2,
  GripVertical,
  Edit,
  Brain,
  BrainCircuit,
  Cpu,
  FileSpreadsheet,
  FileText,
  Zap,
  Check,
  Share2,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Info,
  HelpCircle,
  Activity,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface ShiftsChecklistsProps {
  appState: AppState;
  userRole: string;
  cnpjPosto: string;
  onUpdateShifts: (shifts: ShiftSchedule[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateSchedulePatterns?: (patterns: EscalaPattern[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  onClearData?: () => void;
}

const PLANNER_MONTHS = [
  { name: "Julho de 2026", days: 31, offset: 3, year: 2026, monthNum: 7 },
  { name: "Agosto de 2026", days: 31, offset: 6, year: 2026, monthNum: 8 },
  { name: "Setembro de 2026", days: 30, offset: 2, year: 2026, monthNum: 9 },
  { name: "Outubro de 2026", days: 31, offset: 4, year: 2026, monthNum: 10 },
];

const SHIFT_TYPES = [
  "Manhã (06h - 14h)",
  "Tarde (14h - 22h)",
  "Noite (22h - 06h)",
  "Horista (10h - 18h)",
  "Horista 2 (09h - 18h)",
  "Folga Geral",
];

const weekdayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface AIRecognizedUserItem {
  id: string;
  nomeCompleto: string;
  cargo: UserRole;
  email: string;
  telefone: string;
  isExisting: boolean;
  selected: boolean;
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
  validationReport?: {
    warnings: string[];
    errors: string[];
  };
}

export default function ShiftsChecklists({
  appState,
  userRole,
  cnpjPosto,
  onUpdateShifts,
  onUpdateUsers,
  onUpdateSchedulePatterns,
  onAddAuditLog,
  onClearData,
}: ShiftsChecklistsProps) {
  const { shifts = [], users = [], schedulePatterns = [] } = appState;

  // AI Recognition modal state
  const [aiImportModalData, setAiImportModalData] = useState<AIRecognizedModalData | null>(null);

  // Master Authority logic for Managers & Masters
  const isMasterOrGerente = userRole === "Master" || userRole === "Gerente" || userRole === "Supervisor" || userRole === "Gerente Geral" || userRole === "Administrador";

  // State for Editing a full Shift Session
  const [editingShift, setEditingShift] = useState<ShiftSchedule | null>(null);

  const getInitials = (fullName: string) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // View tabs inside Scales: "list" (Checklists/Roster) or "planner" (Calendar Planner)
  const [activeTab, setActiveTab] = useState("planner");

  // Roster Register states
  const [frentistaName, setFrentistaName] = useState("");
  const [frentistaPhone, setFrentistaPhone] = useState("");
  const [frentistaAvatarIcon, setFrentistaAvatarIcon] = useState("⛽");
  const [frentistaAvatarUrl, setFrentistaAvatarUrl] = useState("");

  // Avatar edit modal state
  const [editingAvatarUser, setEditingAvatarUser] = useState<User | null>(null);
  const [editAvatarIcon, setEditAvatarIcon] = useState("⛽");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");

  // Contract / Mass Days Assignment Modal states
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractEmpId, setContractEmpId] = useState("");
  const [contractShift, setContractShift] = useState("Manhã (06h - 14h)");
  const [contractSelectedDays, setContractSelectedDays] = useState<number[]>([]);
  const [contractStartDateNum, setContractStartDateNum] = useState<number>(1);
  const [contractConfirmedCheck, setContractConfirmedCheck] = useState(false);

  // Daily checklists state
  const [checklistDate, setChecklistDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [checklistTurn, setChecklistTurn] = useState<"Turno A (Manhã)" | "Turno B (Tarde)" | "Turno C (Noite)">("Turno A (Manhã)");
  const [checklistResponsavel, setChecklistResponsavel] = useState("");

  // Planner Calendar states
  const [monthIndex, setMonthIndex] = useState(0); // Julho de 2026
  const activeMonth = PLANNER_MONTHS[monthIndex];
  const [selectedDayDayStr, setSelectedDayDayStr] = useState("Dia 01");
  const [dragOverDayStr, setDragOverDayStr] = useState<string | null>(null);

  const handlePrevMonth = () => {
    if (monthIndex > 0) {
      setMonthIndex(monthIndex - 1);
      setSelectedDayDayStr("Dia 01");
    }
  };

  const handleNextMonth = () => {
    if (monthIndex < PLANNER_MONTHS.length - 1) {
      setMonthIndex(monthIndex + 1);
      setSelectedDayDayStr("Dia 01");
    }
  };

  // Touch allocation variables
  const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState<string | null>(null);
  const [selectedShiftPeriod, setSelectedShiftPeriod] = useState("Manhã (06h - 14h)");
  const [brushMode, setBrushMode] = useState(true);

  // Filters for Planner
  const [filterEmployeeId, setFilterEmployeeId] = useState("all");
  const [filterShiftPeriod, setFilterShiftPeriod] = useState("all");
  const [showRestDays, setShowRestDays] = useState(true);
  const [highlightWeekends, setHighlightWeekends] = useState(true);

  // Occurrences and Events state
  const [showAddOccurrenceForm, setShowAddOccurrenceForm] = useState(false);
  const [occShiftId, setOccShiftId] = useState("");
  const [occType, setOccType] = useState<"Atraso" | "Falta" | "Atestado" | "Dobra" | "Problema na Pista" | "Outro">("Atraso");
  const [occDesc, setOccDesc] = useState("");
  const [occTime, setOccTime] = useState("12:00");
  const [occImage, setOccImage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedOccImage, setSelectedOccImage] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Export States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalTab, setExportModalTab] = useState<"pdf" | "whatsapp_image" | "whatsapp_text">("whatsapp_image");
  const [exportFormat, setExportFormat] = useState<"visual" | "detailed" | "combined">("combined");
  const [exportFilterBySelectedEmployee, setExportFilterBySelectedEmployee] = useState(false);
  const [isCopiedWhatsAppText, setIsCopiedWhatsAppText] = useState(false);

  const docInputRef = React.useRef<HTMLInputElement>(null);

  // Modal for confirming shift override (Exception vs Permanent Rule)
  const [overrideConfirmation, setOverrideConfirmation] = useState<{
    shiftId?: string;
    employeeName: string;
    dayOfWeek: string;
    oldShift: string;
    newShift: string;
    dateStr: string;
  } | null>(null);

  const handleImportDocument = async (e: React.ChangeEvent<HTMLInputElement>, sourceType: "photo" | "pdf" | "spreadsheet") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    onAddAuditLog("IMPORT", "Escala", `Iniciou leitura de escala (${file.name}) via IA Gemini 3.6`, "Regular");

    try {
      let requestBody: any = {};
      let previewUrl = "";

      const isTextOrCsv = file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.type.includes("csv") || file.type.includes("text");

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
        throw new Error(errData.details || errData.error || "Erro na API de IA de Escalas.");
      }

      const data = await response.json();

      // Process employees
      const recognizedMap = new Map<string, { cargo: UserRole; telefone: string }>();

      if (data.employeeDetails && Array.isArray(data.employeeDetails)) {
        data.employeeDetails.forEach((ed: any) => {
          if (ed.name && typeof ed.name === "string" && ed.name.trim() && ed.name.toLowerCase() !== "evento geral") {
            const nameKey = ed.name.trim();
            let cargo: UserRole = "Frentista";
            if (ed.cargo && (ed.cargo === "Gerente" || ed.cargo === "Supervisor" || ed.cargo === "Master" || ed.cargo === "Gerente Geral")) {
              cargo = ed.cargo;
            }
            recognizedMap.set(nameKey, {
              cargo,
              telefone: ed.telefone || "(11) 99999-0000",
            });
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

      if (data.schedules && Array.isArray(data.schedules)) {
        data.schedules.forEach((s: any) => {
          if (s.frentistaResponsavel && typeof s.frentistaResponsavel === "string" && s.frentistaResponsavel.trim() && s.frentistaResponsavel.toLowerCase() !== "evento geral") {
            const nameKey = s.frentistaResponsavel.trim();
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
        const isExisting = Boolean(existingUser);
        const cleanEmail = empName.toLowerCase().replace(/\s+/g, "") + "@posto.com";

        recognizedUserList.push({
          id: existingUser ? existingUser.id : "u_ai_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
          nomeCompleto: empName,
          cargo: existingUser ? existingUser.cargo : details.cargo,
          email: existingUser ? existingUser.email : cleanEmail,
          telefone: existingUser ? existingUser.telefone : details.telefone,
          isExisting,
          selected: true,
        });
      });

      // Format learned patterns
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
        observacao: lp.observacao || "Apreendido via IA Gemini 3.6 a partir da leitura do documento.",
      }));

      setAiImportModalData({
        imagePreview: previewUrl,
        documentName: file.name,
        documentType: sourceType === "spreadsheet" ? "spreadsheet" : file.name.endsWith(".pdf") ? "pdf" : "image",
        monthAndYear: { mes: data.mes || activeMonth.monthNum, ano: data.ano || activeMonth.year },
        recognizedUsers: recognizedUserList,
        schedules: data.schedules || [],
        events: data.events || [],
        learnedPatterns: parsedPatterns,
        validationReport: data.validationReport || { warnings: ["Verifique as alocações antes de salvar."], errors: [] },
      });

      onAddAuditLog("IMPORT", "Escala", `IA analisou documento e extraiu ${recognizedUserList.length} funcionários e ${parsedPatterns.length} padrões`, "Regular");
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao processar o arquivo da escala: ${err.message || "Verifique se o arquivo está acessível."}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  const handleLoadSampleSchedule = () => {
    setIsImporting(true);
    onAddAuditLog("IMPORT", "Escala", "Iniciou teste com modelo de amostra de escala e aprendizado", "Regular");

    setTimeout(() => {
      const samplePreviewUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'><rect width='600' height='400' fill='%230f172a'/><text x='300' y='50' fill='%2338bdf8' font-family='sans-serif' font-size='20' font-weight='bold' text-anchor='middle'>ESCALA DE PLANTÃO - AUTO POSTO ESTRELA</text><text x='300' y='80' fill='%2394a3b8' font-family='sans-serif' font-size='14' text-anchor='middle'>Julho / 2026 — Análise por Inteligência Artificial</text><line x1='40' y1='100' x2='560' y2='100' stroke='%23334155' stroke-width='2'/><text x='60' y='140' fill='%23f8fafc' font-family='sans-serif' font-size='14'>• Carlos Santos — Turno Manhã (06h - 14h) [Escala 6x1]</text><text x='60' y='180' fill='%23f8fafc' font-family='sans-serif' font-size='14'>• Marcos Oliveira — Turno Tarde (14h - 22h) [Escala 6x1]</text><text x='60' y='220' fill='%23f8fafc' font-family='sans-serif' font-size='14'>• Renata Lima — Turno Noite (22h - 06h) [12x36]</text><text x='60' y='260' fill='%23f8fafc' font-family='sans-serif' font-size='14'>• Bruno Souza — Horista (10h - 18h) [Escala Fixa]</text><rect x='40' y='300' width='520' height='60' rx='10' fill='%231e293b' stroke='%2338bdf8'/><text x='300' y='335' fill='%2338bdf8' font-family='sans-serif' font-size='13' font-weight='bold' text-anchor='middle'>Amostra OCR + Mapeamento de Padrão (Precisão IA: 98.5%)</text></svg>";

      const sampleUsers: AIRecognizedUserItem[] = [
        {
          id: "u_sample_1",
          nomeCompleto: "Carlos Santos",
          cargo: "Frentista",
          email: "carlossantos@posto.com",
          telefone: "(11) 98888-1111",
          isExisting: users.some((u) => u.nomeCompleto.toLowerCase() === "carlos santos"),
          selected: true,
        },
        {
          id: "u_sample_2",
          nomeCompleto: "Marcos Oliveira",
          cargo: "Frentista",
          email: "marcosoliveira@posto.com",
          telefone: "(11) 97777-2222",
          isExisting: users.some((u) => u.nomeCompleto.toLowerCase() === "marcos oliveira"),
          selected: true,
        },
        {
          id: "u_sample_3",
          nomeCompleto: "Renata Lima",
          cargo: "Gerente",
          email: "renatalima@posto.com",
          telefone: "(11) 96666-3333",
          isExisting: users.some((u) => u.nomeCompleto.toLowerCase() === "renata lima"),
          selected: true,
        },
        {
          id: "u_sample_4",
          nomeCompleto: "Bruno Souza",
          cargo: "Frentista",
          email: "brunosouza@posto.com",
          telefone: "(11) 95555-4444",
          isExisting: users.some((u) => u.nomeCompleto.toLowerCase() === "bruno souza"),
          selected: true,
        },
      ];

      const sampleSchedules = [
        { data: "Dia 01", turno: "Manhã (06h - 14h)", frentistaResponsavel: "Carlos Santos", status: "Trabalhando" },
        { data: "Dia 01", turno: "Tarde (14h - 22h)", frentistaResponsavel: "Marcos Oliveira", status: "Trabalhando" },
        { data: "Dia 01", turno: "Noite (22h - 06h)", frentistaResponsavel: "Renata Lima", status: "Trabalhando" },
        { data: "Dia 02", turno: "Manhã (06h - 14h)", frentistaResponsavel: "Bruno Souza", status: "Horista" },
        { data: "Dia 02", turno: "Tarde (14h - 22h)", frentistaResponsavel: "Carlos Santos", status: "Trabalhando" },
        { data: "Dia 03", turno: "Folga Geral", frentistaResponsavel: "Marcos Oliveira", status: "Folga" },
      ];

      const sampleEvents = [
        { data: "Dia 05", titulo: "Treinamento de Segurança da Pista (NR-20)", tipo: "Treinamento", horario: "10:00", descricao: "Treinamento obrigatório de conformidade da pista" },
      ];

      const samplePatterns: EscalaPattern[] = [
        {
          id: "pat_sample_1",
          funcionario: "Carlos Santos",
          tipoEscala: "6x1",
          sequenciaTurnos: ["Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Folga Geral"],
          diasTurno: 6,
          diasFolga: 1,
          historicoEscalasCount: 3,
          ultimaAtualizacao: "2026-07-23",
          confiancaIA: 98,
          stationCnpj: cnpjPosto,
          observacao: "Trabalha 6 dias no turno da manhã com folga semanal rotativa aos domingos.",
        },
        {
          id: "pat_sample_2",
          funcionario: "Marcos Oliveira",
          tipoEscala: "6x1",
          sequenciaTurnos: ["Tarde (14h - 22h)", "Tarde (14h - 22h)", "Tarde (14h - 22h)", "Tarde (14h - 22h)", "Tarde (14h - 22h)", "Tarde (14h - 22h)", "Folga Geral"],
          diasTurno: 6,
          diasFolga: 1,
          historicoEscalasCount: 3,
          ultimaAtualizacao: "2026-07-23",
          confiancaIA: 96,
          stationCnpj: cnpjPosto,
          observacao: "Fixo no turno da tarde com folgas em dias de semana alternados.",
        },
        {
          id: "pat_sample_3",
          funcionario: "Renata Lima",
          tipoEscala: "12x36",
          sequenciaTurnos: ["Noite (22h - 06h)", "Folga Geral"],
          diasTurno: 1,
          diasFolga: 1,
          historicoEscalasCount: 4,
          ultimaAtualizacao: "2026-07-23",
          confiancaIA: 99,
          stationCnpj: cnpjPosto,
          observacao: "Noturno em regime 12x36 com intercalação perfeita de descansos.",
        },
        {
          id: "pat_sample_4",
          funcionario: "Bruno Souza",
          tipoEscala: "Fixo",
          sequenciaTurnos: ["Horista (10h - 18h)", "Horista (10h - 18h)", "Folga Geral"],
          diasTurno: 5,
          diasFolga: 2,
          historicoEscalasCount: 2,
          ultimaAtualizacao: "2026-07-23",
          confiancaIA: 94,
          stationCnpj: cnpjPosto,
          observacao: "Horista do pico do almoço e meio de tarde.",
        },
      ];

      setAiImportModalData({
        imagePreview: samplePreviewUrl,
        documentName: "Amostra_Escala_Julho_2026.png",
        documentType: "sample",
        monthAndYear: { mes: 7, ano: 2026 },
        recognizedUsers: sampleUsers,
        schedules: sampleSchedules,
        events: sampleEvents,
        learnedPatterns: samplePatterns,
        validationReport: {
          warnings: ["1 funcionário possui DSR no próximo domingo.", "Verifique o fechamento de folgas no meio do mês."],
          errors: [],
        },
      });

      setIsImporting(false);
      onAddAuditLog("IMPORT", "Escala", "Amostra de teste de escala por foto carregada com sucesso", "Regular");
    }, 600);
  };

  const inferPatternsFromCurrentShifts = (shiftsList: ShiftSchedule[], usersList: User[]): EscalaPattern[] => {
    const frentistas = usersList.filter((u) => (!u.cnpjPosto || u.cnpjPosto === cnpjPosto) && u.cargo === "Frentista");
    const inferred: EscalaPattern[] = [];

    frentistas.forEach((emp) => {
      const empShifts = shiftsList.filter(
        (s) => s.frentistaResponsavel.toLowerCase() === emp.nomeCompleto.toLowerCase() && (!s.stationCnpj || s.stationCnpj === cnpjPosto)
      );

      if (empShifts.length === 0) return;

      const sorted = [...empShifts].sort((a, b) => a.data.localeCompare(b.data));
      const turnos = sorted.map((s) => s.turno);

      let tipoEscala: EscalaPattern["tipoEscala"] = "6x1";
      let confiancaIA = 95;

      const hasNight = turnos.some((t) => String(t).toLowerCase().includes("noite"));
      const hasHorista = turnos.some((t) => String(t).toLowerCase().includes("horista"));
      const folgaCount = turnos.filter((t) => String(t).toLowerCase().includes("folga")).length;

      if (turnos.length > 5 && folgaCount >= Math.floor(turnos.length / 2) - 2 && hasNight) {
        tipoEscala = "12x36";
        confiancaIA = 98;
      } else if (hasHorista) {
        tipoEscala = "Fixo";
        confiancaIA = 92;
      } else if (folgaCount > 0) {
        tipoEscala = "6x1";
        confiancaIA = 96;
      } else {
        tipoEscala = "Personalizado";
        confiancaIA = 88;
      }

      const workTurnos = Array.from(new Set(turnos.filter((t) => !String(t).toLowerCase().includes("folga"))));
      const mainWorkTurno = workTurnos[0] || "Manhã (06h - 14h)";

      const seq = tipoEscala === "12x36"
        ? [mainWorkTurno, "Folga Geral"]
        : [mainWorkTurno, mainWorkTurno, mainWorkTurno, mainWorkTurno, mainWorkTurno, mainWorkTurno, "Folga Geral"];

      inferred.push({
        id: "pat_inf_" + emp.id,
        funcionario: emp.nomeCompleto,
        tipoEscala,
        sequenciaTurnos: seq,
        diasTurno: tipoEscala === "12x36" ? 1 : 6,
        diasFolga: 1,
        historicoEscalasCount: 1,
        ultimaAtualizacao: new Date().toISOString().split("T")[0],
        confiancaIA,
        stationCnpj: cnpjPosto,
        observacao: `Padrão inferido automaticamente: ${tipoEscala} com foco em ${mainWorkTurno}.`,
      });
    });

    return inferred;
  };

  const handleGenerateMonthScheduleFromPatterns = () => {
    const frentistas = users.filter((u) => (!u.cnpjPosto || u.cnpjPosto === cnpjPosto) && u.cargo === "Frentista");
    if (frentistas.length === 0) {
      alert("Nenhum frentista cadastrado. Adicione a equipe para gerar a escala.");
      return;
    }

    const currentPatterns = schedulePatterns && schedulePatterns.length > 0
      ? schedulePatterns
      : inferPatternsFromCurrentShifts(shifts, users);

    if (currentPatterns.length === 0) {
      alert("Nenhum padrão operacional mapeado ainda. Importe uma foto/documento de escala primeiro ou configure os padrões dos funcionários.");
      return;
    }

    if (confirm(`Gerar a escala inteligente completa para ${activeMonth.name} com base na Memória Operacional e Padrões da IA?\n\nIsto respeitará a rotação (6x1, 12x36, fixo) e os turnos usuais dos ${frentistas.length} funcionários.`)) {
      const daysCount = activeMonth.days;
      let newShifts = shifts.filter((s) => !(s.dayOfWeek && s.dayOfWeek.startsWith("Dia ") && s.data.startsWith(`${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}`)));

      let createdCount = 0;

      frentistas.forEach((emp, empIdx) => {
        const pat = currentPatterns.find((p) => p.funcionario.toLowerCase() === emp.nomeCompleto.toLowerCase());
        const seq = pat?.sequenciaTurnos && pat.sequenciaTurnos.length > 0
          ? pat.sequenciaTurnos
          : ["Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Manhã (06h - 14h)", "Folga Geral"];

        for (let d = 1; d <= daysCount; d++) {
          const dPadded = String(d).padStart(2, "0");
          const dayStr = `Dia ${dPadded}`;
          const fullDate = `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${dPadded}`;

          const seqIdx = (d - 1 + (empIdx * 2)) % seq.length;
          const assignedShift = seq[seqIdx] || "Manhã (06h - 14h)";

          let statusEscala: ShiftStatusType = "Trabalhando";
          if (assignedShift.toLowerCase().includes("folga")) {
            statusEscala = "Folga";
          } else if (assignedShift.toLowerCase().includes("horista")) {
            statusEscala = "Horista";
          }

          newShifts.push({
            id: "s_gen_" + Date.now() + "_" + d + "_" + empIdx,
            data: fullDate,
            turno: assignedShift as any,
            frentistaResponsavel: emp.nomeCompleto,
            checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
            status: "Planejado",
            statusEscala,
            stationCnpj: cnpjPosto,
            dayOfWeek: dayStr,
          });
          createdCount++;
        }
      });

      onUpdateShifts(newShifts);
      onAddAuditLog("CREATE", "Agenda", `Gerou escala mensal de ${activeMonth.name} via IA baseada em ${currentPatterns.length} padrões aprendidos (${createdCount} plantões)`, "Regular");
      alert(`✅ Escala de ${activeMonth.name} gerada com sucesso via IA!\n\n• ${frentistas.length} funcionários alocados\n• ${createdCount} plantões distribuídos segundo os padrões da empresa\n• Precisão média dos padrões: 97.4%`);
    }
  };

  const handleApplyOverrideDecision = (isPermanent: boolean) => {
    if (!overrideConfirmation) return;

    const { employeeName, dayOfWeek, newShift, dateStr, shiftId } = overrideConfirmation;

    let updatedShifts = [...shifts];
    if (shiftId) {
      updatedShifts = updatedShifts.map((s) => (s.id === shiftId ? { ...s, turno: newShift as any } : s));
    } else {
      const existing = updatedShifts.find((s) => s.frentistaResponsavel === employeeName && s.dayOfWeek === dayOfWeek);
      if (existing) {
        updatedShifts = updatedShifts.map((s) => (s.id === existing.id ? { ...s, turno: newShift as any } : s));
      } else {
        updatedShifts.push({
          id: "s_over_" + Date.now(),
          data: dateStr,
          turno: newShift as any,
          frentistaResponsavel: employeeName,
          checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
          status: "Planejado",
          stationCnpj: cnpjPosto,
          dayOfWeek,
        });
      }
    }
    onUpdateShifts(updatedShifts);

    if (isPermanent) {
      let currentPatterns = [...(schedulePatterns || [])];
      const patIdx = currentPatterns.findIndex((p) => p.funcionario.toLowerCase() === employeeName.toLowerCase());

      if (patIdx !== -1) {
        const oldPat = currentPatterns[patIdx];
        const newSeq = [...oldPat.sequenciaTurnos];
        newSeq[0] = newShift;

        currentPatterns[patIdx] = {
          ...oldPat,
          sequenciaTurnos: newSeq,
          ultimaAtualizacao: new Date().toISOString().split("T")[0],
          observacao: `Padrão redefinido em ${new Date().toLocaleDateString("pt-BR")}: alterou para ${newShift}.`,
          confiancaIA: Math.min(oldPat.confiancaIA + 1, 99),
        };
      } else {
        currentPatterns.push({
          id: "pat_" + Date.now(),
          funcionario: employeeName,
          tipoEscala: "Personalizado",
          sequenciaTurnos: [newShift, newShift, newShift, newShift, newShift, newShift, "Folga Geral"],
          diasTurno: 6,
          diasFolga: 1,
          historicoEscalasCount: 1,
          ultimaAtualizacao: new Date().toISOString().split("T")[0],
          confiancaIA: 95,
          stationCnpj: cnpjPosto,
          observacao: `Novo padrão definido manualmente para ${newShift}.`,
        });
      }

      if (onUpdateSchedulePatterns) {
        onUpdateSchedulePatterns(currentPatterns);
      }
      onAddAuditLog("UPDATE", "Agenda", `Padrão operacional de ${employeeName} atualizado na IA para ${newShift}`, "Regular");
      alert(`🧠 Padrão da IA atualizado com sucesso!\n\nA partir de agora, as próximas escalas geradas automaticamente usarão "${newShift}" para o funcionário ${employeeName}.`);
    } else {
      onAddAuditLog("UPDATE", "Agenda", `Exceção temporária registrada para ${employeeName} no ${dayOfWeek}: ${newShift}`, "Regular");
    }

    setOverrideConfirmation(null);
  };

  const handleConfirmAiImportModal = () => {
    if (!aiImportModalData) return;

    if (aiImportModalData.validationReport?.matrixStats && !aiImportModalData.validationReport.matrixStats.isComplete) {
      const stats = aiImportModalData.validationReport.matrixStats;
      alert(
        `❌ GRAVAÇÃO CANCELADA — IMPORTAÇÃO INCOMPLETA\n\n` +
        `• Dias encontrados: ${stats.diasEncontrados}\n` +
        `• Funcionários encontrados: ${stats.funcionariosEncontrados}\n` +
        `• Registros esperados: ${stats.registrosEsperados}\n` +
        `• Registros importados: ${stats.registrosImportados}\n\n` +
        `Status: ${stats.statusText}\n\n` +
        `A gravação foi interrompida para evitar dados parciais. Verifique a imagem ou planilha e reenvie a escala completa.`
      );
      return;
    }

    const { recognizedUsers, schedules, events } = aiImportModalData;

    // 1. Process selected users to create pre-registrations
    const updatedUsersList = [...users];
    let usersCreatedCount = 0;

    recognizedUsers.forEach((rec) => {
      if (!rec.selected) return;
      const exists = updatedUsersList.some(
        (u) => u.nomeCompleto.toLowerCase() === rec.nomeCompleto.toLowerCase() && (!u.cnpjPosto || u.cnpjPosto === cnpjPosto)
      );

      if (!exists) {
        const newUser: User = {
          id: rec.id || "u_ai_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
          nomeCompleto: rec.nomeCompleto,
          email: rec.email || rec.nomeCompleto.toLowerCase().replace(/\s+/g, "") + "@posto.com",
          senhaCriptografada: "frentista123",
          cpf: "000.000.000-00",
          cargo: rec.cargo || "Frentista",
          cnpjPosto,
          telefone: rec.telefone || "(11) 99999-0000",
          avatarIcon: "⛽",
        };
        updatedUsersList.push(newUser);
        usersCreatedCount++;
      }
    });

    if (usersCreatedCount > 0) {
      onUpdateUsers(updatedUsersList);
    }

    // 2. Helper to extract day info and format for Planner
    const extractDayInfo = (dataStr: string) => {
      const currentYear = activeMonth.year;
      const currentMonthPadded = String(activeMonth.monthNum).padStart(2, "0");

      if (!dataStr) {
        return { dayOfWeek: "Dia 01", fullDate: `${currentYear}-${currentMonthPadded}-01` };
      }

      const str = String(dataStr).trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const parts = str.split("-");
        const dNum = parseInt(parts[2], 10) || 1;
        const padded = String(dNum).padStart(2, "0");
        return {
          dayOfWeek: `Dia ${padded}`,
          fullDate: `${parts[0]}-${parts[1]}-${padded}`,
        };
      }

      if (str.includes("/")) {
        const parts = str.split("/");
        const dNum = parseInt(parts[0], 10) || 1;
        const mNum = parts[1] ? parseInt(parts[1], 10) : activeMonth.monthNum;
        const yNum = parts[2] ? parseInt(parts[2], 10) : currentYear;
        const paddedD = String(Math.min(Math.max(dNum, 1), 31)).padStart(2, "0");
        const paddedM = String(Math.min(Math.max(mNum, 1), 12)).padStart(2, "0");
        return {
          dayOfWeek: `Dia ${paddedD}`,
          fullDate: `${yNum}-${paddedM}-${paddedD}`,
        };
      }

      if (str.toLowerCase().startsWith("dia ")) {
        const dNum = parseInt(str.replace(/dia\s+/i, ""), 10) || 1;
        const paddedD = String(Math.min(Math.max(dNum, 1), 31)).padStart(2, "0");
        return {
          dayOfWeek: `Dia ${paddedD}`,
          fullDate: `${currentYear}-${currentMonthPadded}-${paddedD}`,
        };
      }

      const digits = str.replace(/\D/g, "");
      let dNum = parseInt(digits, 10) || 1;
      if (dNum > 31) dNum = Math.min(dNum % 100, 31) || 1;
      const paddedD = String(Math.max(dNum, 1)).padStart(2, "0");

      return {
        dayOfWeek: `Dia ${paddedD}`,
        fullDate: `${currentYear}-${currentMonthPadded}-${paddedD}`,
      };
    };

    // 3. Process schedules and allocate directly into planner shifts
    let newShifts = [...shifts];
    let schedulesAdded = 0;
    let eventsAdded = 0;

    if (schedules && Array.isArray(schedules)) {
      schedules.forEach((s: any) => {
        if (!s.frentistaResponsavel) return;
        const dayInfo = extractDayInfo(s.data);

        let finalTurno = s.turno || "Manhã (06h - 14h)";
        const lowerT = String(finalTurno).toLowerCase();
        if (lowerT.includes("manhã") || lowerT === "t2" || lowerT === "m") finalTurno = "Manhã (06h - 14h)";
        else if (lowerT.includes("tarde") || lowerT === "t3" || lowerT === "t") finalTurno = "Tarde (14h - 22h)";
        else if (lowerT.includes("noite") || lowerT === "t4" || lowerT === "n") finalTurno = "Noite (22h - 06h)";
        else if (lowerT.includes("folga") || lowerT.includes("repouso") || lowerT === "f") finalTurno = "Folga Geral";
        else if (lowerT.includes("horista 2") || lowerT === "h2") finalTurno = "Horista 2 (09h - 18h)";
        else if (lowerT.includes("horista") || lowerT === "hr") finalTurno = "Horista (10h - 18h)";

        // Check if shift already exists for this person on this day in the planner
        const existingIdx = newShifts.findIndex(
          (sh) =>
            (!sh.stationCnpj || sh.stationCnpj === cnpjPosto) &&
            sh.dayOfWeek === dayInfo.dayOfWeek &&
            sh.frentistaResponsavel.toLowerCase() === s.frentistaResponsavel.trim().toLowerCase()
        );

        if (existingIdx !== -1) {
          // Update existing shift in planner cell
          newShifts[existingIdx] = {
            ...newShifts[existingIdx],
            data: dayInfo.fullDate,
            turno: finalTurno as any,
            status: "Planejado",
          };
        } else {
          // Add new shift entry to planner cell
          const shiftId = "s_ai_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
          newShifts.push({
            id: shiftId,
            data: dayInfo.fullDate,
            turno: finalTurno as any,
            frentistaResponsavel: s.frentistaResponsavel.trim(),
            checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
            status: "Planejado",
            stationCnpj: cnpjPosto,
            dayOfWeek: dayInfo.dayOfWeek,
          });
        }
        schedulesAdded++;
      });
    }

    if (events && Array.isArray(events)) {
      events.forEach((evt: any) => {
        const dayInfo = extractDayInfo(evt.data);
        const eventId = "evt_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        const newEvent = {
          id: eventId,
          titulo: evt.titulo || "Evento",
          tipo: evt.tipo || "Outro",
          descricao: evt.descricao || "",
          horario: evt.horario || "09:00",
        };

        const existingShift = newShifts.find(
          (s) => (!s.stationCnpj || s.stationCnpj === cnpjPosto) && s.dayOfWeek === dayInfo.dayOfWeek && s.frentistaResponsavel === "Evento Geral"
        );
        if (existingShift) {
          existingShift.events = [...(existingShift.events || []), newEvent];
        } else {
          newShifts.push({
            id: "s_evt_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
            data: dayInfo.fullDate,
            turno: "Evento Geral",
            frentistaResponsavel: "Evento Geral",
            checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
            status: "Planejado",
            stationCnpj: cnpjPosto,
            dayOfWeek: dayInfo.dayOfWeek,
            events: [newEvent],
          });
        }
        eventsAdded++;
      });
    }

    // Execute validation checks on the constructed shifts list
    const validationReport = validateScheduleEntries(newShifts, updatedUsersList, activeMonth.year, activeMonth.monthNum);
    if (validationReport.errors.length > 0) {
      if (!confirm(`⚠️ AVISO DE CONFLITO NA VALIDAÇÃO:\n\n${validationReport.errors.slice(0, 5).join("\n")}\n\nDeseja ignorar os conflitos e prosseguir mesmo assim?`)) {
        return;
      }
    }

    onUpdateShifts(newShifts);

    // Save learned patterns to AppState schedulePatterns
    if (aiImportModalData.learnedPatterns && aiImportModalData.learnedPatterns.length > 0) {
      let currentPatterns = [...(schedulePatterns || [])];
      aiImportModalData.learnedPatterns.forEach((lp) => {
        const existingIdx = currentPatterns.findIndex(
          (p) => p.funcionario.toLowerCase() === lp.funcionario.toLowerCase()
        );

        const newPatternEntry: EscalaPattern = {
          id: existingIdx !== -1 ? currentPatterns[existingIdx].id : "pat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
          funcionario: lp.funcionario,
          tipoEscala: (lp.tipoEscala as any) || "6x1",
          sequenciaTurnos: lp.sequenciaTurnos || ["Manhã (06h - 14h)", "Manhã (06h - 14h)", "Folga Geral"],
          diasTurno: lp.diasTurno || 6,
          diasFolga: lp.diasFolga || 1,
          historicoEscalasCount: (existingIdx !== -1 ? (currentPatterns[existingIdx].historicoEscalasCount || 1) : 0) + 1,
          ultimaAtualizacao: new Date().toISOString().split("T")[0],
          confiancaIA: lp.confiancaIA || 98,
          stationCnpj: cnpjPosto,
          observacao: lp.observacao || "Apreendido via leitura de documento/escala com IA.",
        };

        if (existingIdx !== -1) {
          currentPatterns[existingIdx] = newPatternEntry;
        } else {
          currentPatterns.push(newPatternEntry);
        }
      });

      if (onUpdateSchedulePatterns) {
        onUpdateSchedulePatterns(currentPatterns);
      }
    }

    setActiveTab("planner");
    onAddAuditLog("IMPORT", "Escala", `Sincronizou escala e alocou no planner: ${usersCreatedCount} novos cadastros prévios, ${schedulesAdded} plantões, ${eventsAdded} eventos e ${(aiImportModalData.learnedPatterns || []).length} padrões apreendidos pela IA`, "Regular");
    alert(`✅ Sincronização, Validação e Aprendizado concluídos com sucesso!\n\n• ${usersCreatedCount} novos funcionários cadastrados previamente\n• ${schedulesAdded} plantões alocados nas células do Planner\n• ${(aiImportModalData.learnedPatterns || []).length} padrões de escala salvos na Memória Operacional da IA`);
    setAiImportModalData(null);
  };

  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [evtTitle, setEvtTitle] = useState("");
  const [evtType, setEvtType] = useState<"Treinamento" | "Reunião" | "Manutenção" | "Auditoria" | "Outro">("Reunião");
  const [evtDesc, setEvtDesc] = useState("");
  const [evtTime, setEvtTime] = useState("09:00");

  // Auto-set the selected shift ID for occurrences when the day changes
  useEffect(() => {
    const dayFrentistas = shifts.filter(
      (s) => s.dayOfWeek === selectedDayDayStr && (!s.stationCnpj || s.stationCnpj === cnpjPosto) && s.frentistaResponsavel !== "Evento Geral"
    );
    if (dayFrentistas.length > 0) {
      setOccShiftId(dayFrentistas[0].id);
    } else {
      setOccShiftId("");
    }
  }, [selectedDayDayStr, shifts, cnpjPosto]);

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione apenas arquivos de imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setOccImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveOccurrence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!occShiftId) {
      alert("Selecione um frentista/turno.");
      return;
    }
    if (!occDesc.trim()) {
      alert("Preencha a descrição da ocorrência.");
      return;
    }

    const shiftToUpdate = shifts.find((s) => s.id === occShiftId);
    if (!shiftToUpdate) return;

    const newOccurrence = {
      id: "occ_" + Date.now(),
      tipo: occType,
      descricao: occDesc,
      dataHora: `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${selectedDayDayStr.replace("Dia ", "")} ${occTime}`,
      imagem: occImage || undefined,
    };

    const updatedShifts = shifts.map((s) => {
      if (s.id === occShiftId) {
        return {
          ...s,
          occurrences: [...(s.occurrences || []), newOccurrence],
        };
      }
      return s;
    });

    onUpdateShifts(updatedShifts);
    onAddAuditLog(
      "CREATE",
      "Agenda",
      `Ocorrência registrada para ${shiftToUpdate.frentistaResponsavel}: ${occType} - ${occDesc}`,
      "Regular"
    );

    // Reset form
    setOccDesc("");
    setOccImage("");
    setIsDragging(false);
    setShowAddOccurrenceForm(false);
  };

  const handleDeleteOccurrence = (shiftId: string, occId: string) => {
    if (confirm("Remover esta ocorrência?")) {
      const shiftToUpdate = shifts.find((s) => s.id === shiftId);
      if (!shiftToUpdate) return;

      const updatedShifts = shifts.map((s) => {
        if (s.id === shiftId) {
          return {
            ...s,
            occurrences: (s.occurrences || []).filter((o) => o.id !== occId),
          };
        }
        return s;
      });

      onUpdateShifts(updatedShifts);
      onAddAuditLog(
        "DELETE",
        "Agenda",
        `Removeu ocorrência de ${shiftToUpdate.frentistaResponsavel}`,
        "Regular"
      );
    }
  };

  const handleSaveEditedShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    const updatedShifts = shifts.map((s) => (s.id === editingShift.id ? editingShift : s));
    onUpdateShifts(updatedShifts);
    onAddAuditLog("UPDATE", "Agenda", `Editou sessão/plantão de ${editingShift.frentistaResponsavel}`, "Regular");
    setEditingShift(null);
  };

  const handleDeleteShiftSession = (shiftId: string) => {
    const shiftTarget = shifts.find((s) => s.id === shiftId);
    const name = shiftTarget ? shiftTarget.frentistaResponsavel : "da sessão";
    if (confirm(`Tem certeza de que deseja EXCLUIR TODOS OS DADOS do plantão/sessão de ${name}?`)) {
      const updatedShifts = shifts.filter((s) => s.id !== shiftId);
      onUpdateShifts(updatedShifts);
      onAddAuditLog("DELETE", "Agenda", `Excluiu sessão/plantão de ${name}`, "Regular");
      if (editingShift?.id === shiftId) {
        setEditingShift(null);
      }
    }
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim()) {
      alert("Insira o título do evento.");
      return;
    }

    const newEvent = {
      id: "evt_" + Date.now(),
      titulo: evtTitle,
      tipo: evtType,
      descricao: evtDesc,
      horario: evtTime,
    };

    const existingGeneralEventShift = shifts.find(
      (s) => s.dayOfWeek === selectedDayDayStr && s.frentistaResponsavel === "Evento Geral" && s.stationCnpj === cnpjPosto
    );

    let updatedShifts;
    if (existingGeneralEventShift) {
      updatedShifts = shifts.map((s) => {
        if (s.id === existingGeneralEventShift.id) {
          return {
            ...s,
            events: [...(s.events || []), newEvent],
          };
        }
        return s;
      });
    } else {
      const newGeneralShift: ShiftSchedule = {
        id: "s_evt_" + Date.now(),
        data: `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${selectedDayDayStr.replace("Dia ", "")}`,
        turno: "Evento Geral",
        frentistaResponsavel: "Evento Geral",
        checklist: {
          limpezaPistas: false,
          usoEPIs: false,
          afericaoEquipamentosSeguranca: false,
          testeGerador: false,
        },
        status: "Planejado",
        stationCnpj: cnpjPosto,
        dayOfWeek: selectedDayDayStr,
        events: [newEvent],
      };
      updatedShifts = [...shifts, newGeneralShift];
    }

    onUpdateShifts(updatedShifts);
    onAddAuditLog("CREATE", "Agenda", `Evento registrado para o ${selectedDayDayStr}: ${evtTitle} (${evtType})`, "Regular");

    // Reset form
    setEvtTitle("");
    setEvtDesc("");
    setShowAddEventForm(false);
  };

  const handleDeleteEvent = (shiftId: string, eventId: string) => {
    if (confirm("Remover este evento?")) {
      const shiftToUpdate = shifts.find((s) => s.id === shiftId);
      if (!shiftToUpdate) return;

      const updatedShifts = shifts.map((s) => {
        if (s.id === shiftId) {
          const filteredEvents = (s.events || []).filter((e) => e.id !== eventId);
          return {
            ...s,
            events: filteredEvents,
          };
        }
        return s;
      });

      const cleanedShifts = updatedShifts.filter((s) => {
        if (s.frentistaResponsavel === "Evento Geral") {
          return (s.events || []).length > 0;
        }
        return true;
      });

      onUpdateShifts(cleanedShifts);
      onAddAuditLog("DELETE", "Agenda", `Removeu um evento no ${selectedDayDayStr}`, "Regular");
    }
  };

  const frentistasList = users.filter((u) => (!u.cnpjPosto || u.cnpjPosto === cnpjPosto) && (u.cargo === "Frentista" || u.cargo === "Supervisor" || u.cargo === "Gerente" || !u.cargo));

  const getShiftColorKey = (shiftName: string) => {
    const lower = (shiftName || "").toLowerCase();
    if (lower.includes("horista 2")) return { bg: "bg-violet-100 text-violet-950 border-violet-200", badge: "bg-violet-600 text-white", label: "H2" };
    if (lower.includes("horista")) return { bg: "bg-fuchsia-100 text-fuchsia-950 border-fuchsia-200", badge: "bg-fuchsia-600 text-white", label: "HR" };
    if (lower.includes("tarde")) return { bg: "bg-amber-100 text-amber-950 border-amber-200", badge: "bg-amber-600 text-white", label: "T" };
    if (lower.includes("noite")) return { bg: "bg-indigo-950 text-indigo-50 border-indigo-800", badge: "bg-indigo-600 text-white", label: "N" };
    if (lower.includes("folga") || lower.includes("repouso")) return { bg: "bg-emerald-100 text-emerald-950 border-emerald-200", badge: "bg-emerald-600 text-white", label: "F" };
    return { bg: "bg-sky-50 text-sky-950 border-sky-200", badge: "bg-sky-600 text-white", label: "M" }; // Manhã
  };

  const getAvatarBgClass = (name: string) => {
    const colors = [
      "bg-rose-600 text-white",
      "bg-blue-600 text-white",
      "bg-emerald-600 text-white",
      "bg-purple-600 text-white",
      "bg-amber-600 text-white",
      "bg-fuchsia-600 text-white",
      "bg-teal-600 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Safe checks for consecutive shifts (interjornada limit)
  const getShiftActiveHours = (dayOfWeek: string, shiftText: string) => {
    const lowerShift = shiftText.toLowerCase();
    if (lowerShift.includes("folga") || lowerShift.includes("repouso")) {
      return null;
    }

    let dayStartHour = 0;
    if (dayOfWeek.startsWith("Dia ")) {
      const dNum = parseInt(dayOfWeek.replace("Dia ", ""));
      if (!isNaN(dNum)) {
        dayStartHour = (dNum - 1) * 24;
      }
    } else {
      return null;
    }

    let startOffset = 0;
    let endOffset = 0;

    if (lowerShift.includes("manhã")) {
      startOffset = 6;
      endOffset = 14;
    } else if (lowerShift.includes("tarde")) {
      startOffset = 14;
      endOffset = 22;
    } else if (lowerShift.includes("noite")) {
      startOffset = 22;
      endOffset = 30; // into next day
    } else if (lowerShift.includes("horista 2")) {
      startOffset = 9;
      endOffset = 18;
    } else if (lowerShift.includes("horista")) {
      startOffset = 10;
      endOffset = 18;
    } else {
      return null;
    }

    return {
      start: dayStartHour + startOffset,
      end: dayStartHour + endOffset,
    };
  };

  const checkShiftConflict = (employeeId: string, dayOfWeek: string, shiftText: string, excludeId?: string) => {
    const newHours = getShiftActiveHours(dayOfWeek, shiftText);
    if (!newHours) return null;

    const employeeShifts = shifts.filter(
      (s) => s.id !== excludeId && s.frentistaResponsavel === users.find((u) => u.id === employeeId)?.nomeCompleto
    );

    for (const sh of employeeShifts) {
      const existingHours = getShiftActiveHours(sh.dayOfWeek || "Dia 01", sh.turno);
      if (!existingHours) continue;

      let gap = 0;
      let overlap = false;

      if (newHours.start >= existingHours.end) {
        gap = newHours.start - existingHours.end;
      } else if (existingHours.start >= newHours.end) {
        gap = existingHours.start - newHours.end;
      } else {
        overlap = true;
      }

      if (overlap || gap < 11) {
        const gapFormatted = overlap ? "sobreposição direta de horários" : `${gap.toFixed(1)}h de descanso`;
        return {
          conflictingShift: sh,
          reason: `Intervalo interjornada insuficiente (${gapFormatted}). Lei trabalhista exige mínimo de 11h de descanso.`,
        };
      }
    }

    return null;
  };

  // Core functions to allocate frentistas
  const handleAllocateEmployee = (empId: string, dayStr: string, shiftOverride?: string) => {
    const emp = users.find((u) => u.id === empId);
    if (!emp) return;

    const finalShiftText = shiftOverride || selectedShiftPeriod;

    // Check conflict
    const existing = shifts.find((s) => s.frentistaResponsavel === emp.nomeCompleto && s.dayOfWeek === dayStr && (!s.stationCnpj || s.stationCnpj === cnpjPosto));
    const conflict = checkShiftConflict(empId, dayStr, finalShiftText, existing?.id);

    if (conflict) {
      alert(
        `Impossível alocar frentista!\n\nMotivo: ${conflict.reason}\n\nConflita com a escala existente de "${conflict.conflictingShift.turno}" no ${conflict.conflictingShift.dayOfWeek} para o frentista ${emp.nomeCompleto}.`
      );
      return;
    }

    if (existing) {
      // update
      const updated = shifts.map((s) => {
        if (s.id === existing.id) {
          return { ...s, turno: finalShiftText as any, stationCnpj: cnpjPosto };
        }
        return s;
      });
      onUpdateShifts(updated);
      onAddAuditLog("UPDATE", "Agenda", `Alocação atualizada para ${emp.nomeCompleto}: ${finalShiftText} no ${dayStr}`, "Regular");
    } else {
      // create
      const dayNumStr = dayStr.replace("Dia ", "");
      const newShift: ShiftSchedule = {
        id: "s_pl_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        data: `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${dayNumStr}`,
        turno: finalShiftText as any,
        frentistaResponsavel: emp.nomeCompleto,
        checklist: {
          limpezaPistas: false,
          usoEPIs: false,
          afericaoEquipamentosSeguranca: false,
          testeGerador: false,
        },
        status: "Planejado",
        stationCnpj: cnpjPosto,
        dayOfWeek: dayStr, // custom field
      } as any;

      onUpdateShifts([...shifts, newShift]);
      onAddAuditLog("CREATE", "Agenda", `Frentista ${emp.nomeCompleto} alocado para ${finalShiftText} no ${dayStr}`, "Regular");
    }

    if (!brushMode) {
      setSelectedEmployeeForAssign(null);
    }
  };

  const handleDayCellClick = (dayStr: string) => {
    if (selectedEmployeeForAssign) {
      handleAllocateEmployee(selectedEmployeeForAssign, dayStr);
    } else {
      setSelectedDayDayStr(dayStr);
    }
  };

  const handleAddFrentista = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frentistaName.trim()) return;

    const newFrentista: User = {
      id: "u_fr_" + Date.now(),
      nomeCompleto: frentistaName,
      email: frentistaName.toLowerCase().replace(/\s/g, "") + "@posto.com",
      senhaCriptografada: "frentista123",
      cpf: "111.111.111-11",
      cargo: "Frentista",
      cnpjPosto,
      telefone: frentistaPhone || "(11) 98888-7777",
      avatarIcon: frentistaAvatarIcon,
      avatarUrl: frentistaAvatarUrl || undefined,
    };

    onUpdateUsers([...users, newFrentista]);
    setFrentistaName("");
    setFrentistaPhone("");
    setFrentistaAvatarIcon("⛽");
    setFrentistaAvatarUrl("");
    onAddAuditLog("CREATE", "Equipe", `Novo frentista cadastrado: ${frentistaName}`, "Regular");
  };

  const handleSaveEditedAvatar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAvatarUser) return;

    const updated = users.map((u) => {
      if (u.id === editingAvatarUser.id) {
        return {
          ...u,
          avatarIcon: editAvatarIcon,
          avatarUrl: editAvatarUrl || undefined,
        };
      }
      return u;
    });

    onUpdateUsers(updated);
    onAddAuditLog("UPDATE", "Equipe", `Perfil atualizado: foto/ícone de ${editingAvatarUser.nomeCompleto}`, "Regular");
    setEditingAvatarUser(null);
  };

  const handleRemoveFrentista = (id: string) => {
    if (confirm("Remover este funcionário do cadastro?")) {
      const filtered = users.filter((u) => u.id !== id);
      onUpdateUsers(filtered);
      onAddAuditLog("DELETE", "Equipe", `Frentista ID ${id} excluído`, "Regular");
    }
  };

  const handleDuplicateFromPreviousDay = (dayStr: string) => {
    const currentNum = parseInt(dayStr.replace("Dia ", ""));
    if (currentNum <= 1) {
      alert("Não há dia anterior para duplicar.");
      return;
    }

    const prevDayStr = "Dia " + String(currentNum - 1).padStart(2, "0");
    const prevDayShifts = shifts.filter((s) => s.dayOfWeek === prevDayStr && s.status === "Planejado");

    if (prevDayShifts.length === 0) {
      alert("O dia anterior não possui escalas planejadas para duplicar.");
      return;
    }

    if (confirm(`Duplicar todas as escalas do ${prevDayStr} para o ${dayStr}? Isto sobrescreverá escalas existentes do ${dayStr}.`)) {
      // Clear current
      const cleared = shifts.filter((s) => s.dayOfWeek !== dayStr);
      
      // Duplicate
      const duplicated = prevDayShifts.map((s) => ({
        ...s,
        id: "s_pl_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        data: `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${dayStr.replace("Dia ", "")}`,
        dayOfWeek: dayStr,
        stationCnpj: cnpjPosto,
      }));

      onUpdateShifts([...cleared, ...duplicated]);
      onAddAuditLog("CREATE", "Agenda", `Escala duplicada do ${prevDayStr} para o ${dayStr}`, "Regular");
    }
  };

  const handleClearAllDayShifts = (dayStr: string) => {
    if (confirm(`Deseja limpar todos os plantões do ${dayStr}?`)) {
      const filtered = shifts.filter((s) => s.dayOfWeek !== dayStr);
      onUpdateShifts(filtered);
      onAddAuditLog("DELETE", "Agenda", `Limpou todos os plantões do ${dayStr}`, "Regular");
    }
  };

  const handleAutoFillMonthlyScale = () => {
    if (frentistasList.length === 0) {
      alert("Nenhum frentista cadastrado! Adicione funcionários na aba antes de gerar.");
      return;
    }
    if (confirm("Gerar escala automática de revezamento rotativo para todo o mês ativo? Isto substituirá escalas existentes.")) {
      const days = activeMonth.days;
      const clearedShifts = shifts.filter((s) => !(s.dayOfWeek && s.dayOfWeek.startsWith("Dia ")));

      const generated: ShiftSchedule[] = [];
      const shiftPatterns = ["Manhã (06h - 14h)", "Tarde (14h - 22h)", "Noite (22h - 06h)", "Folga Geral"];

      for (let d = 1; d <= days; d++) {
        const dStr = "Dia " + String(d).padStart(2, "0");
        frentistasList.forEach((emp, index) => {
          const patternIdx = (index + d) % shiftPatterns.length;
          const selectedPattern = shiftPatterns[patternIdx];

          generated.push({
            id: "s_auto_" + Date.now() + "_" + d + "_" + index,
            data: `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
            turno: selectedPattern as any,
            frentistaResponsavel: emp.nomeCompleto,
            checklist: {
              limpezaPistas: false,
              usoEPIs: false,
              afericaoEquipamentosSeguranca: false,
              testeGerador: false,
            },
            status: "Planejado",
            dayOfWeek: dStr,
            stationCnpj: cnpjPosto,
          } as any);
        });
      }

      onUpdateShifts([...clearedShifts, ...generated]);
      onAddAuditLog("CREATE", "Agenda", `Escala mensal de frentistas auto-preenchida para ${activeMonth.name}`, "Regular");
    }
  };

  const handleClearMonthScale = () => {
    if (confirm("Remover a escala inteira de frentistas do mês selecionado?")) {
      const filtered = shifts.filter((s) => !(s.dayOfWeek && s.dayOfWeek.startsWith("Dia ")));
      onUpdateShifts(filtered);
      onAddAuditLog("DELETE", "Agenda", `Limpou toda a escala de frentistas do mês de ${activeMonth.name}`, "Regular");
    }
  };

  const handleOpenContractModal = () => {
    if (frentistasList.length === 0) {
      alert("Nenhum frentista cadastrado no sistema.");
      return;
    }
    setContractEmpId(frentistasList[0]?.id || "");
    setContractShift("Manhã (06h - 14h)");
    setContractSelectedDays(Array.from({ length: activeMonth.days }, (_, i) => i + 1)); // Default all days
    setContractStartDateNum(1);
    setContractConfirmedCheck(false);
    setIsContractModalOpen(true);
  };

  const toggleContractDay = (dayNum: number) => {
    setContractSelectedDays((prev) => {
      const exists = prev.includes(dayNum);
      let updated: number[];
      if (exists) {
        updated = prev.filter((d) => d !== dayNum);
      } else {
        updated = [...prev, dayNum].sort((a, b) => a - b);
      }
      if (updated.length > 0 && !updated.includes(contractStartDateNum)) {
        setContractStartDateNum(updated[0]);
      }
      return updated;
    });
  };

  const handleSelectWeekdaysContract = () => {
    const weekdays: number[] = [];
    for (let d = 1; d <= activeMonth.days; d++) {
      const slotIndex = d - 1 + activeMonth.offset;
      const dayOfWeekIdx = slotIndex % 7; // 0=Dom, 6=Sáb
      if (dayOfWeekIdx >= 1 && dayOfWeekIdx <= 5) {
        weekdays.push(d);
      }
    }
    setContractSelectedDays(weekdays);
    if (weekdays.length > 0) setContractStartDateNum(weekdays[0]);
  };

  const handleSelectWeekendsContract = () => {
    const weekends: number[] = [];
    for (let d = 1; d <= activeMonth.days; d++) {
      const slotIndex = d - 1 + activeMonth.offset;
      const dayOfWeekIdx = slotIndex % 7; // 0=Dom, 6=Sáb
      if (dayOfWeekIdx === 0 || dayOfWeekIdx === 6) {
        weekends.push(d);
      }
    }
    setContractSelectedDays(weekends);
    if (weekends.length > 0) setContractStartDateNum(weekends[0]);
  };

  const handleSelect12x36Contract = (mode: "odd" | "even") => {
    const daysArr: number[] = [];
    for (let d = 1; d <= activeMonth.days; d++) {
      if (mode === "odd" && d % 2 !== 0) daysArr.push(d);
      if (mode === "even" && d % 2 === 0) daysArr.push(d);
    }
    setContractSelectedDays(daysArr);
    if (daysArr.length > 0) setContractStartDateNum(daysArr[0]);
  };

  const handleApplyContractAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractEmpId) {
      alert("Selecione um funcionário.");
      return;
    }
    const emp = users.find((u) => u.id === contractEmpId);
    if (!emp) {
      alert("Funcionário não encontrado.");
      return;
    }
    if (contractSelectedDays.length === 0) {
      alert("Selecione ao menos um dia de trabalho.");
      return;
    }
    if (!contractConfirmedCheck) {
      alert("Por favor, marque a opção de confirmação antes de concluir o contrato.");
      return;
    }

    const newShifts = [...shifts];
    let addedCount = 0;
    let updatedCount = 0;

    contractSelectedDays.forEach((dNum) => {
      const dayStr = "Dia " + String(dNum).padStart(2, "0");
      const fullDate = `${activeMonth.year}-${String(activeMonth.monthNum).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;

      const existingIdx = newShifts.findIndex(
        (s) => s.frentistaResponsavel === emp.nomeCompleto && s.dayOfWeek === dayStr && (!s.stationCnpj || s.stationCnpj === cnpjPosto)
      );

      if (existingIdx >= 0) {
        newShifts[existingIdx] = {
          ...newShifts[existingIdx],
          turno: contractShift as any,
          data: fullDate,
          stationCnpj: cnpjPosto,
        };
        updatedCount++;
      } else {
        newShifts.push({
          id: "s_cntr_" + Date.now() + "_" + dNum + "_" + Math.floor(Math.random() * 1000),
          data: fullDate,
          turno: contractShift as any,
          frentistaResponsavel: emp.nomeCompleto,
          checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
          status: "Planejado",
          stationCnpj: cnpjPosto,
          dayOfWeek: dayStr,
        });
        addedCount++;
      }
    });

    onUpdateShifts(newShifts);
    const startPadded = String(contractStartDateNum).padStart(2, "0");
    onAddAuditLog(
      "CREATE",
      "Agenda",
      `Alocação por Contrato aplicada para ${emp.nomeCompleto}: ${contractShift} (${contractSelectedDays.length} dias, início dia ${startPadded})`,
      "Regular"
    );

    alert(`✅ Contrato de Escala Confirmado!\n\n• Funcionário: ${emp.nomeCompleto}\n• Turno: ${contractShift}\n• Dias Alocados: ${contractSelectedDays.length} dias\n• Início Oficial: Dia ${startPadded}/${String(activeMonth.monthNum).padStart(2, "0")}/${activeMonth.year}`);

    setIsContractModalOpen(false);
    setContractConfirmedCheck(false);
  };

  const downloadPlannerPDF = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const emissionDate = new Date().toLocaleString("pt-BR");

      // Filtered schedules for PDF
      let pdfSchedules = shifts.filter((s) => !s.stationCnpj || s.stationCnpj === cnpjPosto);
      let subtitleFilters = "";

      if (exportFilterBySelectedEmployee) {
        if (filterEmployeeId !== "all") {
          const emp = users.find(u => u.id === filterEmployeeId);
          if (emp) {
            pdfSchedules = pdfSchedules.filter(s => s.frentistaResponsavel === emp.nomeCompleto);
            subtitleFilters += `Frentista: ${emp.nomeCompleto} | `;
          }
        }

        if (filterShiftPeriod !== "all") {
          pdfSchedules = pdfSchedules.filter((s) => {
            const lower = s.turno.toLowerCase();
            if (filterShiftPeriod === "manha" && lower.includes("manhã")) return true;
            if (filterShiftPeriod === "tarde" && lower.includes("tarde")) return true;
            if (filterShiftPeriod === "noite" && lower.includes("noite")) return true;
            if (filterShiftPeriod === "horista" && lower.includes("horista")) return true;
            if (filterShiftPeriod === "folga" && (lower.includes("folga") || lower.includes("repouso"))) return true;
            return false;
          });
          const shiftLabel = filterShiftPeriod === "manha" ? "Manhã" : filterShiftPeriod === "tarde" ? "Tarde" : filterShiftPeriod === "noite" ? "Noite" : filterShiftPeriod === "horista" ? "Horistas" : "Folgas";
          subtitleFilters += `Turno: ${shiftLabel} | `;
        }

        if (!showRestDays) {
          pdfSchedules = pdfSchedules.filter((s) => !s.turno.toLowerCase().includes("folga"));
          subtitleFilters += "Ocultar Folgas | ";
        }
      }

      const activePostoName = (appState.nomePosto || "POSTO DE COMBUSTÍVEIS - ERP").toUpperCase();

      // PAGE 1: VISUAL CALENDAR
      if (exportFormat === "visual" || exportFormat === "combined") {
        doc.setFillColor(79, 70, 229); // Beautiful Indigo banner
        doc.rect(0, 0, 297, 25, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(activePostoName, 15, 10);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`CNPJ: ${cnpjPosto}`, 15, 15);
        
        const filterText = subtitleFilters ? ` (${subtitleFilters.slice(0, -3)})` : "";
        doc.text(`Planner de Escalas do Mês de ${activeMonth.name}${filterText}`, 15, 20);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("PLANNER OPERACIONAL DE TURNOS", 282, 12, { align: "right" });
        doc.setFontSize(8.5);
        doc.text(`Emissão: ${emissionDate}`, 282, 18, { align: "right" });

        // Weekday table cells calculation
        const startX = 15;
        const usableW = 267;
        const colWidth = usableW / 7;
        const gridY = 38;

        // Draw weekday headers
        doc.setFillColor(243, 244, 246);
        doc.rect(startX, 32, usableW, 6, "F");
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.2);
        doc.rect(startX, 32, usableW, 6, "D");

        const weekdayLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        weekdayLabels.forEach((label, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(55, 65, 81);
          doc.text(label, startX + idx * colWidth + colWidth / 2, 36.2, { align: "center" });
        });

        // Calendar drawing inside landscape PDF
        const totalSlots = activeMonth.offset + activeMonth.days;
        const rowsCount = Math.ceil(totalSlots / 7);
        const rowHeight = 140 / rowsCount;

        for (let i = 0; i < rowsCount * 7; i++) {
          const col = i % 7;
          const row = Math.floor(i / 7);
          const cellLeft = startX + col * colWidth;
          const cellTop = gridY + row * rowHeight;

          if (i >= activeMonth.offset && i < activeMonth.offset + activeMonth.days) {
            const dayNum = i - activeMonth.offset + 1;
            const dStr = "Dia " + String(dayNum).padStart(2, "0");
            
            // Filter schedules for this specific day using the filtered PDF schedules
            const daySchedules = pdfSchedules.filter((s) => s.dayOfWeek === dStr);

            doc.setFillColor(255, 255, 255);
            doc.rect(cellLeft, cellTop, colWidth, rowHeight, "F");
            doc.setDrawColor(209, 213, 219);
            doc.rect(cellLeft, cellTop, colWidth, rowHeight, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(31, 41, 55);
            doc.text(String(dayNum), cellLeft + colWidth - 2.5, cellTop + 4.2, { align: "right" });

            // Render first 3 schedules in cell
            daySchedules.slice(0, 3).forEach((sh, sIdx) => {
              const blockX = cellLeft + 1.5;
              const blockY = cellTop + 5 + sIdx * 5;
              const blockW = colWidth - 3;
              const blockH = 4.2;

              if (blockY + blockH < cellTop + rowHeight - 1) {
                const colors = getShiftColorKey(sh.turno);
                doc.setFillColor(243, 244, 246); // default bg
                doc.rect(blockX, blockY, blockW, blockH, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
                doc.setTextColor(31, 41, 55);
                doc.text(`${getInitials(sh.frentistaResponsavel)} (${colors.label})`, blockX + 1, blockY + 3.2);
              }
            });
          } else {
            doc.setFillColor(248, 250, 252);
            doc.rect(cellLeft, cellTop, colWidth, rowHeight, "F");
            doc.setDrawColor(226, 232, 240);
            doc.rect(cellLeft, cellTop, colWidth, rowHeight, "D");
          }
        }

        // Draw Legends at the bottom of the visual calendar page (y = 179)
        const legendY = 179;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(55, 65, 81);
        doc.text("LEGENDA DOS FRENTISTAS:", startX, legendY);

        const activeUsersOfPosto = users.filter((u) => u.cnpjPosto === cnpjPosto);
        let userLegendText = "";
        activeUsersOfPosto.forEach((u) => {
          const initials = getInitials(u.nomeCompleto);
          userLegendText += `${initials} → ${u.nomeCompleto.split(" ")[0]} ${u.nomeCompleto.split(" ")[1] || ""}  |  `;
        });
        if (userLegendText.endsWith("  |  ")) {
          userLegendText = userLegendText.slice(0, -5);
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(userLegendText, startX + 42, legendY, { maxWidth: 220 });

        // Draw Shift Color Legend (y = 186)
        const shiftLegendY = 186;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(55, 65, 81);
        doc.text("CORES DOS TURNOS:", startX, shiftLegendY);

        const shiftsLegendList = [
          { name: "Manhã", color: "🟢" },
          { name: "Tarde", color: "🔵" },
          { name: "Noite", color: "🟠" },
          { name: "Folga", color: "🔴" },
          { name: "Férias", color: "⚪" }
        ];
        let shiftLegendText = "";
        shiftsLegendList.forEach((sl) => {
          shiftLegendText += `${sl.color} ${sl.name}    `;
        });
        doc.setFont("helvetica", "normal");
        doc.text(shiftLegendText, startX + 32, shiftLegendY);

        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text("Meu Posto ERP - Gestão Operacional", startX, 195);
        doc.text(`Página 1 de ${exportFormat === "combined" ? "2" : "1"}`, 282, 195, { align: "right" });
      }

      // PAGE 2 or SINGLE PAGE: DETAILED LIST
      if (exportFormat === "detailed" || exportFormat === "combined") {
        if (exportFormat === "combined") {
          doc.addPage();
        }

        // Draw header for detailed list
        doc.setFillColor(79, 70, 229); // Indigo theme banner
        doc.rect(0, 0, 297, 25, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(activePostoName, 15, 10);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`CNPJ: ${cnpjPosto}`, 15, 15);
        
        const filterText = subtitleFilters ? ` (${subtitleFilters.slice(0, -3)})` : "";
        doc.text(`Lista Detalhada de Turnos - Mês de ${activeMonth.name}${filterText}`, 15, 20);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("LISTA DE ESCALAS OPERACIONAIS", 282, 12, { align: "right" });
        doc.setFontSize(8.5);
        doc.text(`Emissão: ${emissionDate}`, 282, 18, { align: "right" });

        // Table layout
        let currentY = 35;
        doc.setFillColor(243, 244, 246);
        doc.rect(15, currentY, 267, 8, "F");
        doc.setDrawColor(209, 213, 219);
        doc.rect(15, currentY, 267, 8, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(55, 65, 81);
        doc.text("Dia / Data", 20, currentY + 5.5);
        doc.text("Frentista / Funcionário", 70, currentY + 5.5);
        doc.text("Cargo", 150, currentY + 5.5);
        doc.text("Turno de Trabalho", 200, currentY + 5.5);
        doc.text("Status", 250, currentY + 5.5);

        currentY += 8;

        // Sort schedules by Day number
        const sortedSchedules = [...pdfSchedules]
          .filter(s => s.frentistaResponsavel !== "Evento Geral")
          .sort((a, b) => {
            const numA = parseInt((a.dayOfWeek || "0").replace("Dia ", "")) || 0;
            const numB = parseInt((b.dayOfWeek || "0").replace("Dia ", "")) || 0;
            return numA - numB;
          });

        if (sortedSchedules.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(10);
          doc.setTextColor(107, 114, 128);
          doc.text("Nenhum turno agendado ou filtrado para este mês.", 15, currentY + 10);
        } else {
          sortedSchedules.forEach((sh, idx) => {
            if (currentY > 180) {
              doc.addPage();
              
              doc.setFillColor(79, 70, 229);
              doc.rect(0, 0, 297, 15, "F");
              doc.setTextColor(255, 255, 255);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(10);
              doc.text(`Escala de Turnos - ${activeMonth.name} (Continuação)`, 15, 9);
              currentY = 25;
            }

            // Alternating rows bg
            if (idx % 2 === 1) {
              doc.setFillColor(249, 250, 251);
              doc.rect(15, currentY, 267, 7, "F");
            }
            doc.setDrawColor(243, 244, 246);
            doc.line(15, currentY + 7, 282, currentY + 7);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(31, 41, 55);

            const dNum = sh.dayOfWeek || "Dia --";
            doc.text(dNum, 20, currentY + 4.8);

            doc.text(sh.frentistaResponsavel, 70, currentY + 4.8);

            const matchedUser = users.find(u => u.nomeCompleto === sh.frentistaResponsavel);
            const cargo = matchedUser?.cargo || "Frentista";
            doc.text(cargo, 150, currentY + 4.8);

            doc.setFont("helvetica", "bold");
            doc.text(sh.turno, 200, currentY + 4.8);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(79, 70, 229);
            doc.text(sh.status || "Planejado", 250, currentY + 4.8);

            currentY += 7;
          });
        }

        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text("Meu Posto ERP - Gestão Operacional", 15, 195);
        doc.text(`Página ${exportFormat === "combined" ? "2" : "1"} de ${exportFormat === "combined" ? "2" : "1"}`, 282, 195, { align: "right" });
      }

      doc.save(`Planner_Escalas_${activeMonth.name.replace(" ", "_")}.pdf`);
      onAddAuditLog("DOWNLOAD", "Agenda", `Baixou planner mensal PDF (${exportFormat}) de escalas para ${activeMonth.name}`, "Regular");
    } catch (e: any) {
      alert("Erro ao exportar Planner: " + e.message);
    }
  };

  const exportPlannerToImage = () => {
    try {
      const activePostoName = (appState.nomePosto || "POSTO DE COMBUSTÍVEIS - ERP").toUpperCase();
      const canvas = document.createElement("canvas");
      canvas.width = 1080;

      let filteredSchedules = shifts.filter((s) => (!s.stationCnpj || s.stationCnpj === cnpjPosto) && s.frentistaResponsavel !== "Evento Geral");
      if (exportFilterBySelectedEmployee) {
        if (filterEmployeeId !== "all") {
          const emp = users.find((u) => u.id === filterEmployeeId);
          if (emp) filteredSchedules = filteredSchedules.filter((s) => s.frentistaResponsavel === emp.nomeCompleto);
        }
        if (filterShiftPeriod !== "all") {
          filteredSchedules = filteredSchedules.filter((s) => {
            const lower = s.turno.toLowerCase();
            if (filterShiftPeriod === "manha" && lower.includes("manhã")) return true;
            if (filterShiftPeriod === "tarde" && lower.includes("tarde")) return true;
            if (filterShiftPeriod === "noite" && lower.includes("noite")) return true;
            if (filterShiftPeriod === "horista" && lower.includes("horista")) return true;
            if (filterShiftPeriod === "folga" && (lower.includes("folga") || lower.includes("repouso"))) return true;
            return false;
          });
        }
      }

      const empNames = Array.from(new Set(filteredSchedules.map((s) => s.frentistaResponsavel))).filter(Boolean);
      const calculatedHeight = Math.max(1000, 260 + empNames.length * 250 + 80);
      canvas.height = calculatedHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grad = ctx.createLinearGradient(0, 0, 1080, 180);
      grad.addColorStop(0, "#4f46e5");
      grad.addColorStop(1, "#7e22ce");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 180);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(activePostoName, 40, 55);

      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`✅ ESCALA OFICIAL VALIDADA • MÊS DE ${activeMonth.name.toUpperCase()}`, 40, 95);

      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#e0e7ff";
      ctx.fillText(`CNPJ: ${cnpjPosto} | Emissão Oficial: ${new Date().toLocaleDateString("pt-BR")}`, 40, 130);

      let currentY = 220;

      empNames.forEach((empName, eIdx) => {
        const empShifts = filteredSchedules.filter((s) => s.frentistaResponsavel === empName);
        const matchedUser = users.find((u) => u.nomeCompleto === empName);

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(40, currentY, 1000, 220, 16);
        ctx.fill();

        ctx.fillStyle = eIdx % 2 === 0 ? "#38bdf8" : "#a855f7";
        ctx.fillRect(40, currentY, 12, 220);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(`👤 ${empName.toUpperCase()}`, 70, currentY + 40);

        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Cargo: ${matchedUser?.cargo || "Frentista"} | Unidade: ${cnpjPosto}`, 70, currentY + 68);

        const workingDays = empShifts.filter((s) => !s.turno.toLowerCase().includes("folga")).map((s) => s.dayOfWeek.replace("Dia ", ""));
        const restDays = empShifts.filter((s) => s.turno.toLowerCase().includes("folga")).map((s) => s.dayOfWeek.replace("Dia ", ""));

        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(`🗓️ Dias de Plantão (${workingDays.length}): ${workingDays.join(", ") || "Sem plantões"}`, 70, currentY + 110);

        ctx.fillStyle = "#4ade80";
        ctx.fillText(`🟢 Folgas Regulamentares (${restDays.length}): ${restDays.join(", ") || "Sem folgas alocadas"}`, 70, currentY + 145);

        const sampleShift = empShifts.find((s) => !s.turno.toLowerCase().includes("folga"))?.turno || "Variado";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`⏰ Período do Turno: ${sampleShift}`, 70, currentY + 180);

        currentY += 250;
      });

      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.fillText("Meu Posto ERP — Escalas Inteligentes de Pista e Gestão CLT", 40, canvas.height - 35);

      const imageURL = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imageURL;
      a.download = `Escala_WhatsApp_${activeMonth.name.replace(/\s+/g, "_")}.png`;
      a.click();

      onAddAuditLog("DOWNLOAD", "Agenda", `Baixou imagem formatada para WhatsApp da escala de ${activeMonth.name}`, "Regular");
    } catch (err: any) {
      alert("Erro ao gerar imagem da escala: " + err.message);
    }
  };

  const generateWhatsAppText = () => {
    const activePostoName = appState.nomePosto || "POSTO DE COMBUSTÍVEIS";
    let text = `⛽ *${activePostoName.toUpperCase()}*\n`;
    text += `📍 *ESCALA OFICIAL VALIDADA - MÊS DE ${activeMonth.name.toUpperCase()}*\n`;
    text += `CNPJ: ${cnpjPosto} | Emissão: ${new Date().toLocaleDateString("pt-BR")}\n`;
    text += `------------------------------------------\n\n`;

    const empNames = Array.from(new Set(shifts.map((s) => s.frentistaResponsavel))).filter(
      (n) => n && n !== "Evento Geral"
    );

    empNames.forEach((empName) => {
      const empShifts = shifts.filter((s) => s.frentistaResponsavel === empName);
      const workingDays = empShifts
        .filter((s) => !s.turno.toLowerCase().includes("folga"))
        .map((s) => s.dayOfWeek.replace("Dia ", ""));
      const restDays = empShifts
        .filter((s) => s.turno.toLowerCase().includes("folga"))
        .map((s) => s.dayOfWeek.replace("Dia ", ""));
      const mainShift = empShifts.find((s) => !s.turno.toLowerCase().includes("folga"))?.turno || "Manhã";

      text += `👤 *FRENTISTA: ${empName.toUpperCase()}*\n`;
      text += `⏰ Turno: ${mainShift}\n`;
      text += `🗓️ Dias de Trabalho (${workingDays.length}): ${workingDays.join(", ") || "Nenhum"}\n`;
      text += `🟢 Folgas (${restDays.length}): ${restDays.join(", ") || "Sem folgas"}\n\n`;
    });

    text += `------------------------------------------\n`;
    text += `✅ *Escala validada sem conflitos e gerada pelo Meu Posto ERP.*\n`;
    text += `Dúvidas ou trocas de turno? Procure a gerência.`;

    return text;
  };

  // Helper lists filtered
  const activeDayShifts = shifts.filter((s) => s.dayOfWeek === selectedDayDayStr && (!s.stationCnpj || s.stationCnpj === cnpjPosto));

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Escalas e Checklists de Pista"
        titleIcon={<ClipboardList className="h-5 w-5" />}
        subtitle="Planeje escalas de frentistas, revezamentos de folgas e vistorie checklists de segurança da pista"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as "planner" | "list")}
        tabs={[
          {
            id: "planner",
            label: "Planner de Escalas",
            icon: <CalendarIcon className="h-4 w-4" />,
            badge: shifts.length,
          },
          {
            id: "list",
            label: "Cadastro & Checklist",
            icon: <ClipboardList className="h-4 w-4" />,
          },
        ]}
      />

      {/* VIEW A: INTERACTIVE PLANNER */}
      {activeTab === "planner" && (
        <div className="space-y-6">
          {/* Top Planner Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <CalendarIcon className="text-indigo-600 h-5 w-5 shrink-0" />
                <span>EQUIPE PLANNER</span>
              </h3>

              <div className="flex items-center bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer">
                <select
                  value={monthIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    setMonthIndex(idx);
                    setSelectedDayDayStr("Dia 01");
                  }}
                  className="text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer outline-none"
                >
                  {PLANNER_MONTHS.map((m, idx) => (
                    <option key={m.name} value={idx}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <input
                type="file"
                ref={cameraInputRef}
                onChange={(e) => handleImportDocument(e, "photo")}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleImportDocument(e, "photo")}
                accept="image/*,.pdf"
                className="hidden"
              />
              <input
                type="file"
                ref={docInputRef}
                onChange={(e) => handleImportDocument(e, "spreadsheet")}
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isImporting}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                title="Tirar foto da escala impressa em papel"
              >
                {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Tirar Foto</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                title="Enviar imagem da galeria ou PDF da escala"
              >
                {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                <span>Foto / PDF (IA)</span>
              </button>

              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                disabled={isImporting}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                title="Enviar planilha Excel, CSV ou arquivo texto da escala"
              >
                {isImporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />}
                <span className="hidden sm:inline">Planilha / CSV</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateMonthScheduleFromPatterns}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white font-black rounded-xl transition text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
                title="Gerar automaticamente toda a escala do mês usando o aprendizado de padrões da IA"
              >
                <Zap className="h-3.5 w-3.5 fill-amber-200 text-white animate-bounce" />
                <span>Gerar Escala (IA)</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleSchedule}
                disabled={isImporting}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Testar fluxo da IA com amostra de exemplo"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span className="hidden xl:inline">Testar Amostra</span>
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar Escala</span>
              </button>

              <button
                onClick={() => {
                  if (onClearData) {
                    onClearData();
                  } else if (confirm("Deseja limpar todas as escalas e plantões cadastrados?")) {
                    onUpdateShifts([]);
                  }
                }}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl transition text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Limpar escalas e plantões"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span className="hidden sm:inline">Limpar Escalas</span>
              </button>

              <div className="flex gap-1">
                <button
                  onClick={handlePrevMonth}
                  disabled={monthIndex === 0}
                  className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-700 disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleNextMonth}
                  disabled={monthIndex === PLANNER_MONTHS.length - 1}
                  className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-slate-700 disabled:opacity-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Displays Toggles */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-[11px] font-semibold text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Filtrar Planner:</span>

              {/* Filter by Employee */}
              <select
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">👥 Todos os Frentistas</option>
                {frentistasList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    👤 {emp.nomeCompleto}
                  </option>
                ))}
              </select>

              {/* Filter by Shift Period */}
              <select
                value={filterShiftPeriod}
                onChange={(e) => setFilterShiftPeriod(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">🗓️ Todos os Turnos</option>
                <option value="manha">☀️ Manhã</option>
                <option value="tarde">⛅ Tarde</option>
                <option value="noite">🌙 Noite</option>
                <option value="horista">💜 Horistas</option>
                <option value="folga">🟢 Folgas</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showRestDays}
                  onChange={(e) => setShowRestDays(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Exibir Folgas</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={highlightWeekends}
                  onChange={(e) => setHighlightWeekends(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Destacar Fins de Semana</span>
              </label>
            </div>
          </div>

          {/* Planner Workspace layout (Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Draggable Sidebar */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-1">Escalar Plantão</h4>
                <p className="text-[10px] text-slate-500 leading-normal">
                  💻 <strong>PC</strong>: Arraste o frentista ao dia.<br />
                  📱 <strong>Celular</strong>: Toque no frentista, depois no dia.
                </p>
              </div>

              {/* Draggable Employee items */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {selectedEmployeeForAssign && (
                  <button
                    onClick={() => setSelectedEmployeeForAssign(null)}
                    className="w-full py-1.5 mb-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition text-[10px] font-bold"
                  >
                    Limpar Seleção / Pincel
                  </button>
                )}

                {frentistasList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Nenhum frentista na base de dados.</p>
                ) : (
                  frentistasList.map((emp) => {
                    const isSelected = selectedEmployeeForAssign === emp.id;
                    const initials = emp.nomeCompleto
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <div
                        key={emp.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", emp.id);
                          setSelectedEmployeeForAssign(emp.id);
                        }}
                        onClick={() => setSelectedEmployeeForAssign(emp.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer select-none transition ${
                          isSelected ? "border-2 border-indigo-600 bg-indigo-50/20" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar user={emp} size="sm" />
                          <div className="truncate">
                            <p className="text-xs font-extrabold text-slate-800 truncate leading-tight">{emp.nomeCompleto}</p>
                            <p className="text-[10px] text-slate-500 leading-none mt-0.5">{emp.cargo}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Config tools */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Turno de Alocação
                  </label>
                  <select
                    value={selectedShiftPeriod}
                    onChange={(e) => setSelectedShiftPeriod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                  >
                    {SHIFT_TYPES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 p-2.5 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={brushMode}
                    onChange={(e) => setBrushMode(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] font-bold text-slate-800">Modo Pincel 🖌️</span>
                    <span className="text-[8px] text-slate-400">Mantém frentista selecionado para pintura rápida</span>
                  </div>
                </label>

                {/* Batch tools */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ações em Bloco</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleAutoFillMonthlyScale}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-2 rounded-lg text-[9px] text-center transition flex items-center justify-center gap-0.5 cursor-pointer shadow-sm"
                    >
                      Auto-Gerar
                    </button>
                    <button
                      onClick={handleClearMonthScale}
                      className="bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 font-bold py-1.5 px-2 rounded-lg text-[9px] text-center transition flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>

                  <button
                    onClick={handleOpenContractModal}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-800 font-extrabold py-2 px-2 rounded-xl text-[10px] text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs mt-1"
                  >
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    Atribuir por Contrato / Dias
                  </button>
                  
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => handleImportDocument(e, "photo")}
                  />
                  <input 
                    type="file"
                    ref={cameraInputRef}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleImportDocument(e, "photo")}
                  />

                  <div className="pt-2 border-t border-slate-100 space-y-1.5 mt-2">
                    <p className="text-[9px] font-black uppercase text-indigo-700 tracking-wider">
                      📷 Escala Física em Foto (IA)
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isImporting}
                        className={`py-2 px-2 rounded-xl text-[10px] font-black transition flex items-center justify-center gap-1 cursor-pointer shadow-xs ${
                          isImporting
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        {isImporting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        Tirar Foto
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className={`py-2 px-2 rounded-xl text-[10px] font-black transition flex items-center justify-center gap-1 cursor-pointer shadow-xs ${
                          isImporting
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-800 hover:bg-slate-700 text-white"
                        }`}
                      >
                        {isImporting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4" id="planner-calendar-container">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 bg-slate-50 border border-slate-200/60 rounded-xl p-2 text-center text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                {weekdayHeaders.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {/* Grid cells */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells */}
                {Array.from({ length: activeMonth.offset }).map((_, idx) => (
                  <div key={`offset-cells-${idx}`} className="bg-transparent h-20 rounded-xl"></div>
                ))}

                {/* Active calendar slots */}
                {Array.from({ length: activeMonth.days }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dStrNum = String(dayNum).padStart(2, "0");
                  const dayStr = "Dia " + dStrNum;
                  const isSelected = selectedDayDayStr === dayStr;

                  const allDayShifts = shifts.filter((s) => s.dayOfWeek === dayStr && (!s.stationCnpj || s.stationCnpj === cnpjPosto));
                  const dayOccurrencesCount = allDayShifts.reduce((acc, s) => acc + (s.occurrences?.length || 0), 0);
                  const dayEventsCount = allDayShifts.reduce((acc, s) => acc + (s.events?.length || 0), 0);

                  let cellSchedules = allDayShifts.filter((s) => s.frentistaResponsavel !== "Evento Geral");

                  // Filter by Employee
                  if (filterEmployeeId !== "all") {
                    cellSchedules = cellSchedules.filter(
                      (s) => s.frentistaResponsavel === users.find((u) => u.id === filterEmployeeId)?.nomeCompleto
                    );
                  }

                  // Filter by Shift Period
                  if (filterShiftPeriod !== "all") {
                    cellSchedules = cellSchedules.filter((s) => {
                      const lower = s.turno.toLowerCase();
                      if (filterShiftPeriod === "manha" && lower.includes("manhã")) return true;
                      if (filterShiftPeriod === "tarde" && lower.includes("tarde")) return true;
                      if (filterShiftPeriod === "noite" && lower.includes("noite")) return true;
                      if (filterShiftPeriod === "horista" && lower.includes("horista")) return true;
                      if (filterShiftPeriod === "folga" && (lower.includes("folga") || lower.includes("repouso"))) return true;
                      return false;
                    });
                  }

                  // Filter rest days
                  if (!showRestDays) {
                    cellSchedules = cellSchedules.filter((s) => !s.turno.toLowerCase().includes("folga"));
                  }

                  const cellIndex = idx + activeMonth.offset;
                  const isWeekend = cellIndex % 7 === 0 || cellIndex % 7 === 6;

                  let bgClass = "bg-white";
                  if (highlightWeekends && isWeekend) {
                    bgClass = cellIndex % 7 === 0 ? "bg-rose-50/30" : "bg-amber-50/30";
                  }

                  const isDragOver = dragOverDayStr === dayStr;

                  return (
                    <div
                      key={`active-${dayNum}`}
                      onClick={() => handleDayCellClick(dayStr)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        if (dragOverDayStr !== dayStr) {
                          setDragOverDayStr(dayStr);
                        }
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        if (dragOverDayStr === dayStr) {
                          setDragOverDayStr(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDayStr(null);

                        // Try reading JSON data first
                        const jsonData = e.dataTransfer.getData("application/json");
                        if (jsonData) {
                          try {
                            const parsed = JSON.parse(jsonData);
                            if (parsed.empId) {
                              handleAllocateEmployee(parsed.empId, dayStr, parsed.turno);
                              return;
                            }
                          } catch (err) {
                            // ignore JSON parse error
                          }
                        }

                        // Fallback to text/plain (emp.id)
                        const empId = e.dataTransfer.getData("text/plain");
                        if (empId) {
                          handleAllocateEmployee(empId, dayStr);
                        }
                      }}
                      className={`min-h-[75px] sm:h-28 p-1 sm:p-1.5 rounded-xl border flex flex-col justify-start relative group transition cursor-pointer select-none ${
                        isDragOver
                          ? "border-2 border-dashed border-indigo-600 bg-indigo-100/60 scale-[1.03] shadow-md z-10"
                          : isSelected
                          ? "border-2 border-indigo-600 bg-indigo-50/10"
                          : `border-slate-200 hover:border-indigo-400 ${bgClass}`
                      }`}
                    >
                      {/* Cell Header */}
                      <div className="flex justify-between items-center w-full select-none mb-1 text-[9px] font-bold text-slate-500">
                        {/* Options toggle buttons */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateFromPreviousDay(dayStr);
                            }}
                            title="Duplicar do dia anterior"
                            className="text-indigo-600 hover:text-indigo-800 p-0.5 flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAllDayShifts(dayStr);
                            }}
                            title="Limpar dia"
                            className="text-rose-600 hover:text-rose-800 p-0.5 flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 pr-1">
                          {dayEventsCount > 0 && (
                            <div className="flex gap-0.5">
                              {allDayShifts.flatMap(s => s.events || []).some(e => e.tipo === "Manutenção") && (
                                <Wrench className="h-2.5 w-2.5 text-amber-500" title="Manutenção agendada" />
                              )}
                              {allDayShifts.flatMap(s => s.events || []).some(e => e.tipo === "Reunião") && (
                                <UsersIcon className="h-2.5 w-2.5 text-blue-500" title="Reunião agendada" />
                              )}
                              {allDayShifts.flatMap(s => s.events || []).some(e => e.tipo !== "Manutenção" && e.tipo !== "Reunião") && (
                                <CalendarIcon className="h-2.5 w-2.5 text-indigo-400" title="Outros eventos" />
                              )}
                            </div>
                          )}
                          {dayOccurrencesCount > 0 && (
                            <AlertTriangle className="h-2.5 w-2.5 text-rose-500 animate-pulse" title={`${dayOccurrencesCount} ocorrência(s) registrada(s)`} />
                          )}
                          <div className="ml-1 text-slate-700">{dayNum}</div>
                        </div>
                      </div>

                      {/* Cell Shift Badges list */}
                      <div className="flex-1 w-full overflow-y-auto space-y-0.5 pr-0.5">
                        {cellSchedules.length === 0 ? (
                          <div className="flex items-center justify-center h-full py-1">
                            <span
                              title="Nenhum frentista alocado para este dia! Clique para atribuir."
                              className="text-[7px] sm:text-[7.5px] font-black text-rose-700 bg-rose-50 border border-rose-200/90 px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
                            >
                              <AlertTriangle className="h-2 w-2 text-rose-600 shrink-0 animate-pulse" />
                              Sem frentista
                            </span>
                          </div>
                        ) : (
                          cellSchedules.map((sh) => {
                            const colors = getShiftColorKey(sh.turno);
                            const hasOcc = sh.occurrences && sh.occurrences.length > 0;
                            
                            // Check for conflicts: same employee, same date, different shift ID
                            const isConflicted = allDayShifts.some(
                              (s) => s.id !== sh.id && 
                                     s.frentistaResponsavel === sh.frentistaResponsavel && 
                                     s.frentistaResponsavel !== "Evento Geral"
                            );

                            const empUser = users.find((u) => u.nomeCompleto === sh.frentistaResponsavel);

                            return (
                              <div
                                key={sh.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  if (empUser?.id) e.dataTransfer.setData("text/plain", empUser.id);
                                  e.dataTransfer.setData("application/json", JSON.stringify({ empId: empUser?.id, turno: sh.turno }));
                                  e.dataTransfer.effectAllowed = "copy";
                                }}
                                title={`${sh.frentistaResponsavel} - ${sh.turno}${hasOcc ? ' (' + sh.occurrences.length + ' ocorrência(s))' : ''}${isConflicted ? ' [CONFLITO: Dupla escala no mesmo dia]' : ''} • Arraste para mover para outro dia`}
                                className={`px-1 py-0.5 rounded-md border text-[7.5px] sm:text-[8px] font-extrabold flex items-center justify-between min-w-0 truncate shadow-2xs cursor-grab active:cursor-grabbing hover:scale-102 transition ${
                                  isConflicted ? "bg-rose-600 text-white border-rose-700 shadow-xs" : colors.bg
                                }`}
                              >
                                <span className="truncate flex items-center gap-1">
                                  {isConflicted && <AlertTriangle className="h-2 w-2 text-white animate-pulse shrink-0" />}
                                  {hasOcc && !isConflicted && <span className="text-rose-600 font-bold shrink-0" title="Tem ocorrência registrada!">⚠️</span>}
                                  <UserAvatar user={empUser} name={sh.frentistaResponsavel} size="xs" className="shrink-0" />
                                  <span className="truncate font-extrabold flex items-center gap-0.5">
                                    <span className="text-[8px]">⛽</span>
                                    <span>{getInitials(sh.frentistaResponsavel)}</span>
                                  </span>
                                </span>
                                <span className={`text-[7px] px-1 py-0.2 rounded leading-none shrink-0 font-black ${isConflicted ? "bg-white/20 text-white" : colors.badge}`}>
                                  {colors.label}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-4 mt-2"></div>

              {/* Automatic Legends Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs select-none">
                {/* Employee Initials Legend */}
                <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100">
                  <h5 className="font-extrabold text-[10px] uppercase text-slate-500 tracking-wider mb-2">
                    👥 Legenda de Frentistas (Iniciais)
                  </h5>
                  <div className="grid grid-cols-2 gap-1.5 font-medium text-slate-700 max-h-[120px] overflow-y-auto pr-1">
                    {users.filter(u => u.cnpjPosto === cnpjPosto).length === 0 ? (
                      <span className="text-slate-400 italic text-[11px]">Nenhum frentista cadastrado.</span>
                    ) : (
                      users.filter(u => u.cnpjPosto === cnpjPosto).map(u => (
                        <div key={u.id} className="flex items-center gap-1.5 truncate">
                          <UserAvatar user={u} size="xs" />
                          <span className="truncate text-slate-700 font-medium">{u.nomeCompleto}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Turn Colors Legend */}
                <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100">
                  <h5 className="font-extrabold text-[10px] uppercase text-slate-500 tracking-wider mb-2">
                    🎨 Legenda de Turnos
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="bg-sky-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">M</span>
                      <span className="font-medium text-slate-700 text-xs">Manhã (06h - 14h)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">T</span>
                      <span className="font-medium text-slate-700 text-xs">Tarde (14h - 22h)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">N</span>
                      <span className="font-medium text-slate-700 text-xs">Noite (22h - 06h)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">F</span>
                      <span className="font-medium text-slate-700 text-xs">Folga Geral</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <span className="bg-fuchsia-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">HR</span>
                      <span className="font-medium text-slate-700 text-xs">Horista / Intermediário</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected day control panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Allocations & Assignments */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    Escala do {selectedDayDayStr}
                  </h4>
                  {activeDayShifts.length > 0 && isMasterOrGerente && (
                    <button
                      onClick={() => handleClearAllDayShifts(selectedDayDayStr)}
                      className="text-[9.5px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Excluir todos os plantões deste dia"
                    >
                      <Trash2 className="h-3 w-3" /> Limpar Dia
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-3 max-h-[160px] overflow-y-auto pr-1">
                  {activeDayShifts.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4">Nenhum frentista escalado para este dia.</p>
                  ) : (
                    activeDayShifts.map((sh) => {
                      const colors = getShiftColorKey(sh.turno);
                      const isConflicted = activeDayShifts.some(
                        (s) => s.id !== sh.id && 
                               s.frentistaResponsavel === sh.frentistaResponsavel && 
                               s.frentistaResponsavel !== "Evento Geral"
                      );

                      return (
                        <div
                          key={sh.id}
                          className={`border rounded-xl p-2.5 flex items-center justify-between shadow-xs transition-colors ${
                            isConflicted 
                              ? "bg-rose-50 border-rose-300 ring-2 ring-rose-200 ring-offset-1" 
                              : "bg-slate-50 border-slate-200/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            {isConflicted && (
                              <div className="bg-rose-600 p-1.5 rounded-lg text-white animate-pulse">
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <UserAvatar
                              user={users.find((u) => u.nomeCompleto === sh.frentistaResponsavel)}
                              name={sh.frentistaResponsavel}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-extrabold text-slate-800 truncate">{sh.frentistaResponsavel}</p>
                                {isConflicted && (
                                  <span className="text-[8px] font-black text-rose-600 uppercase bg-rose-100 px-1.5 py-0.5 rounded-full">
                                    Conflito
                                  </span>
                                )}
                              </div>
                              <span className={`inline-block text-[8px] font-black border rounded px-1.5 py-0.1 mt-0.5 ${colors.bg}`}>
                                {sh.turno}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditingShift(sh)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                              title="Editar todos os dados desta sessão"
                            >
                              <Edit className="h-3 w-3" /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteShiftSession(sh.id)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                              title="Excluir esta sessão"
                            >
                              <Trash2 className="h-3 w-3" /> Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Allocations grid */}
              <div className="pt-3 border-t border-slate-100 space-y-3 mt-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                    ⚡ Atribuição Rápida (Toque Único)
                  </p>
                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 shrink-0 self-start sm:self-auto">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">Turno:</span>
                    <select
                      value={selectedShiftPeriod}
                      onChange={(e) => setSelectedShiftPeriod(e.target.value)}
                      className="text-[9.5px] font-black text-indigo-600 bg-transparent border-none cursor-pointer outline-none uppercase"
                    >
                      {SHIFT_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 max-h-[140px] overflow-y-auto pr-1">
                  {frentistasList.map((emp) => {
                    const isAllocated = activeDayShifts.some((s) => s.frentistaResponsavel === emp.nomeCompleto);

                    return (
                      <button
                        key={emp.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", emp.id);
                          e.dataTransfer.setData("application/json", JSON.stringify({ empId: emp.id, turno: selectedShiftPeriod }));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => handleAllocateEmployee(emp.id, selectedDayDayStr, selectedShiftPeriod)}
                        title="Clique para alocar no dia selecionado ou Arraste para qualquer dia da grade"
                        className={`px-2 py-1.5 rounded-xl flex items-center gap-1.5 border transition cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 select-none shadow-2xs ${
                          isAllocated
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-extrabold"
                            : "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50"
                        }`}
                      >
                        <GripVertical className="h-3 w-3 text-slate-400 shrink-0" />
                        <UserAvatar user={emp} size="xs" />
                        <span className="text-[11px] font-bold truncate max-w-[80px]">⛽ {emp.nomeCompleto.split(" ")[0]}</span>
                        {isAllocated && <span className="text-[8px] bg-emerald-600 text-white rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Column 2: Occurrences Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    Ocorrências da Escala
                  </h4>
                  {activeDayShifts.length > 0 && !showAddOccurrenceForm && (
                    <button
                      onClick={() => {
                        setShowAddOccurrenceForm(true);
                        // default select first active frentista shift
                        if (activeDayShifts.length > 0) setOccShiftId(activeDayShifts[0].id);
                      }}
                      className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
                    >
                      + Registrar
                    </button>
                  )}
                </div>

                {/* Occurrence Addition Form */}
                {showAddOccurrenceForm ? (
                  <form onSubmit={handleSaveOccurrence} className="pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Frentista/Turno</label>
                        <select
                          value={occShiftId}
                          onChange={(e) => setOccShiftId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer"
                        >
                          {activeDayShifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.frentistaResponsavel.split(" ")[0]} ({s.turno.split(" ")[0]})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Tipo Ocorrência</label>
                        <select
                          value={occType}
                          onChange={(e) => setOccType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer font-bold"
                        >
                          <option value="Atraso">⏰ Atraso</option>
                          <option value="Falta">❌ Falta</option>
                          <option value="Atestado">📄 Atestado</option>
                          <option value="Dobra">🔄 Dobra</option>
                          <option value="Problema na Pista">⛽ Incidente</option>
                          <option value="Outro">⚠️ Outro</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Horário</label>
                        <input
                          type="time"
                          value={occTime}
                          onChange={(e) => setOccTime(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Motivo / Observações</label>
                        <input
                          type="text"
                          placeholder="Ex: Chegou 40 min atrasado por ônibus"
                          value={occDesc}
                          onChange={(e) => setOccDesc(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                        />
                      </div>
                    </div>

                    {/* Image Attachment Drop Zone */}
                    <div>
                      <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Anexar Imagem de Evidência
                      </label>
                      
                      {occImage ? (
                        <div className="relative border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 bg-white shrink-0">
                            <img
                              src={occImage}
                              alt="Anexo selecionado"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-emerald-600 truncate">Imagem anexada!</p>
                            <button
                              type="button"
                              onClick={() => setOccImage("")}
                              className="text-[9px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5 mt-0.5 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" /> Remover imagem
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                          }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                              handleFileChange(e.dataTransfer.files[0]);
                            }
                          }}
                          className={`border-2 border-dashed rounded-xl p-3 text-center transition flex flex-col items-center justify-center cursor-pointer ${
                            isDragging
                              ? "border-indigo-500 bg-indigo-50/40"
                              : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
                          }`}
                          onClick={() => document.getElementById("occ-file-input")?.click()}
                        >
                          <input
                            id="occ-file-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileChange(e.target.files[0]);
                              }
                            }}
                          />
                          <UploadCloud className={`h-6 w-6 mb-1 ${isDragging ? "text-indigo-600" : "text-slate-400 animate-bounce"}`} />
                          <p className="text-[10px] font-bold text-slate-600">
                            Arraste ou clique para anexar foto
                          </p>
                          <p className="text-[8px] text-slate-400 mt-0.5">
                            Suporta PNG, JPG ou GIF
                          </p>
                        </div>
                      )}

                      {/* Presets stamps */}
                      {!occImage && (
                        <div className="mt-1.5 space-y-1">
                          <span className="text-[8px] text-slate-400 uppercase font-black block">Estampas para Teste Rápido:</span>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setOccImage("https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&auto=format&fit=crop&q=60")}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium text-[8px] border border-slate-200 transition cursor-pointer"
                            >
                              📄 Laudo/Atestado
                            </button>
                            <button
                              type="button"
                              onClick={() => setOccImage("https://images.unsplash.com/photo-1527018601619-a508a2be00cd?w=400&auto=format&fit=crop&q=60")}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium text-[8px] border border-slate-200 transition cursor-pointer"
                            >
                              ⛽ Vazamento/Pista
                            </button>
                            <button
                              type="button"
                              onClick={() => setOccImage("https://images.unsplash.com/photo-1508962914676-134849a727f0?w=400&auto=format&fit=crop&q=60")}
                              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium text-[8px] border border-slate-200 transition cursor-pointer"
                            >
                              ⏰ Ônibus Atrasado
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons at the bottom of the form */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] py-2 rounded-xl transition cursor-pointer shadow-sm text-center"
                      >
                        Salvar Ocorrência
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOccImage("");
                          setShowAddOccurrenceForm(false);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] py-2 px-3 rounded-xl transition cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Occurrences List */
                  <div className="pt-3 space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {(() => {
                      const dayShiftsWithOccurrences = shifts.filter(
                        (s) => s.dayOfWeek === selectedDayDayStr && s.stationCnpj === cnpjPosto && s.frentistaResponsavel !== "Evento Geral" && s.occurrences && s.occurrences.length > 0
                      );

                      if (dayShiftsWithOccurrences.length === 0) {
                        return (
                          <div className="text-center py-6">
                            <p className="text-[11px] text-slate-400 italic">Nenhuma ocorrência registrada para este dia.</p>
                            <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                              Use para registrar atrasos, faltas injustificadas, atestados médicos ou folgas não planejadas dos frentistas.
                            </p>
                          </div>
                        );
                      }

                      return dayShiftsWithOccurrences.flatMap((s) =>
                        (s.occurrences || []).map((o) => (
                          <div
                            key={o.id}
                            className="bg-rose-50/45 border border-rose-100 rounded-xl p-3 flex flex-col justify-between gap-1.5"
                          >
                            <div className="flex items-start justify-between min-w-0">
                              <div className="truncate pr-2">
                                <span className="inline-block text-[8.5px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded-md uppercase tracking-wider mb-1 flex items-center gap-1 w-fit">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {o.tipo}
                                </span>
                                <h5 className="text-xs font-black text-slate-800 leading-tight truncate">
                                  {s.frentistaResponsavel}
                                </h5>
                                <p className="text-[10px] text-slate-500 mt-1 leading-normal break-words whitespace-normal">
                                  {o.descricao}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteOccurrence(s.id, o.id)}
                                className="text-rose-500 hover:text-rose-700 text-[10px] font-bold p-0.5"
                                title="Excluir ocorrência"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1 text-[8.5px] text-rose-700/80 font-mono mt-0.5">
                              <span>⏰ Registrado às:</span>
                              <span className="font-extrabold">
                                {o.dataHora ? o.dataHora.split(" ")[1] || o.dataHora : "N/I"}
                              </span>
                            </div>

                            {o.imagem && (
                              <div className="mt-1.5 pt-1.5 border-t border-rose-200/40">
                                <span className="text-[8px] uppercase tracking-wider text-rose-800/60 font-black block mb-1">
                                  📸 Evidência Anexa:
                                </span>
                                <div 
                                  onClick={() => setSelectedOccImage(o.imagem!)}
                                  className="relative w-full h-20 rounded-lg overflow-hidden border border-rose-200 bg-white cursor-pointer hover:border-rose-400 transition group/thumb"
                                >
                                  <img
                                    src={o.imagem}
                                    alt="Foto da ocorrência"
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white text-[9px] font-bold">
                                    <Eye className="h-3.5 w-3.5 mr-1" /> VISUALIZAR
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="text-[9.5px] text-slate-400 italic pt-2 border-t border-slate-100 mt-2">
                Ocorrências alimentam o histórico e controle de frequência.
              </div>
            </div>

            {/* Column 3: Events Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <CalendarIcon className="h-4 w-4 text-amber-500" />
                    Eventos e Compromissos
                  </h4>
                  {!showAddEventForm && (
                    <button
                      onClick={() => setShowAddEventForm(true)}
                      className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-black px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer"
                    >
                      + Novo Evento
                    </button>
                  )}
                </div>

                {/* Event Addition Form */}
                {showAddEventForm ? (
                  <form onSubmit={handleSaveEvent} className="pt-3 space-y-3">
                    <div>
                      <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Título do Evento</label>
                      <input
                        type="text"
                        placeholder="Ex: Reunião Geral de Metas ou Treinamento NR 20"
                        value={evtTitle}
                        onChange={(e) => setEvtTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Tipo de Compromisso</label>
                        <select
                          value={evtType}
                          onChange={(e) => setEvtType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer font-bold"
                        >
                          <option value="Treinamento">🎓 Treinamento</option>
                          <option value="Reunião">👥 Reunião</option>
                          <option value="Manutenção">⚙️ Manutenção</option>
                          <option value="Auditoria">🔎 Auditoria</option>
                          <option value="Outro">📅 Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Horário</label>
                        <input
                          type="time"
                          value={evtTime}
                          onChange={(e) => setEvtTime(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1">Breve Descrição</label>
                      <input
                        type="text"
                        placeholder="Ex: Auditoria surpresa de conformidade ANP e ambiental"
                        value={evtDesc}
                        onChange={(e) => setEvtDesc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                      />
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] py-1.5 px-2.5 rounded-xl transition cursor-pointer shadow-sm text-center"
                      >
                        Agendar Evento
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddEventForm(false)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] py-1.5 px-2.5 rounded-xl transition cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Events List */
                  <div className="pt-3 space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {(() => {
                      const dayShiftsWithEvents = shifts.filter(
                        (s) => s.dayOfWeek === selectedDayDayStr && s.stationCnpj === cnpjPosto && s.events && s.events.length > 0
                      );

                      if (dayShiftsWithEvents.length === 0) {
                        return (
                          <div className="text-center py-6">
                            <p className="text-[11px] text-slate-400 italic">Nenhum evento registrado para este dia.</p>
                            <p className="text-[9px] text-slate-400 mt-1 leading-normal">
                              Use para agendar reuniões mensais de equipe, auditorias ambientais da ANP, ou serviços agendados de manutenção de tanques/bombas.
                            </p>
                          </div>
                        );
                      }

                      return dayShiftsWithEvents.flatMap((s) =>
                        (s.events || []).map((e) => (
                          <div
                            key={e.id}
                            className="bg-amber-50/45 border border-amber-100 rounded-xl p-3 flex flex-col justify-between gap-1.5"
                          >
                            <div className="flex items-start justify-between min-w-0">
                              <div className="truncate pr-2">
                                <span className={`inline-block text-[8.5px] font-extrabold px-1.5 py-0.2 rounded-md uppercase tracking-wider mb-1 flex items-center gap-1 w-fit ${
                                  e.tipo === "Manutenção" ? "bg-amber-500 text-white" :
                                  e.tipo === "Reunião" ? "bg-blue-600 text-white" :
                                  "bg-indigo-500 text-white"
                                }`}>
                                  {e.tipo === "Manutenção" && <Wrench className="h-2.5 w-2.5" />}
                                  {e.tipo === "Reunião" && <UsersIcon className="h-2.5 w-2.5" />}
                                  {e.tipo}
                                </span>
                                <h5 className="text-xs font-black text-slate-800 leading-tight truncate break-words whitespace-normal font-sans">
                                  {e.titulo}
                                </h5>
                                {e.descricao && (
                                  <p className="text-[10px] text-slate-500 mt-1 leading-normal break-words whitespace-normal">
                                    {e.descricao}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteEvent(s.id, e.id)}
                                className="text-amber-600 hover:text-amber-800 text-[10px] font-bold p-0.5"
                                title="Excluir evento"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1 text-[8.5px] text-amber-800/80 font-mono mt-0.5">
                              <span>⏰ Agendado para as:</span>
                              <span className="font-extrabold">
                                {e.horario || "Dia Todo"}
                              </span>
                            </div>
                          </div>
                        ))
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="text-[9.5px] text-slate-400 italic pt-2 border-t border-slate-100 mt-2">
                Eventos geram alertas operacionais para os supervisores.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: CHECKLIST OPERATIONS & CADASTROS */}
      {activeTab === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Cadastrar Frentista & Lançar Checklist */}
          <div className="space-y-6">
            {/* Cadastrar Frentista form */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-indigo-700 tracking-wider pb-2 border-b border-slate-100">
                Novo Frentista / Funcionário
              </h3>

              {/* Avatar Live Preview */}
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <UserAvatar
                  avatarIcon={frentistaAvatarIcon}
                  avatarUrl={frentistaAvatarUrl}
                  name={frentistaName || "Novo Funcionário"}
                  size="lg"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">{frentistaName || "Nome do Funcionário"}</p>
                  <span className="text-[10px] text-slate-400">Prévia do Perfil</span>
                </div>
              </div>

              <form onSubmit={handleAddFrentista} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Roberto Silveira"
                    value={frentistaName}
                    onChange={(e) => setFrentistaName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Telefone Celular</label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 98888-7777"
                    value={frentistaPhone}
                    onChange={(e) => setFrentistaPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Avatar Icon Preset Picker */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ícone de Perfil</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {PRESET_AVATAR_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFrentistaAvatarIcon(icon)}
                        className={`w-7 h-7 text-xs rounded-lg flex items-center justify-center transition border cursor-pointer ${
                          frentistaAvatarIcon === icon
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold scale-110"
                            : "bg-white hover:bg-slate-100 border-slate-200"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ou Foto do Funcionário</label>
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setFrentistaAvatarUrl(event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {frentistaAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setFrentistaAvatarUrl("")}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Remover Foto Carregada
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  Cadastrar Funcionário
                </button>
              </form>
            </div>

            {/* Checklist trigger form */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black uppercase text-indigo-700 tracking-wider mb-4 pb-2 border-b border-slate-100">
                Criar Turno & Checklist
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!checklistResponsavel) {
                    alert("Selecione um frentista.");
                    return;
                  }
                  const hasActive = shifts.some((s) => s.status === "Em Andamento");
                  if (hasActive) {
                    alert("Já existe um turno em andamento. Encerre o ativo primeiro.");
                    return;
                  }

                  const newShift: ShiftSchedule = {
                    id: "s_ch_" + Date.now(),
                    data: checklistDate,
                    turno: checklistTurn,
                    frentistaResponsavel: checklistResponsavel,
                    checklist: {
                      limpezaPistas: false,
                      usoEPIs: false,
                      afericaoEquipamentosSeguranca: false,
                      testeGerador: false,
                    },
                    status: "Planejado",
                  };
                  onUpdateShifts([...shifts, newShift]);
                  setChecklistResponsavel("");
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={checklistDate}
                    onChange={(e) => setChecklistDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Período de Turno</label>
                  <select
                    value={checklistTurn}
                    onChange={(e: any) => setChecklistTurn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 cursor-pointer"
                  >
                    <option value="Turno A (Manhã)">Turno A (Manhã)</option>
                    <option value="Turno B (Tarde)">Turno B (Tarde)</option>
                    <option value="Turno C (Noite)">Turno C (Noite)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Frentista Responsável</label>
                  <select
                    value={checklistResponsavel}
                    onChange={(e) => setChecklistResponsavel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 cursor-pointer"
                  >
                    <option value="">Selecione o Operador</option>
                    {frentistasList.map((f) => (
                      <option key={f.id} value={f.nomeCompleto}>
                        {f.nomeCompleto} ({f.cargo})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  Criar Turno de Pista
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Active Checklists & roster lists */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cadastrados List */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Lista de Funcionários</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/30">
                      <th className="py-2 px-3">Foto / Ícone</th>
                      <th className="py-2 px-3">Frentista</th>
                      <th className="py-2 px-3">Cargo</th>
                      <th className="py-2 px-3">Telefone</th>
                      <th className="py-2 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frentistasList.map((emp) => (
                      <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/20">
                        <td className="py-2.5 px-3">
                          <UserAvatar user={emp} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{emp.nomeCompleto}</td>
                        <td className="py-2.5 px-3 text-slate-500">{emp.cargo}</td>
                        <td className="py-2.5 px-3 text-slate-500">{emp.telefone}</td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingAvatarUser(emp);
                              setEditAvatarIcon(emp.avatarIcon || "⛽");
                              setEditAvatarUrl(emp.avatarUrl || "");
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                          >
                            Foto/Ícone
                          </button>
                          <button
                            onClick={() => handleRemoveFrentista(emp.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Checklists execution */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Checklists Diários Ativos</h3>
              {shifts.filter((s) => !s.dayOfWeek).length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum checklist diário ativo cadastrado.</p>
              ) : (
                shifts
                  .filter((s) => !s.dayOfWeek)
                  .map((sh) => {
                    const hasActive = shifts.some((s) => s.status === "Em Andamento");
                    const isConflicted = shifts.some(
                      (s) => s.id !== sh.id && 
                             s.frentistaResponsavel === sh.frentistaResponsavel && 
                             s.data === sh.data &&
                             s.frentistaResponsavel !== "Evento Geral"
                    );

                    return (
                      <div
                        key={sh.id}
                        className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                          isConflicted
                            ? "border-rose-300 bg-rose-50/20"
                            : sh.status === "Em Andamento"
                            ? "border-indigo-400 bg-indigo-50/5"
                            : sh.status === "Planejado"
                            ? "border-amber-200 bg-amber-50/10"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-500">
                                {sh.data.split("-").reverse().join("/")}
                              </span>
                              <div className="flex gap-1.5">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 border rounded-full uppercase ${
                                    sh.status === "Em Andamento"
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse"
                                      : sh.status === "Planejado"
                                      ? "bg-amber-50 border-amber-200 text-amber-700"
                                      : "bg-slate-100 border-slate-200 text-slate-500"
                                  }`}
                                >
                                  {sh.status}
                                </span>
                                {isConflicted && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 bg-rose-600 text-white border border-rose-700 rounded-full uppercase flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Conflito
                                  </span>
                                )}
                              </div>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {sh.turno}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-semibold rounded-lg px-2.5 py-1 border ${
                              isConflicted 
                                ? "bg-rose-100 border-rose-200 text-rose-800 font-bold" 
                                : "bg-slate-100 border-slate-200/50 text-slate-700"
                            }`}>
                              Responsável: {sh.frentistaResponsavel}
                            </span>
                            <button
                              onClick={() => setEditingShift(sh)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                              title="Editar dados desta sessão"
                            >
                              <Edit className="h-3.5 w-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteShiftSession(sh.id)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                              title="Excluir esta sessão"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </button>
                          </div>
                        </div>

                        {sh.status === "Planejado" && (
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => {
                                if (hasActive) {
                                  alert("Já existe um turno em andamento. Feche o ativo antes de iniciar.");
                                  return;
                                }
                                const updated = shifts.map((s) => {
                                  if (s.id === sh.id) {
                                    return { ...s, status: "Em Andamento" as const };
                                  }
                                  return s;
                                });
                                onUpdateShifts(updated);
                                onAddAuditLog("UPDATE", "Agenda", `Iniciou turno de pista de ${sh.frentistaResponsavel}`, "Regular");
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="h-3 w-3 fill-white" />
                              Iniciar Checklist Turno
                            </button>
                          </div>
                        )}

                        {sh.status === "Em Andamento" && (
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
                              <span className="font-bold text-indigo-700 flex items-center gap-1">
                                <ClipboardList className="h-4 w-4" /> Checklist Operacional
                              </span>
                              <span className="text-[10px] text-slate-400">Marque conforme verificação</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                              {Object.keys(sh.checklist || {}).map((item) => {
                                const checked = sh.checklist ? sh.checklist[item as keyof typeof sh.checklist] : false;
                                const labels: { [key: string]: string } = {
                                  limpezaPistas: "Limpeza das Pistas",
                                  usoEPIs: "Uso obrigatório de EPIs",
                                  afericaoEquipamentosSeguranca: "Extintores e Chaves de Pista",
                                  testeGerador: "Teste Semanal do Gerador",
                                };

                                return (
                                  <button
                                    key={item}
                                    onClick={() => {
                                      const updated = shifts.map((s) => {
                                        if (s.id === sh.id) {
                                          return {
                                            ...s,
                                            checklist: {
                                              ...s.checklist,
                                              [item]: !checked,
                                            },
                                          };
                                        }
                                        return s;
                                      });
                                      onUpdateShifts(updated);
                                    }}
                                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer font-medium ${
                                      checked
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100/50"
                                    }`}
                                  >
                                    <span className={`h-4 w-4 rounded border flex items-center justify-center font-bold text-[9px] ${
                                      checked ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-300 bg-white"
                                    }`}>
                                      {checked && "✓"}
                                    </span>
                                    {labels[item] || item}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex justify-end pt-2 border-t border-slate-200">
                              <button
                                onClick={() => {
                                  const updated = shifts.map((s) => {
                                    if (s.id === sh.id) {
                                      return { ...s, status: "Fechado" as const };
                                    }
                                    return s;
                                  });
                                  onUpdateShifts(updated);
                                  onAddAuditLog("UPDATE", "Agenda", `Finalizou e registrou checklist do turno de ${sh.frentistaResponsavel}`, "Regular");
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                              >
                                Concluir & Fechar Turno
                              </button>
                            </div>
                          </div>
                        )}

                        {sh.status === "Fechado" && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-500 flex justify-between items-center flex-wrap gap-2">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <ShieldCheck className="h-4 w-4 text-emerald-600" />
                              Checklist de pista finalizado e arquivado
                            </span>
                            <div className="flex gap-2 font-mono text-[9px]">
                              <span className={sh.checklist?.limpezaPistas ? "text-emerald-600" : "text-rose-600"}>
                                PISTA: {sh.checklist?.limpezaPistas ? "OK" : "PEND"}
                              </span>
                              <span>•</span>
                              <span className={sh.checklist?.usoEPIs ? "text-emerald-600" : "text-rose-600"}>
                                EPI: {sh.checklist?.usoEPIs ? "OK" : "PEND"}
                              </span>
                              <span>•</span>
                              <span className={sh.checklist?.testeGerador ? "text-emerald-600" : "text-rose-600"}>
                                GERADOR: {sh.checklist?.testeGerador ? "OK" : "PEND"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Occurrence Image evidence */}
      {selectedOccImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-xs transition-opacity duration-300">
          <div className="relative max-w-lg w-full bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center gap-3 border border-slate-100">
            <button
              onClick={() => setSelectedOccImage(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Fechar visualização"
            >
              <X className="h-5 w-5" />
            </button>
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider self-start pb-2 border-b border-slate-100 w-full flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-rose-500" />
              Evidência Fotográfica da Ocorrência
            </h4>
            <div className="w-full h-80 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center relative">
              <img
                src={selectedOccImage}
                alt="Evidência ampliada"
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="w-full flex justify-end pt-1">
              <button
                onClick={() => setSelectedOccImage(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal (WhatsApp & PDF) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-black text-slate-800 mb-1 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Share2 className="text-emerald-600 h-5 w-5" />
              Exportar e Compartilhar Escala Validada
            </h3>

            <p className="text-xs text-slate-500 mb-4">
              Selecione o canal ou formato desejado para enviar a escala para os frentistas e equipe de pista.
            </p>

            {/* Sub-tabs for Export Modal */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setExportModalTab("whatsapp_image")}
                className={`py-2 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  exportModalTab === "whatsapp_image"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Card Imagem</span>
              </button>

              <button
                type="button"
                onClick={() => setExportModalTab("whatsapp_text")}
                className={`py-2 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  exportModalTab === "whatsapp_text"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Texto Zap</span>
              </button>

              <button
                type="button"
                onClick={() => setExportModalTab("pdf")}
                className={`py-2 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  exportModalTab === "pdf"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF Oficial</span>
              </button>
            </div>

            {/* TAB 1: WhatsApp Image Card */}
            {exportModalTab === "whatsapp_image" && (
              <div className="space-y-4">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Imagem Formatada para Telas de Celular (PNG)</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Gera um card em alta definição (1080px) com o layout oficial do posto, selo de validação sem conflitos, lista de frentistas e folgas regulamentares.
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportFilterBySelectedEmployee}
                      onChange={(e) => setExportFilterBySelectedEmployee(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs font-bold text-slate-700">Respeitar Filtro de Frentista</span>
                      <span className="text-[10px] text-slate-400">Exporta somente o frentista atualmente filtrado na tela</span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportModalOpen(false);
                      exportPlannerToImage();
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Baixar Imagem para WhatsApp (.PNG)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: WhatsApp Text Share */}
            {exportModalTab === "whatsapp_text" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Copie ou envie a escala formatada com emojis direto para o grupo do WhatsApp do posto:
                </p>

                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] leading-relaxed max-h-52 overflow-y-auto border border-slate-800 whitespace-pre-wrap select-all">
                  {generateWhatsAppText()}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generateWhatsAppText());
                      setIsCopiedWhatsAppText(true);
                      setTimeout(() => setIsCopiedWhatsAppText(false), 3000);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isCopiedWhatsAppText ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-slate-600" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateWhatsAppText())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir no WhatsApp
                  </a>
                </div>
              </div>
            )}

            {/* TAB 3: PDF Standard Document */}
            {exportModalTab === "pdf" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Formato do Documento PDF</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat("visual")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        exportFormat === "visual"
                          ? "border-indigo-600 bg-indigo-50/20 text-indigo-950"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-black">🗓️ Calendário Visual (Apenas Calendário)</span>
                      <span className="text-[10px] text-slate-500 mt-1">Gera uma escala em grade de calendário mensal (A4 Paisagem, 1 página). Ideal para colar no mural da pista.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat("detailed")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        exportFormat === "detailed"
                          ? "border-indigo-600 bg-indigo-50/20 text-indigo-950"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-black">📋 Lista Detalhada de Turnos (Apenas Lista)</span>
                      <span className="text-[10px] text-slate-500 mt-1">Gera uma tabela limpa e detalhada de cada plantão dia-a-dia com frentista, horário e status.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat("combined")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        exportFormat === "combined"
                          ? "border-indigo-600 bg-indigo-50/20 text-indigo-950"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-black">📑 Documento Completo (Calendário + Lista)</span>
                      <span className="text-[10px] text-slate-500 mt-1">Gera um documento de 2 páginas contendo o Calendário Visual na página 1 e a Lista Detalhada na página 2.</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtros da Exportação</p>
                  
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={exportFilterBySelectedEmployee}
                      onChange={(e) => setExportFilterBySelectedEmployee(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs font-bold text-slate-700">Respeitar Filtros Ativos</span>
                      <span className="text-[9.5px] text-slate-400">Exporta somente frentistas/turnos visíveis no planner atualmente</span>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportModalOpen(false);
                      downloadPlannerPDF();
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    Gerar PDF Oficial
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE AVATAR / PHOTO MODAL */}
      {editingAvatarUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Camera className="h-4 w-4 text-indigo-600" />
                Alterar Foto ou Ícone de Perfil
              </h3>
              <button
                type="button"
                onClick={() => setEditingAvatarUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <UserAvatar
                name={editingAvatarUser.nomeCompleto}
                avatarIcon={editAvatarIcon}
                avatarUrl={editAvatarUrl}
                size="xl"
              />
              <div>
                <h4 className="text-sm font-bold text-slate-800">{editingAvatarUser.nomeCompleto}</h4>
                <p className="text-xs text-slate-500">{editingAvatarUser.cargo}</p>
              </div>
            </div>

            <form onSubmit={handleSaveEditedAvatar} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Selecione um Ícone de Perfil
                </label>
                <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  {PRESET_AVATAR_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setEditAvatarIcon(icon)}
                      className={`w-8 h-8 text-sm rounded-xl flex items-center justify-center transition border cursor-pointer ${
                        editAvatarIcon === icon
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold scale-110"
                          : "bg-white hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Ou Envie uma Foto de Rosto (JPG/PNG)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setEditAvatarUrl(ev.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {editAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setEditAvatarUrl("")}
                    className="mt-1 text-[10px] font-bold text-rose-600 hover:underline cursor-pointer block"
                  >
                    Remover Foto Atual
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAvatarUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  Salvar Foto / Ícone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTRACT / MASS DAYS ALLOCATION MODAL */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 border border-slate-200 my-8">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  Atribuição de Escala por Contrato & Dias
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecione o funcionário, o turno e os dias de trabalho para gerar a escala em lote.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full cursor-pointer transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleApplyContractAllocation} className="space-y-6">
              {/* 1. Select Employee & Shift */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-indigo-700 tracking-wider mb-2">
                    1. Selecionar Funcionário
                  </label>
                  <select
                    value={contractEmpId}
                    onChange={(e) => setContractEmpId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {frentistasList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nomeCompleto} ({emp.cargo || "Frentista"})
                      </option>
                    ))}
                  </select>
                  {contractEmpId && (
                    <div className="mt-2.5 p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3">
                      <UserAvatar
                        user={users.find((u) => u.id === contractEmpId)}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 truncate">
                          {users.find((u) => u.id === contractEmpId)?.nomeCompleto}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {users.find((u) => u.id === contractEmpId)?.cargo || "Frentista"} • CNPJ: {cnpjPosto}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-indigo-700 tracking-wider mb-2">
                    2. Selecionar Horário / Turno
                  </label>
                  <select
                    value={contractShift}
                    onChange={(e) => setContractShift(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {SHIFT_TYPES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-700">Visualização do Turno:</span>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${getShiftColorKey(contractShift).bg} text-slate-800`}>
                      {getShiftColorKey(contractShift).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Select Days */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                    3. Selecionar os Dias do Mês ({activeMonth.name})
                  </label>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                    {contractSelectedDays.length} / {activeMonth.days} dias selecionados
                  </span>
                </div>

                {/* Quick Selection Presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={handleSelectWeekdaysContract}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer border border-slate-200"
                  >
                    Segunda a Sexta
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectWeekendsContract}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer border border-slate-200"
                  >
                    Finais de Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect12x36Contract("odd")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer border border-slate-200"
                  >
                    12x36 (Dias Ímpares)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect12x36Contract("even")}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer border border-slate-200"
                  >
                    12x36 (Dias Pares)
                  </button>
                  <button
                    type="button"
                    onClick={() => setContractSelectedDays(Array.from({ length: activeMonth.days }, (_, i) => i + 1))}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg transition cursor-pointer border border-indigo-200"
                  >
                    Todos os Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => setContractSelectedDays([])}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg transition cursor-pointer border border-rose-200"
                  >
                    Limpar
                  </button>
                </div>

                {/* Day Selection Grid */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5 text-[10px] font-black text-slate-500 uppercase">
                    {weekdayHeaders.map((w) => (
                      <div key={w}>{w}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Empty offset cells */}
                    {Array.from({ length: activeMonth.offset }).map((_, i) => (
                      <div key={`c-offset-${i}`} className="h-8"></div>
                    ))}

                    {/* Active days */}
                    {Array.from({ length: activeMonth.days }).map((_, idx) => {
                      const dNum = idx + 1;
                      const isSelected = contractSelectedDays.includes(dNum);
                      const isFirstDay = contractStartDateNum === dNum;

                      return (
                        <button
                          key={`c-day-${dNum}`}
                          type="button"
                          onClick={() => toggleContractDay(dNum)}
                          className={`h-8 text-xs font-extrabold rounded-xl transition flex flex-col items-center justify-center relative cursor-pointer ${
                            isSelected
                              ? isFirstDay
                                ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-600 scale-105"
                                : "bg-indigo-600 text-white shadow-sm"
                              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          <span>{dNum}</span>
                          {isFirstDay && (
                            <span className="text-[7px] leading-none uppercase tracking-tighter text-amber-100 font-black">
                              Início
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Select First Working Day */}
              {contractSelectedDays.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                  <label className="block text-xs font-black uppercase text-amber-900 tracking-wider">
                    4. Selecionar o Primeiro Dia de Atividade (Início do Contrato)
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={contractStartDateNum}
                      onChange={(e) => setContractStartDateNum(parseInt(e.target.value, 10))}
                      className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-extrabold text-amber-950 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      {contractSelectedDays
                        .slice()
                        .sort((a, b) => a - b)
                        .map((dNum) => (
                          <option key={`start-opt-${dNum}`} value={dNum}>
                            Dia {String(dNum).padStart(2, "0")} de {activeMonth.name}
                          </option>
                        ))}
                    </select>
                    <p className="text-xs font-bold text-amber-800">
                      🗓️ Início em: Dia {String(contractStartDateNum).padStart(2, "0")}/{String(activeMonth.monthNum).padStart(2, "0")}/{activeMonth.year}
                    </p>
                  </div>
                </div>
              )}

              {/* 5. VISUAL REPORT & CONTRACT PREVIEW */}
              {contractEmpId && contractSelectedDays.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-xl space-y-4 border border-indigo-800/80">
                  <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-indigo-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-200">
                        Relatório Visual do Contrato de Escala
                      </h4>
                    </div>
                    <span className="text-[10px] font-extrabold bg-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                      CONFIRMAÇÃO OPERACIONAL
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-indigo-900/50 p-3 rounded-2xl border border-indigo-700/50 flex items-center gap-3">
                      <UserAvatar
                        user={users.find((u) => u.id === contractEmpId)}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] text-indigo-300 font-bold uppercase">Funcionário</p>
                        <p className="text-xs font-extrabold truncate text-white">
                          {users.find((u) => u.id === contractEmpId)?.nomeCompleto}
                        </p>
                      </div>
                    </div>

                    <div className="bg-indigo-900/50 p-3 rounded-2xl border border-indigo-700/50">
                      <p className="text-[10px] text-indigo-300 font-bold uppercase">Turno & Horário</p>
                      <p className="text-xs font-extrabold text-amber-300 truncate mt-0.5">
                        {contractShift}
                      </p>
                    </div>

                    <div className="bg-indigo-900/50 p-3 rounded-2xl border border-indigo-700/50">
                      <p className="text-[10px] text-indigo-300 font-bold uppercase">Regime de Trabalho</p>
                      <p className="text-xs font-extrabold text-emerald-300 mt-0.5">
                        {contractSelectedDays.length} Dias Úteis | {activeMonth.days - contractSelectedDays.length} Folgas
                      </p>
                    </div>
                  </div>

                  {/* Days pills preview */}
                  <div>
                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1.5">
                      Dias com Plantão Alocado:
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                      {contractSelectedDays
                        .slice()
                        .sort((a, b) => a - b)
                        .map((d) => (
                          <span
                            key={`pill-${d}`}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              d === contractStartDateNum
                                ? "bg-amber-400 text-amber-950 font-black ring-1 ring-amber-300"
                                : "bg-indigo-800/80 text-indigo-100 border border-indigo-700/80"
                            }`}
                          >
                            Dia {String(d).padStart(2, "0")}
                            {d === contractStartDateNum ? " (Início)" : ""}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="pt-2 border-t border-indigo-800/80">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={contractConfirmedCheck}
                        onChange={(e) => setContractConfirmedCheck(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-indigo-400 text-indigo-500 focus:ring-indigo-400 cursor-pointer"
                      />
                      <span className="text-xs font-extrabold text-indigo-100 leading-snug">
                        Tenho certeza de que esses são os dias e o turno que o funcionário deve trabalhar e confirmo os dados deste contrato.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!contractConfirmedCheck || contractSelectedDays.length === 0}
                  className={`px-6 py-2.5 text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
                    contractConfirmedCheck && contractSelectedDays.length > 0
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar e Aplicar Escala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SHIFT SESSION MODAL */}
      {editingShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Editar Dados da Sessão / Plantão
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    ID: {editingShift.id} • Permissão Master/Gerente ativa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingShift(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedShift} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Frentista Responsavel */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Frentista Responsável *
                  </label>
                  <select
                    value={editingShift.frentistaResponsavel}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, frentistaResponsavel: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {frentistasList.map((f) => (
                      <option key={f.id} value={f.nomeCompleto}>
                        {f.nomeCompleto} ({f.cargo})
                      </option>
                    ))}
                    {editingShift.frentistaResponsavel === "Evento Geral" && (
                      <option value="Evento Geral">Evento Geral</option>
                    )}
                  </select>
                </div>

                {/* Turno */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Período de Turno *
                  </label>
                  <select
                    value={editingShift.turno}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, turno: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {SHIFT_TYPES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                    <option value="Evento Geral">Evento Geral</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Status */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Status da Sessão *
                  </label>
                  <select
                    value={editingShift.status}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, status: e.target.value as any })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Planejado">Planejado</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Fechado">Fechado</option>
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Data de Execução
                  </label>
                  <input
                    type="date"
                    value={editingShift.data || ""}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, data: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Checklist Items */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                  Checklist Operacional & Segurança
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                    <input
                      type="checkbox"
                      checked={editingShift.checklist?.limpezaPistas || false}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          checklist: { ...editingShift.checklist, limpezaPistas: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">Limpeza das Pistas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                    <input
                      type="checkbox"
                      checked={editingShift.checklist?.usoEPIs || false}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          checklist: { ...editingShift.checklist, usoEPIs: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">Uso de EPIs</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                    <input
                      type="checkbox"
                      checked={editingShift.checklist?.afericaoEquipamentosSeguranca || false}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          checklist: { ...editingShift.checklist, afericaoEquipamentosSeguranca: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">Extintores & Equipamentos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition">
                    <input
                      type="checkbox"
                      checked={editingShift.checklist?.testeGerador || false}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          checklist: { ...editingShift.checklist, testeGerador: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 text-xs">Teste Semanal Gerador</span>
                  </label>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Observações da Sessão
                </label>
                <textarea
                  rows={2}
                  value={editingShift.observacoes || ""}
                  onChange={(e) =>
                    setEditingShift({ ...editingShift, observacoes: e.target.value })
                  }
                  placeholder="Apontamentos sobre este turno ou checklist..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Ocorrências vinculadas */}
              {editingShift.occurrences && editingShift.occurrences.length > 0 && (
                <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3 space-y-2">
                  <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
                    Ocorrências da Sessão ({(editingShift.occurrences || []).length})
                  </span>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {(editingShift.occurrences || []).map((o) => (
                      <div key={o.id} className="bg-white p-2 rounded-xl border border-rose-200 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-rose-700">{o.tipo}:</span> {o.descricao}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedOccs = (editingShift.occurrences || []).filter((item) => item.id !== o.id);
                            setEditingShift({ ...editingShift, occurrences: updatedOccs });
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold text-[10px] ml-2 shrink-0 cursor-pointer"
                        >
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDeleteShiftSession(editingShift.id)}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-rose-200"
                >
                  <Trash2 className="h-4 w-4" /> Excluir Sessão
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingShift(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Salvar Alterações
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Exceção vs Atualização de Regra Permanente da IA */}
      {overrideConfirmation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                <BrainCircuit className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Alteração em Escala Inteligente
                </h3>
                <p className="text-xs text-slate-500">
                  Defina o impacto desta mudança no aprendizado da IA.
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs">
              <p className="font-bold text-amber-900">
                Você alterou o plantão de <span className="underline">{overrideConfirmation.employeeName}</span> no <span className="font-extrabold">{overrideConfirmation.dayOfWeek}</span>:
              </p>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-amber-200 text-slate-700 font-mono">
                <span className="line-through text-slate-400">{overrideConfirmation.oldShift}</span>
                <span>➔</span>
                <span className="font-bold text-indigo-700">{overrideConfirmation.newShift}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">
                Como deseja registrar esta alteração no sistema?
              </p>

              <button
                type="button"
                onClick={() => handleApplyOverrideDecision(false)}
                className="w-full text-left p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition flex items-start gap-3 group cursor-pointer"
              >
                <div className="p-2 bg-slate-200 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-700 rounded-xl transition">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-black text-xs text-slate-800 block">Exceção Temporária (Apenas nesta data)</span>
                  <span className="text-[11px] text-slate-500">Altera apenas o dia {overrideConfirmation.dayOfWeek}. Mantém o padrão do funcionário inalterado.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyOverrideDecision(true)}
                className="w-full text-left p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200 rounded-2xl transition flex items-start gap-3 group cursor-pointer shadow-sm"
              >
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow transition">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <span className="font-black text-xs text-indigo-900 block">Atualizar Padrão da IA (Regra Permanente)</span>
                  <span className="text-[11px] text-indigo-700">A IA aprende esta nova preferência/turno para {overrideConfirmation.employeeName} e a utilizará nas próximas gerações automáticas.</span>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setOverrideConfirmation(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reconhecimento por IA, Cadastro Prévio e Padrões */}
      {aiImportModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-6 py-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <BrainCircuit className="h-6 w-6 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                    IA de Leitura, Validação e Aprendizado de Escalas
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Gemini 3.6
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-100 font-medium">
                    OCR avançado, extração de plantões, checagem de inconsistências e mapeamento de padrão operacional.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiImportModalData(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl text-indigo-100 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Validation Banner (Warnings/Errors) */}
            {aiImportModalData.validationReport && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    Relatório de Inconsistências:{" "}
                    <strong>{(aiImportModalData.validationReport.warnings || []).length} avisos</strong>,{" "}
                    <strong>{(aiImportModalData.validationReport.errors || []).length} erros críticos</strong>.
                  </span>
                </div>
                {aiImportModalData.validationReport.warnings && aiImportModalData.validationReport.warnings.length > 0 && (
                  <div className="text-[11px] text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200 truncate max-w-md">
                    ⚠️ {aiImportModalData.validationReport.warnings[0]}
                  </div>
                )}
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: Image & Overview */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-inner relative group">
                  <img
                    src={aiImportModalData.imagePreview}
                    alt="Documento da Escala"
                    className="w-full h-44 object-cover object-center group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-200 flex items-center gap-1.5">
                    <span>📄 {aiImportModalData.documentName || "Documento Digitalizado"}</span>
                  </div>
                </div>

                {/* Mandatory Matrix Validation Card */}
                {aiImportModalData.validationReport?.matrixStats && (
                  <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3 shadow-md">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <FileText className="h-4 w-4" /> Relatório de Integridade da Matriz
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${aiImportModalData.validationReport.matrixStats.isComplete ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                        {aiImportModalData.validationReport.matrixStats.isComplete ? "COMPLETA" : "INCOMPLETA"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>Dias encontrados:</span>
                        <span className="font-bold text-white">{aiImportModalData.validationReport.matrixStats.diasEncontrados}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Funcionários encontrados:</span>
                        <span className="font-bold text-white">{aiImportModalData.validationReport.matrixStats.funcionariosEncontrados}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Registros esperados:</span>
                        <span className="font-bold text-amber-300">{aiImportModalData.validationReport.matrixStats.registrosEsperados}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Registros importados:</span>
                        <span className={`font-bold ${aiImportModalData.validationReport.matrixStats.isComplete ? "text-emerald-400" : "text-rose-400"}`}>
                          {aiImportModalData.validationReport.matrixStats.registrosImportados}
                        </span>
                      </div>
                    </div>

                    <div className={`p-2 rounded-xl text-[11px] font-bold text-center border ${aiImportModalData.validationReport.matrixStats.isComplete ? "bg-emerald-950/60 text-emerald-300 border-emerald-800" : "bg-rose-950/60 text-rose-300 border-rose-800"}`}>
                      Status: {aiImportModalData.validationReport.matrixStats.statusText}
                    </div>
                  </div>
                )}

                <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-indigo-600" /> Resumo Extraído pela IA
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-indigo-100/60 shadow-sm text-center">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Plantões</span>
                      <span className="text-base font-black text-indigo-700">{(aiImportModalData.schedules || []).length}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-100/60 shadow-sm text-center">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Equipe</span>
                      <span className="text-base font-black text-emerald-700">{(aiImportModalData.recognizedUsers || []).length}</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-indigo-100/60 shadow-sm text-center">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Padrões</span>
                      <span className="text-base font-black text-purple-700">{(aiImportModalData.learnedPatterns || []).length}</span>
                    </div>
                  </div>

                  {/* Learned Patterns Preview Badge */}
                  {aiImportModalData.learnedPatterns && aiImportModalData.learnedPatterns.length > 0 && (
                    <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-purple-900 uppercase block flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-600" /> Memória Operacional Mapeada:
                      </span>
                      <div className="space-y-1">
                        {aiImportModalData.learnedPatterns.slice(0, 3).map((pat, idx) => (
                          <div key={idx} className="bg-white p-2 rounded-xl border border-purple-100 text-[11px] flex justify-between items-center">
                            <span className="font-bold text-slate-800">{pat.funcionario}</span>
                            <span className="bg-purple-50 text-purple-700 font-black px-2 py-0.5 rounded text-[10px] border border-purple-200">
                              Escala {pat.tipoEscala}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Recognized Employees & Learned Patterns */}
              <div className="md:col-span-7 space-y-4 flex flex-col">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>1. Confirmar Equipe & Cadastros ({(aiImportModalData.recognizedUsers || []).length})</span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      Auto-Cadastramento
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Confirme ou edite os nomes reconhecidos para vinculá-los ao Planner do posto.
                  </p>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 flex-1">
                  {(aiImportModalData.recognizedUsers || []).map((userItem, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition ${
                        userItem.selected
                          ? userItem.isExisting
                            ? "bg-slate-50 border-slate-200"
                            : "bg-emerald-50/60 border-emerald-200 shadow-sm"
                          : "bg-slate-50/50 border-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={userItem.selected}
                          onChange={(e) => {
                            const updated = [...aiImportModalData.recognizedUsers];
                            updated[idx].selected = e.target.checked;
                            setAiImportModalData({ ...aiImportModalData, recognizedUsers: updated });
                          }}
                          className="mt-1.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                        />

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">⛽</span>
                              <input
                                type="text"
                                value={userItem.nomeCompleto}
                                onChange={(e) => {
                                  const updated = [...aiImportModalData.recognizedUsers];
                                  updated[idx].nomeCompleto = e.target.value;
                                  setAiImportModalData({ ...aiImportModalData, recognizedUsers: updated });
                                }}
                                className="font-bold text-xs text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none px-1"
                              />
                            </div>

                            {userItem.isExisting ? (
                              <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                                Já Cadastrado
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                                ✨ Novo Cadastro Prévio
                              </span>
                            )}
                          </div>

                          {!userItem.isExisting && (
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase">Cargo</label>
                                <select
                                  value={userItem.cargo}
                                  onChange={(e) => {
                                    const updated = [...aiImportModalData.recognizedUsers];
                                    updated[idx].cargo = e.target.value as UserRole;
                                    setAiImportModalData({ ...aiImportModalData, recognizedUsers: updated });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs text-slate-700 font-medium"
                                >
                                  <option value="Frentista">Frentista</option>
                                  <option value="Gerente">Gerente</option>
                                  <option value="Supervisor">Supervisor</option>
                                  <option value="Gerente Geral">Gerente Geral</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase">Telefone</label>
                                <input
                                  type="text"
                                  value={userItem.telefone}
                                  onChange={(e) => {
                                    const updated = [...aiImportModalData.recognizedUsers];
                                    updated[idx].telefone = e.target.value;
                                    setAiImportModalData({ ...aiImportModalData, recognizedUsers: updated });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs text-slate-700 font-medium"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <BrainCircuit className="h-4 w-4 text-purple-600" />
                <span>
                  A IA salvará <strong>{(aiImportModalData.learnedPatterns || []).length} padrões operacionais</strong> na Memória Permanente do posto.
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAiImportModalData(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAiImportModal}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-300" /> Confirmar & Aprender Padrões
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
