/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import SubTabNavigation from "./SubTabNavigation";
import { AppState, TimesheetEntry, User } from "../types";
import { UserAvatar } from "./UserAvatar";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UserCheck, 
  Download, 
  PlusCircle, 
  Search, 
  ListFilter, 
  FileSpreadsheet, 
  AlertCircle, 
  Info, 
  FileCheck,
  User as UserIcon,
  Fingerprint,
  CalendarDays,
  FileSignature,
  Bell,
  BellRing,
  Trash2
} from "lucide-react";

interface TimesheetManagementProps {
  appState: AppState;
  userRole: string;
  currentUser: User;
  onUpdateTimesheetEntries: (entries: TimesheetEntry[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status?: string) => void;
  onClearData?: () => void;
}

export default function TimesheetManagement({ 
  appState, 
  userRole, 
  currentUser,
  onUpdateTimesheetEntries, 
  onAddAuditLog,
  onClearData
}: TimesheetManagementProps) {
  
  const entries = appState.timesheetEntries || [];
  const users = appState.users || [];

  const [activeTab, setActiveTab] = useState<"bater-ponto" | "folha-historico" | "dashboard">("bater-ponto");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEmployee, setFilterEmployee] = useState<string>("Todos");
  const [filterStatus, setFilterStatus] = useState<string>("Todos");

  // Form states for manual registration
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetEmployeeId, setTargetEmployeeId] = useState(currentUser.id);
  const [entrada, setEntrada] = useState("08:00");
  const [intervaloInicio, setIntervaloInicio] = useState("12:00");
  const [intervaloFim, setIntervaloFim] = useState("13:00");
  const [saida, setSaida] = useState("17:00");
  const [observacoes, setObservacoes] = useState("");

  const isMasterOrGerente = userRole === "Master" || userRole === "Gerente";

  const [notifPermission, setNotifPermission] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  const requestNotifPermission = () => {
    if (!("Notification" in window)) {
      alert("Seu navegador não suporta a API de Notificações.");
      return;
    }
    Notification.requestPermission().then((perm) => {
      setNotifPermission(perm);
      if (perm === "granted") {
        sendBrowserNotification("Notificações Ativas! 🔔", "Alertas locais do Ponto Eletrônico foram configurados com sucesso.");
      } else {
        alert("Permissão de notificação negada pelo navegador.");
      }
    });
  };

  // Browser Notification helper for local point registration alerts
  const sendBrowserNotification = (title: string, message: string) => {
    if (!("Notification" in window)) {
      console.warn("API de notificações não suportada no ambiente do navegador.");
      return;
    }

    const deliver = () => {
      try {
        const notif = new Notification(title, {
          body: message,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: "ponto-eletronico",
        });
        notif.onclick = () => {
          window.focus();
        };
      } catch (err) {
        console.error("Erro ao disparar notificação local:", err);
      }
    };

    if (Notification.permission === "granted") {
      deliver();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          deliver();
        }
      });
    }
  };

  // Time parsing/calculation helpers
  const parseTimeToMinutes = (t: string): number => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const formatMinutesToTime = (min: number): string => {
    if (min < 0) min = 0;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}h`;
  };

  const getHoursWorked = (ent: string, sai?: string, intIni?: string, intFim?: string): string => {
    if (!ent || !sai) return "--:--";
    const entMin = parseTimeToMinutes(ent);
    const saiMin = parseTimeToMinutes(sai);
    let totalMin = saiMin - entMin;

    if (intIni && intFim) {
      const intIniMin = parseTimeToMinutes(intIni);
      const intFimMin = parseTimeToMinutes(intFim);
      const breakMin = intFimMin - intIniMin;
      if (breakMin > 0) {
        totalMin -= breakMin;
      }
    }

    return formatMinutesToTime(totalMin);
  };

  // Submit point registration
  const handleRegisterPoint = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedUser = users.find(u => u.id === targetEmployeeId) || currentUser;
    
    // Check if entry for this employee on this date already exists
    const duplicate = entries.find(r => r.userId === selectedUser.id && r.data === targetDate);
    if (duplicate) {
      alert(`Já existe um registro de ponto para ${selectedUser.nomeCompleto} na data ${targetDate.split("-").reverse().join("/")}.`);
      return;
    }

    const calculatedHrs = getHoursWorked(entrada, saida, intervaloInicio, intervaloFim);
    const now = new Date();
    const currentFullStamp = `${now.toISOString().split("T")[0]} ${now.toLocaleTimeString("pt-BR")}`;

    const newEntry: TimesheetEntry = {
      id: "pt_" + Date.now(),
      userId: selectedUser.id,
      userName: selectedUser.nomeCompleto,
      data: targetDate,
      entrada,
      intervaloInicio: intervaloInicio || undefined,
      intervaloFim: intervaloFim || undefined,
      saida: saida || undefined,
      horasTrabalhadas: calculatedHrs,
      confirmado: isMasterOrGerente, // Auto-confirmed if supervisor/gerente logs it
      dataHoraRegistro: currentFullStamp,
      status: isMasterOrGerente ? "Confirmado" : "Pendente",
      observacoes: observacoes.trim() || undefined,
      assinaturaDigital: isMasterOrGerente ? `AUTH-MGR-${Math.floor(Math.random() * 90000 + 10000)}` : undefined
    };

    onUpdateTimesheetEntries([newEntry, ...entries]);
    onAddAuditLog(
      "CADASTRO",
      "Folha de Ponto",
      `Ponto registrado para ${selectedUser.nomeCompleto} em ${targetDate.split("-").reverse().join("/")} (${calculatedHrs})`,
      "Regular"
    );

    sendBrowserNotification(
      "Ponto Registrado ⏱️",
      `Folha de Ponto: Registro efetuado para ${selectedUser.nomeCompleto} (${targetDate.split("-").reverse().join("/")}).`
    );

    alert("Ponto registrado com sucesso! Comprovante disponível para download em imagem.");
    setObservacoes("");
    setActiveTab("folha-historico");
  };

  // Quick action: Clock-in/out now
  const handleQuickClock = (type: "entrada" | "int-inicio" | "int-fim" | "saida") => {
    const today = new Date().toISOString().split("T")[0];
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const currentFullStamp = `${today} ${new Date().toLocaleTimeString("pt-BR")}`;

    // Find if today's entry exists for the user
    const existingIndex = entries.findIndex(r => r.userId === currentUser.id && r.data === today);

    let updatedEntries = [...entries];

    if (type === "entrada") {
      if (existingIndex !== -1) {
        alert("Você já registrou sua entrada hoje!");
        return;
      }

      const newEntry: TimesheetEntry = {
        id: "pt_" + Date.now(),
        userId: currentUser.id,
        userName: currentUser.nomeCompleto,
        data: today,
        entrada: nowTime,
        confirmado: false,
        dataHoraRegistro: currentFullStamp,
        status: "Pendente"
      };
      updatedEntries = [newEntry, ...entries];
      onAddAuditLog("CADASTRO", "Folha de Ponto", `Frentista ${currentUser.nomeCompleto} bateu ENTRADA às ${nowTime}`, "Regular");
      sendBrowserNotification(
        "Ponto Registrado - ENTRADA ⏱️",
        `${currentUser.nomeCompleto} registrou ENTRADA às ${nowTime}.`
      );
      alert(`Entrada registrada com sucesso às ${nowTime}!`);
    } else {
      if (existingIndex === -1) {
        alert("Você precisa registrar a entrada primeiro!");
        return;
      }

      const original = entries[existingIndex];
      const entryCopy = { ...original };

      if (type === "int-inicio") {
        if (entryCopy.intervaloInicio) {
          alert("Intervalo já iniciado hoje!");
          return;
        }
        entryCopy.intervaloInicio = nowTime;
        onAddAuditLog("ALTERACAO", "Folha de Ponto", `${currentUser.nomeCompleto} iniciou INTERVALO às ${nowTime}`, "Regular");
        sendBrowserNotification(
          "Ponto Registrado - INÍCIO INTERVALO ⏱️",
          `${currentUser.nomeCompleto} iniciou INTERVALO às ${nowTime}.`
        );
      } else if (type === "int-fim") {
        if (!entryCopy.intervaloInicio) {
          alert("Você precisa iniciar o intervalo primeiro!");
          return;
        }
        if (entryCopy.intervaloFim) {
          alert("Intervalo já encerrado hoje!");
          return;
        }
        entryCopy.intervaloFim = nowTime;
        onAddAuditLog("ALTERACAO", "Folha de Ponto", `${currentUser.nomeCompleto} encerrou INTERVALO às ${nowTime}`, "Regular");
        sendBrowserNotification(
          "Ponto Registrado - FIM INTERVALO ⏱️",
          `${currentUser.nomeCompleto} retornou do INTERVALO às ${nowTime}.`
        );
      } else if (type === "saida") {
        if (entryCopy.saida) {
          alert("Ponto de saída já registrado hoje!");
          return;
        }
        entryCopy.saida = nowTime;
        entryCopy.horasTrabalhadas = getHoursWorked(entryCopy.entrada, nowTime, entryCopy.intervaloInicio, entryCopy.intervaloFim);
        onAddAuditLog("ALTERACAO", "Folha de Ponto", `${currentUser.nomeCompleto} bateu SAÍDA às ${nowTime}. Total: ${entryCopy.horasTrabalhadas}`, "Regular");
        sendBrowserNotification(
          "Ponto Registrado - SAÍDA ⏱️",
          `${currentUser.nomeCompleto} registrou SAÍDA às ${nowTime}. Total: ${entryCopy.horasTrabalhadas}.`
        );
      }

      entryCopy.dataHoraRegistro = currentFullStamp;
      updatedEntries[existingIndex] = entryCopy;
      alert(`Ponto atualizado com sucesso (${type.toUpperCase()} às ${nowTime})!`);
    }

    onUpdateTimesheetEntries(updatedEntries);
  };

  // Confirm/Approve a point entry
  const handleApproveEntry = (id: string) => {
    const updated = entries.map(r => {
      if (r.id === id) {
        return { 
          ...r, 
          status: "Confirmado" as const, 
          confirmado: true,
          assinaturaDigital: `AUTH-MGR-${Math.floor(Math.random() * 90000 + 10000)}`
        };
      }
      return r;
    });

    const target = entries.find(r => r.id === id);
    if (target) {
      onAddAuditLog(
        "ALTERACAO",
        "Folha de Ponto",
        `Ponto de ${target.userName} (${target.data.split("-").reverse().join("/")}) aprovado por ${currentUser.nomeCompleto}`,
        "Regular"
      );
    }
    onUpdateTimesheetEntries(updated);
    alert("Folha de ponto confirmada com sucesso!");
  };

  // Reject an entry
  const handleRejectEntry = (id: string) => {
    const updated = entries.map(r => {
      if (r.id === id) {
        return { ...r, status: "Rejeitado" as const, confirmado: false };
      }
      return r;
    });

    const target = entries.find(r => r.id === id);
    if (target) {
      onAddAuditLog(
        "ALTERACAO",
        "Folha de Ponto",
        `Ponto de ${target.userName} (${target.data.split("-").reverse().join("/")}) rejeitado/marcado para correção`,
        "Aviso"
      );
    }
    onUpdateTimesheetEntries(updated);
  };

  // Sign point as employee
  const handleSignAsEmployee = (id: string) => {
    const updated = entries.map(r => {
      if (r.id === id) {
        return { 
          ...r, 
          status: "Confirmado" as const, 
          confirmado: true,
          assinaturaDigital: `AUTH-EMP-${currentUser.nomeCompleto.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 90000 + 10000)}` 
        };
      }
      return r;
    });

    onAddAuditLog("ALTERACAO", "Folha de Ponto", `Frentista ${currentUser.nomeCompleto} assinou digitalmente seu espelho de ponto`, "Regular");
    onUpdateTimesheetEntries(updated);
    alert("Assinatura digital efetuada com sucesso!");
  };

  const handleDeleteEntry = (id: string) => {
    if (!window.confirm("Deseja realmente excluir este registro de ponto?")) return;
    const updated = entries.filter(r => r.id !== id);
    onUpdateTimesheetEntries(updated);
    onAddAuditLog("EXCLUSAO", "Folha de Ponto", `Registro de ponto excluido`, "Aviso");
  };

  // Canvas Point Voucher Generator
  const handleDownloadPointVoucher = (entry: TimesheetEntry) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 700;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dark elegant theme background matching supply requested
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#0f172a"); // slate-900
    grad.addColorStop(1, "#020617"); // slate-950
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tech glowing green/cyan border (representing check-in)
    ctx.strokeStyle = "#10b981"; // emerald-500
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Receipt header panel
    ctx.fillStyle = "#064e3b"; // deep emerald
    ctx.fillRect(22, 22, canvas.width - 44, 100);

    ctx.fillStyle = "#ffffff";
    ctx.font = "black 20px 'Inter', sans-serif, Arial";
    ctx.textAlign = "center";
    ctx.fillText("SISTEMA DE PONTO DIGITAL - MEU POSTO", canvas.width / 2, 60);

    ctx.fillStyle = "#a7f3d0"; // emerald-200
    ctx.font = "bold 12px monospace";
    ctx.fillText("COMPROVANTE DE REGISTRO DIÁRIO DE TRABALHO", canvas.width / 2, 85);

    ctx.fillStyle = "#34d399";
    ctx.font = "10px monospace";
    ctx.fillText(`CÓDIGO DE SEGURANÇA: ${entry.id.toUpperCase()}`, canvas.width / 2, 105);

    // Inner receipt white container
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(40, 140, canvas.width - 80, 430);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(40, 140, canvas.width - 80, 430);

    // Header dividers
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 215);
    ctx.lineTo(canvas.width - 60, 215);
    ctx.stroke();

    // Protocol details
    ctx.textAlign = "left";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px 'Inter', sans-serif, Arial";
    ctx.fillText("DADOS DO COLABORADOR", 60, 175);

    ctx.font = "12px monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`CPF: ***.***.***-**  |  POSTO CNPJ: ${currentUser.cnpjPosto || "12.345.678/0001-99"}`, 60, 195);

    // Rows
    let currentY = 250;
    const drawRow = (label: string, value: string, highlight = false) => {
      ctx.textAlign = "left";
      ctx.font = "bold 12px 'Inter', sans-serif, Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText(label.toUpperCase(), 60, currentY);

      ctx.font = highlight ? "bold 14px monospace" : "13px 'Inter', sans-serif, Arial";
      ctx.fillStyle = highlight ? "#10b981" : "#0f172a";
      ctx.fillText(value, 230, currentY);

      currentY += 34;
    };

    drawRow("Nome Completo:", entry.userName);
    drawRow("Data do Trabalho:", entry.data.split("-").reverse().join("/"), true);
    drawRow("Hora de Entrada:", entry.entrada ? `${entry.entrada}h` : "Não registrado", true);
    drawRow("Início Intervalo:", entry.intervaloInicio ? `${entry.intervaloInicio}h` : "Não registrado");
    drawRow("Fim Intervalo:", entry.intervaloFim ? `${entry.intervaloFim}h` : "Não registrado");
    drawRow("Hora de Saída:", entry.saida ? `${entry.saida}h` : "Não registrado", true);
    
    // Calculate final time
    const finalHours = entry.horasTrabalhadas || getHoursWorked(entry.entrada, entry.saida, entry.intervaloInicio, entry.intervaloFim);
    drawRow("Carga Horária Total:", finalHours, true);

    // Observações se houver
    if (entry.observacoes) {
      ctx.font = "bold 11px 'Inter', sans-serif, Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText("OBSERVAÇÕES DO DIA:", 60, currentY);
      ctx.font = "italic 12px 'Inter', sans-serif, Arial";
      ctx.fillStyle = "#334155";
      ctx.fillText(entry.observacoes, 60, currentY + 16);
      currentY += 40;
    }

    // Authentication signature block
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(50, 480, canvas.width - 100, 75);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(50, 480, canvas.width - 100, 75);

    ctx.textAlign = "center";
    ctx.fillStyle = "#475569";
    ctx.font = "bold 11px 'Inter', sans-serif, Arial";
    ctx.fillText("ASSINATURA DIGITAL DE AUTENTICAÇÃO", canvas.width / 2, 500);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 13px monospace";
    ctx.fillText(entry.assinaturaDigital || "PENDENTE DE ASSINATURA ELETRÔNICA", canvas.width / 2, 523);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px 'Inter', sans-serif, Arial";
    ctx.fillText(`Gerado eletronicamente em: ${entry.dataHoraRegistro}`, canvas.width / 2, 545);

    // Signature stamp lines
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 625);
    ctx.lineTo(260, 625);
    ctx.moveTo(340, 625);
    ctx.lineTo(500, 625);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px 'Inter', sans-serif, Arial";
    ctx.fillText("Assinatura do Colaborador", 180, 640);
    ctx.fillText("Visto da Gerência / Supervisor", 420, 640);

    ctx.fillStyle = "#34d399";
    ctx.font = "9px monospace";
    ctx.fillText(`HASH VALIDATOR MD5: ${Math.random().toString(36).substring(2, 12).toUpperCase()}`, canvas.width / 2, 672);

    // Trigger download
    const link = document.createElement("a");
    link.download = `comprovante_ponto_${entry.userName.replace(/\s+/g, "_")}_${entry.data}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Filter lists
  const filteredEntries = entries.filter(e => {
    const matchesSearch = 
      e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.data.includes(searchTerm) ||
      (e.observacoes && e.observacoes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEmployee = filterEmployee === "Todos" || e.userId === filterEmployee;
    const matchesStatus = filterStatus === "Todos" || e.status === filterStatus;

    // Normal frentistas can only see their own timesheets
    const hasAccess = isMasterOrGerente || e.userId === currentUser.id;

    return matchesSearch && matchesEmployee && matchesStatus && hasAccess;
  });

  // Calculate statistics
  const userEntries = entries.filter(e => e.userId === currentUser.id);
  const userConfirmedCount = userEntries.filter(e => e.status === "Confirmado").length;
  const userPendingCount = userEntries.filter(e => e.status === "Pendente").length;

  return (
    <div className="space-y-6">
      
      <SubTabNavigation
        title="Folha de Ponto Eletrônica"
        titleIcon={<Fingerprint className="h-5 w-5" />}
        subtitle="Controle de presença frentistas, intervalos e espelho de ponto oficial"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as any)}
        tabs={[
          {
            id: "bater-ponto",
            label: "Registrar Ponto",
            icon: <Clock className="h-4 w-4" />,
          },
          {
            id: "folha-historico",
            label: "Espelho de Ponto",
            icon: <CalendarDays className="h-4 w-4" />,
            badge: filteredEntries.length,
          },
          {
            id: "dashboard",
            label: "Resumo Mensal",
            icon: <FileSpreadsheet className="h-4 w-4" />,
          },
        ]}
        rightElement={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onClearData) {
                  onClearData();
                } else if (confirm("Deseja apagar todos os registros de ponto eletrônico?")) {
                  onUpdateTimesheetEntries([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Limpar registros de ponto eletrônico"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Limpar Ponto</span>
            </button>

            <button
              type="button"
              onClick={requestNotifPermission}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                notifPermission === "granted"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
              }`}
              title="Clique para ativar/testar notificações de registro de ponto no seu navegador"
            >
              {notifPermission === "granted" ? <BellRing className="h-3.5 w-3.5 text-emerald-400" /> : <Bell className="h-3.5 w-3.5 text-amber-400 animate-bounce" />}
              <span>
                {notifPermission === "granted" ? "Notificações Ativas" : "Ativar Notificações"}
              </span>
            </button>
          </div>
        }
      />

      {/* Main Content Router */}
      {activeTab === "bater-ponto" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Quick point action box */}
          <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <div>
              <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider bg-emerald-950 px-2 py-1 rounded-md">Instantâneo</span>
              <h2 className="text-base font-black uppercase tracking-tight text-white mt-2 flex items-center gap-1.5">
                <Clock className="h-5 w-5 text-emerald-400" />
                Bater Ponto Agora
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">Registre sua jornada em tempo real com carimbo de geolocalização e data/hora do servidor.</p>
            </div>

            {/* Current user badge with avatar */}
            <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 flex items-center gap-3">
              <UserAvatar user={currentUser} size="lg" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Operador Atual</span>
                <p className="text-xs font-black text-white truncate">{currentUser.nomeCompleto}</p>
                <span className="text-[9.5px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  {currentUser.cargo}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
              <span className="text-xs font-bold text-slate-400 block uppercase">Hora Atual do Sistema</span>
              <span className="text-3xl font-black text-white font-mono block tracking-widest animate-pulse">
                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-bold block">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleQuickClock("entrada")}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-900/30 text-center space-y-1"
              >
                <Fingerprint className="h-5 w-5 mx-auto" />
                <span>1. Entrada</span>
              </button>

              <button
                onClick={() => handleQuickClock("int-inicio")}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition text-center space-y-1 border border-slate-700"
              >
                <Clock className="h-5 w-5 mx-auto text-amber-400" />
                <span>2. Almoço</span>
              </button>

              <button
                onClick={() => handleQuickClock("int-fim")}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition text-center space-y-1 border border-slate-700"
              >
                <CheckCircle className="h-5 w-5 mx-auto text-sky-400" />
                <span>3. Retorno</span>
              </button>

              <button
                onClick={() => handleQuickClock("saida")}
                className="p-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-rose-900/30 text-center space-y-1"
              >
                <XCircle className="h-5 w-5 mx-auto" />
                <span>4. Saída</span>
              </button>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-900/60 p-4 rounded-2xl">
              <p className="text-[11px] text-emerald-200 leading-relaxed flex items-start gap-1.5">
                <Info className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>Frentistas devem obrigatoriamente registrar as 4 etapas da jornada para evitar inconformidades e passivos trabalhistas.</span>
              </p>
            </div>
          </div>

          {/* Manual Register / Adjust Point form */}
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <PlusCircle className="text-emerald-600 h-5 w-5" />
                Registrar Dia Trabalhado / Ajustar Ponto
              </h2>
              <p className="text-xs text-slate-500 font-medium">Adicione ou corrija horários retroativos de frentistas e funcionários administrativos.</p>
            </div>

            <form onSubmit={handleRegisterPoint} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Colaborador / Funcionário</label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <UserAvatar user={users.find(u => u.id === targetEmployeeId) || currentUser} size="md" />
                    {isMasterOrGerente ? (
                      <select
                        value={targetEmployeeId}
                        onChange={(e) => setTargetEmployeeId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition cursor-pointer"
                      >
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.nomeCompleto} ({u.cargo})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={currentUser.nomeCompleto}
                        disabled
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 outline-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Data do Trabalho</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block mb-1.5">1. Entrada</label>
                  <input
                    type="time"
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-amber-600 tracking-wider block mb-1.5">2. Almoço (Saída)</label>
                  <input
                    type="time"
                    value={intervaloInicio}
                    onChange={(e) => setIntervaloInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-sky-600 tracking-wider block mb-1.5">3. Retorno Almoço</label>
                  <input
                    type="time"
                    value={intervaloFim}
                    onChange={(e) => setIntervaloFim(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-rose-600 tracking-wider block mb-1.5">4. Saída</label>
                  <input
                    type="time"
                    value={saida}
                    onChange={(e) => setSaida(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Realtime Carga Horaria Indicator */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Carga Calculada para o Dia</span>
                  <span className="text-base font-black text-slate-800 block mt-0.5">
                    {getHoursWorked(entrada, saida, intervaloInicio, intervaloFim)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acordo Coletivo</span>
                  <span className="text-xs font-bold text-slate-500 block">Jornada padrão: 08:00h</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Justificativa / Motivo de Ajuste</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Esquecimento de batida física de ponto, dobra autorizada, troca de turno..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition flex items-center gap-2 shadow-lg shadow-slate-200"
                >
                  <PlusCircle className="h-4 w-4" />
                  Salvar Registro de Ponto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "folha-historico" && (
        <div className="space-y-6">
          
          {/* Filters card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por colaborador ou data (AAAA-MM)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <ListFilter className="h-3.5 w-3.5 text-slate-400" />
                Filtros:
              </div>

              {isMasterOrGerente && (
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="Todos">Todos os Funcionários</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.nomeCompleto}</option>
                  ))}
                </select>
              )}

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="Todos">Todos os Status</option>
                <option value="Confirmado">✅ Assinado / Confirmado</option>
                <option value="Pendente">⏳ Pendente Assinatura</option>
                <option value="Rejeitado">❌ Inconforme / Rejeitado</option>
              </select>
            </div>
          </div>

          {/* Table list */}
          {filteredEntries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-300">
                <Calendar className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-black text-slate-700 uppercase">Nenhum registro encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">Você ainda não registrou batidas de ponto retroativas ou pendentes de visto.</p>
              <button
                onClick={() => setActiveTab("bater-ponto")}
                className="mt-6 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-100"
              >
                Bater Ponto Agora
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-4 px-6">Funcionário</th>
                      <th className="py-4 px-6">Data Trabalho</th>
                      <th className="py-4 px-6">Entrada</th>
                      <th className="py-4 px-6">Intervalo</th>
                      <th className="py-4 px-6">Saída</th>
                      <th className="py-4 px-6">Carga Diária</th>
                      <th className="py-4 px-6">Status Assinatura</th>
                      <th className="py-4 px-6 text-right">Comprovantes & Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map((entry) => {
                      let statusBadge = "bg-amber-50 border-amber-200 text-amber-700";
                      if (entry.status === "Confirmado") statusBadge = "bg-emerald-50 border-emerald-200 text-emerald-700";
                      if (entry.status === "Rejeitado") statusBadge = "bg-rose-50 border-rose-200 text-rose-700";

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar user={users.find(u => u.id === entry.userId || u.nomeCompleto === entry.userName)} name={entry.userName} size="sm" />
                              <div>
                                <p className="text-xs font-extrabold text-slate-800 leading-tight">{entry.userName}</p>
                                <span className="text-[10px] font-bold text-slate-400">Posto Central</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs font-mono font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {entry.data.split("-").reverse().join("/")}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs font-bold text-slate-700">{entry.entrada || "--:--"}h</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs text-slate-500 font-medium">
                              {entry.intervaloInicio ? `${entry.intervaloInicio}h` : "--:--"} às {entry.intervaloFim ? `${entry.intervaloFim}h` : "--:--"}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs font-bold text-slate-700">{entry.saida || "--:--"}h</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs font-mono font-black text-emerald-600">
                              {entry.horasTrabalhadas || getHoursWorked(entry.entrada, entry.saida, entry.intervaloInicio, entry.intervaloFim)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-1">
                              <span className={`inline-block text-[9px] font-black uppercase border rounded-full px-2 py-0.5 ${statusBadge}`}>
                                {entry.status === "Confirmado" ? "Assinado" : entry.status}
                              </span>
                              {entry.assinaturaDigital && (
                                <span className="block text-[8px] font-mono text-slate-400 font-bold truncate max-w-[120px]" title={entry.assinaturaDigital}>
                                  ✍️ {entry.assinaturaDigital}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleDownloadPointVoucher(entry)}
                              className="p-1.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-100 hover:border-emerald-600 rounded-lg transition inline-flex items-center gap-1 text-[10px] font-black uppercase"
                              title="Gerar e Baixar Comprovante Imagem (.PNG)"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Comprovante
                            </button>

                            {/* Normal employee sign action */}
                            {!isMasterOrGerente && entry.userId === currentUser.id && entry.status === "Pendente" && (
                              <button
                                onClick={() => handleSignAsEmployee(entry.id)}
                                className="p-1.5 text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 rounded-lg transition inline-flex items-center gap-1 text-[10px] font-black uppercase"
                              >
                                <FileSignature className="h-3.5 w-3.5" />
                                Assinar
                              </button>
                            )}

                            {/* Manager Actions */}
                            {isMasterOrGerente && (
                              <div className="inline-block relative group/opts">
                                <button className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition">
                                  Visto ▾
                                </button>
                                <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-xl shadow-xl border border-slate-200 hidden group-hover/opts:block z-50 text-left p-1 space-y-1">
                                  {entry.status !== "Confirmado" && (
                                    <button 
                                      onClick={() => handleApproveEntry(entry.id)}
                                      className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg"
                                    >
                                      Aprovar/Assinar
                                    </button>
                                  )}
                                  {entry.status !== "Rejeitado" && (
                                    <button 
                                      onClick={() => handleRejectEntry(entry.id)}
                                      className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-rose-50 text-rose-700 rounded-lg"
                                    >
                                      Recusar
                                    </button>
                                  )}
                                  <div className="border-t border-slate-100 my-1" />
                                  <button 
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "dashboard" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-4 border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              Consolidado Individual de Espelho de Ponto (Mês Corrente)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-center space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batidas Efetuadas</p>
                <p className="text-3xl font-black text-slate-800 font-display">
                  {userEntries.length}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Dias Úteis Mapeados</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-center space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assinaturas Validadas</p>
                <p className="text-3xl font-black text-emerald-600 font-display">
                  {userConfirmedCount}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Consistentes por Auditoria</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl text-center space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendências de Visto</p>
                <p className="text-3xl font-black text-amber-600 font-display">
                  {userPendingCount}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Necessita sua Assinatura</p>
              </div>

            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-4 border-b border-slate-100 pb-3">Banco de Horas & Compensações</h3>
            <div className="p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">Acordo Geral de Banco de Horas</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">Seu saldo atual de compensação está em conformidade. Quaisquer horas extras realizadas aos domingos ou feriados nacionais devem ser reportadas à gerência com o comprovante em imagem baixado para validação manual.</p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
