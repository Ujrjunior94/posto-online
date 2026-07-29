/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { AppState, SyncConfig, SystemCredential, User } from "../types";
import SubTabNavigation from "./SubTabNavigation";
import { db, doc, setDoc, getDoc } from "../lib/firebase";
import { UserAvatar, PRESET_AVATAR_ICONS } from "./UserAvatar";
import {
  Cloud,
  Lock,
  Unlock,
  Key,
  Database,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit,
  Save,
  Download,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Building,
  Upload,
  Clock,
  Calendar,
  HardDrive,
  RefreshCw,
  FileJson,
  Check,
  UserCheck,
  Camera,
  Smile,
  X,
  Search,
  Filter,
  Layers,
  Share2,
  Copy,
  Globe,
  ExternalLink
} from "lucide-react";

interface CloudSyncPanelProps {
  cnpjPosto: string;
  currentUser: User;
  appState: AppState;
  syncConfig: SyncConfig;
  onUpdateConfig: (config: SyncConfig) => void;
  onRestoreState: (state: AppState) => void;
  onUpdateCredentials: (credentials: SystemCredential[]) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateCurrentUser: (updatedUser: User) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  onUpdateStationDetails: (nomePosto: string, cnpjPosto: string, securePassword?: string) => void;
  onUpdateReportCustomization?: (customSettings: Partial<AppState>) => void;
}

export interface SyncRecordItem {
  id: string;
  module: string;
  moduleKey: string;
  title: string;
  detail?: string;
  dateStr: string;
  timestamp: number;
  responsible?: string;
  isSynced: boolean;
}

function parseDateToMillis(dateStr?: string, defaultTs: number = 0): number {
  if (!dateStr) return defaultTs;
  try {
    const formatted = dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr;
    const parsed = new Date(formatted).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  } catch {
    // fallback
  }
  return defaultTs;
}

export function buildSyncRecordList(appState: AppState, lastCloudSyncDate?: string): SyncRecordItem[] {
  const syncTime = lastCloudSyncDate ? new Date(lastCloudSyncDate).getTime() : Date.now();
  const list: SyncRecordItem[] = [];

  const checkSynced = (ts: number) => {
    if (!syncTime) return false;
    return ts <= syncTime;
  };

  // 1. Turnos e Checklists
  (appState.shifts || []).forEach((s) => {
    const ts = parseDateToMillis(s.data);
    list.push({
      id: s.id || `shift_${Math.random()}`,
      module: "Turnos & Checklists",
      moduleKey: "shifts",
      title: `${s.turno || "Turno"} - ${s.frentistaResponsavel || "Sem frentista"}`,
      detail: `Status: ${s.status || "Pendente"} | Ocorrências: ${s.occurrences?.length || 0}`,
      dateStr: s.data || "Sem data",
      timestamp: ts,
      responsible: s.frentistaResponsavel || "Frentista",
      isSynced: checkSynced(ts),
    });
  });

  // 2. Registros de Ponto
  (appState.timesheetEntries || []).forEach((te) => {
    const ts = parseDateToMillis(te.dataHoraRegistro || te.data);
    list.push({
      id: te.id || `ts_${Math.random()}`,
      module: "Folha de Ponto",
      moduleKey: "timesheet",
      title: `Espelho de Ponto: ${te.userName || "Funcionário"}`,
      detail: `Entrada: ${te.entrada || "--:--"} | Saída: ${te.saida || "Em aberto"} | Status: ${te.status}`,
      dateStr: te.data || "Sem data",
      timestamp: ts,
      responsible: te.userName || "Funcionário",
      isSynced: checkSynced(ts),
    });
  });

  // 3. Suprimentos
  (appState.supplyRequests || []).forEach((sr) => {
    const ts = parseDateToMillis(sr.dataHora);
    list.push({
      id: sr.id || `sr_${Math.random()}`,
      module: "Suprimentos & Fardamento",
      moduleKey: "supplies",
      title: `${sr.tipo || "Solicitação"}: ${sr.itemDescricao} (${sr.quantidade}x)`,
      detail: `Solicitante: ${sr.quemSolicita || "--"} | Beneficiário: ${sr.paraQuemSolicita || "--"} | Status: ${sr.status}`,
      dateStr: sr.dataHora ? sr.dataHora.split(" ")[0] : "--",
      timestamp: ts,
      responsible: sr.quemSolicita || "Solicitante",
      isSynced: checkSynced(ts),
    });
  });

  // 4. Reconciliações de Caixa
  (appState.reconciliations || []).forEach((r) => {
    const ts = parseDateToMillis(r.dataFechamento);
    list.push({
      id: r.id || `rec_${Math.random()}`,
      module: "Financeiro & Caixa",
      moduleKey: "finance",
      title: `Fechamento de Caixa: ${r.frentistaNome || "Frentista"}`,
      detail: `Declarado: R$ ${(r.valorDeclaradoFisico || 0).toFixed(2)} | Diferença: R$ ${(r.diferenca || 0).toFixed(2)}`,
      dateStr: r.dataFechamento ? r.dataFechamento.split(" ")[0] : "--",
      timestamp: ts,
      responsible: r.frentistaNome || "Frentista",
      isSynced: checkSynced(ts),
    });
  });

  // 5. Transações de Caixa
  (appState.transactions || []).forEach((t) => {
    const ts = parseDateToMillis(t.data);
    list.push({
      id: t.id || `tx_${Math.random()}`,
      module: "Financeiro & Caixa",
      moduleKey: "finance",
      title: `${t.tipo || "Lançamento"}: ${t.descricao || "Sem descrição"}`,
      detail: `Categoria: ${t.categoria || "Geral"} | Valor: R$ ${(t.valor || 0).toFixed(2)}`,
      dateStr: t.data ? t.data.split("T")[0] : "--",
      timestamp: ts,
      responsible: "Caixa Central",
      isSynced: checkSynced(ts),
    });
  });

  // 6. Quebras de Caixa
  (appState.shortages || []).forEach((sh) => {
    const ts = parseDateToMillis(sh.data);
    list.push({
      id: sh.id || `sh_${Math.random()}`,
      module: "Financeiro & Caixa",
      moduleKey: "finance",
      title: `Quebra/Sobra de Caixa: R$ ${(sh.valorTotalFalta || 0).toFixed(2)}`,
      detail: `Tipo: ${sh.tipo} | Status: ${sh.status} | Rateio: R$ ${(sh.rateioPorFuncionario || 0).toFixed(2)}/p`,
      dateStr: sh.data || "--",
      timestamp: ts,
      responsible: sh.funcionariosEnvolvidos?.[0] || "Equipe",
      isSynced: checkSynced(ts),
    });
  });

  // 7. Qualidade ANP
  (appState.qualityAudits || []).forEach((qa) => {
    const ts = parseDateToMillis(qa.data);
    list.push({
      id: qa.id || `qa_${Math.random()}`,
      module: "Controle de Qualidade ANP",
      moduleKey: "quality",
      title: `Teste Químico ANP: ${qa.combustivel}`,
      detail: `Densidade: ${qa.densidade} g/cm³ | Laudo: ${qa.conforme ? "CONFORME" : "NÃO CONFORME"}`,
      dateStr: qa.data || "--",
      timestamp: ts,
      responsible: qa.responsavelTecnico || "Técnico",
      isSynced: checkSynced(ts),
    });
  });

  // 8. Aferições de Bicos
  (appState.calibrations || []).forEach((c) => {
    const ts = parseDateToMillis(c.data);
    list.push({
      id: c.id || `cal_${Math.random()}`,
      module: "Controle de Qualidade ANP",
      moduleKey: "quality",
      title: `Aferição de Bico: ${c.nozzleId}`,
      detail: `Desvio: ${c.desvioMl} mL | Status: ${c.conforme ? "Aprovado" : "Reprovado"}`,
      dateStr: c.data || "--",
      timestamp: ts,
      responsible: c.operadorResponsavel || "Operador",
      isSynced: checkSynced(ts),
    });
  });

  // 9. Lubrificantes
  (appState.lubricantDeliveries || []).forEach((ld) => {
    const ts = parseDateToMillis(ld.dataRecebimento);
    list.push({
      id: ld.id || `ld_${Math.random()}`,
      module: "Lubrificantes & Combustíveis",
      moduleKey: "deliveries",
      title: `Nota Lubrificantes #${ld.numeroNota}`,
      detail: `Fornecedor: ${ld.fornecedor} | Valor: R$ ${(ld.valorTotal || 0).toFixed(2)} | Conferência: ${ld.statusConferencia}`,
      dateStr: ld.dataRecebimento || "--",
      timestamp: ts,
      responsible: "Conferente",
      isSynced: checkSynced(ts),
    });
  });

  // 10. Combustíveis
  (appState.deliveries || []).forEach((d) => {
    const dateVal = d.date || d.data || "";
    const ts = parseDateToMillis(dateVal);
    list.push({
      id: d.id || `del_${Math.random()}`,
      module: "Lubrificantes & Combustíveis",
      moduleKey: "deliveries",
      title: `Entrega Combustível NF #${d.invoiceNumber || d.nfe || "S/N"}`,
      detail: `Combustível: ${d.fuelType || d.combustivel || "Variados"} | Vol: ${d.volume || d.volumeRecebido || 0}L`,
      dateStr: dateVal || "--",
      timestamp: ts,
      responsible: d.driverName || d.motorista || "Motorista",
      isSynced: checkSynced(ts),
    });
  });

  // 11. Credenciais
  (appState.systemCredentials || []).forEach((sc) => {
    let ts = 0;
    if ((sc as any).createdAt) {
      ts = parseDateToMillis((sc as any).createdAt, 0);
    } else if (sc.id && sc.id.startsWith("cred_")) {
      const parsedId = parseInt(sc.id.replace("cred_", ""), 10);
      if (!isNaN(parsedId) && parsedId > 1000000000) ts = parsedId;
    }
    list.push({
      id: sc.id || `sc_${Math.random()}`,
      module: "Credenciais TI",
      moduleKey: "credentials",
      title: `Credencial TI: ${sc.systemName}`,
      detail: `Categoria: ${sc.category} | Login: ${sc.login}`,
      dateStr: (sc as any).createdAt ? (sc as any).createdAt.split("T")[0] : "Configuração TI",
      timestamp: ts,
      responsible: "TI Posto",
      isSynced: checkSynced(ts),
    });
  });

  // 12. LMC & Balanços
  (appState.lmc || []).forEach((lmcItem) => {
    const ts = parseDateToMillis(lmcItem.date);
    list.push({
      id: lmcItem.id || `lmc_${Math.random()}`,
      module: "LMC & Balanços",
      moduleKey: "lmc",
      title: `LMC: ${lmcItem.fuelType}`,
      detail: `Data: ${lmcItem.date || "--"} | Vendas: ${lmcItem.litersSold || 0}L`,
      dateStr: lmcItem.date || "--",
      timestamp: ts,
      responsible: "Gerência",
      isSynced: checkSynced(ts),
    });
  });

  (appState.dailyBalances || []).forEach((dbItem) => {
    const ts = parseDateToMillis(dbItem.data);
    list.push({
      id: dbItem.id || `db_${Math.random()}`,
      module: "LMC & Balanços",
      moduleKey: "lmc",
      title: `Balanço Diário: ${dbItem.data}`,
      detail: `Receita Total: R$ ${(dbItem.vendaCombustivel + dbItem.vendaLubrificantes + dbItem.outrasReceitas).toFixed(2)} | Saldo: R$ ${(dbItem.saldoFinal || 0).toFixed(2)}`,
      dateStr: dbItem.data || "--",
      timestamp: ts,
      responsible: dbItem.fechadoPor || "Gerente",
      isSynced: checkSynced(ts),
    });
  });

  list.sort((a, b) => b.timestamp - a.timestamp);
  return list;
}

export default function CloudSyncPanel({
  cnpjPosto,
  currentUser,
  appState,
  syncConfig,
  onUpdateConfig,
  onRestoreState,
  onUpdateCredentials,
  onUpdateUsers,
  onUpdateCurrentUser,
  onAddAuditLog,
  onUpdateStationDetails,
  onUpdateReportCustomization,
}: CloudSyncPanelProps) {
  const { systemCredentials = [], users = [] } = appState;

  // User Profile Edit State
  const [profileName, setProfileName] = useState(currentUser?.nomeCompleto || "");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || "");
  const [profilePhone, setProfilePhone] = useState(currentUser?.telefone || "");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | undefined>(currentUser?.avatarUrl);
  const [profileAvatarIcon, setProfileAvatarIcon] = useState<string | undefined>(currentUser?.avatarIcon);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.nomeCompleto || "");
      setProfileEmail(currentUser.email || "");
      setProfilePhone(currentUser.telefone || "");
      setProfileAvatarUrl(currentUser.avatarUrl);
      setProfileAvatarIcon(currentUser.avatarIcon);
    }
  }, [currentUser]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("A foto é muito grande (máximo 3MB). Selecione uma imagem menor.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setProfileAvatarUrl(result);
        setProfileAvatarIcon(undefined); // Reset icon if custom image is uploaded
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetIcon = (icon: string) => {
    setProfileAvatarIcon(icon);
    setProfileAvatarUrl(undefined); // Reset URL if preset icon is chosen
  };

  const handleClearAvatar = () => {
    setProfileAvatarUrl(undefined);
    setProfileAvatarIcon(undefined);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert("O nome completo do usuário é obrigatório.");
      return;
    }

    const updatedUser: User = {
      ...currentUser,
      nomeCompleto: profileName.trim(),
      email: profileEmail.trim(),
      telefone: profilePhone.trim(),
      avatarUrl: profileAvatarUrl,
      avatarIcon: profileAvatarIcon,
    };

    onUpdateCurrentUser(updatedUser);
    onAddAuditLog(
      "UPDATE",
      "Perfil",
      `Atualizou perfil e foto de avatar do usuário ${updatedUser.nomeCompleto}`,
      "Regular"
    );

    setProfileSuccessMsg(true);
    setTimeout(() => setProfileSuccessMsg(false), 3500);
  };

  const tempUserPreview: User = {
    ...currentUser,
    nomeCompleto: profileName || currentUser?.nomeCompleto || "Usuário",
    avatarUrl: profileAvatarUrl,
    avatarIcon: profileAvatarIcon,
  };

  // Locks screen password (auto-unlocked for Gerente/Master/Supervisor/Admin)
  const isManagerOrAdmin = currentUser?.cargo === "Gerente" || currentUser?.cargo === "Master" || currentUser?.cargo === "Supervisor";
  const [isUnlocked, setIsUnlocked] = useState(isManagerOrAdmin);
  const [lockPassword, setLockPassword] = useState("");
  const [lockError, setLockError] = useState(false);

  // Supabase/Sync settings (using syncConfig)
  const [apiUrl, setApiUrl] = useState(syncConfig.apiUrl);
  const [token, setToken] = useState(syncConfig.token);
  const [autoSync, setAutoSync] = useState(syncConfig.autoSync);

  // Scheduled backup settings
  const [scheduledBackupEnabled, setScheduledBackupEnabled] = useState(syncConfig.scheduledBackupEnabled ?? false);
  const [backupFrequency, setBackupFrequency] = useState<"daily" | "12h" | "weekly" | "shift_end">(syncConfig.backupFrequency || "daily");
  const [backupDestination, setBackupDestination] = useState<"download" | "cloud" | "both">(syncConfig.backupDestination || "both");
  const [autoDownloadLocalJson, setAutoDownloadLocalJson] = useState(syncConfig.autoDownloadLocalJson ?? true);

  // Google Drive Extra Backup Settings
  const [googleDriveBackupEnabled, setGoogleDriveBackupEnabled] = useState(syncConfig.googleDriveBackupEnabled ?? false);
  const [googleDriveFolderName, setGoogleDriveFolderName] = useState(syncConfig.googleDriveFolderName || "Backups_MeuPosto");
  const [googleDriveTokens, setGoogleDriveTokens] = useState<any>(syncConfig.googleDriveTokens || null);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);

  // Listen for OAuth success message from Google Drive popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "GOOGLE_DRIVE_AUTH_SUCCESS" && event.data.tokens) {
        const tokens = event.data.tokens;
        setGoogleDriveTokens(tokens);
        setGoogleDriveBackupEnabled(true);
        const updated = {
          ...syncConfig,
          googleDriveTokens: tokens,
          googleDriveBackupEnabled: true,
        };
        onUpdateConfig(updated);
        setSyncStatus({
          type: "success",
          message: "Conta do Google Drive conectada com sucesso! O backup automático em nuvem extra foi ativado.",
        });
      }
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [syncConfig, onUpdateConfig]);

  // Status indicators
  const [syncStatus, setSyncStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({
    type: null,
    message: "",
  });

  // Modal forms
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isCredModalOpen, setIsCredModalOpen] = useState(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);

  // Bank form values
  const currentUserObj = users.find((u) => u.cnpjPosto === cnpjPosto && u.cargo === "Gerente") || users[0];
  const [bankName, setBankName] = useState("Banco do Brasil");
  const [bankAgency, setBankAgency] = useState("1234-5");
  const [bankAccount, setBankAccount] = useState("98765-4");
  const [bankPixKey, setBankPixKey] = useState(cnpjPosto);

  // Station Form Values
  const [newStationName, setNewStationName] = useState(appState.nomePosto || "Meu Posto - Gestão Inteligente");
  const [newStationCnpj, setNewStationCnpj] = useState(cnpjPosto);
  const [newStationPassword, setNewStationPassword] = useState(appState.securePassword || "adm001");
  const [stationShowPassword, setStationShowPassword] = useState(false);

  // Credential Form Values
  const [credName, setCredName] = useState("");
  const [credCategory, setCredCategory] = useState("Operacional");
  const [credLogin, setCredLogin] = useState("");
  const [credPass, setCredPass] = useState("");
  const [credDesc, setCredDesc] = useState("");

  // Viewer Form Values
  const [vName, setVName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPass, setVPass] = useState("");

  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});

  // --- CUSTOM REPORT HEADER & SIGNATURE CUSTOMIZATION STATES ---
  const [stationTab, setStationTab] = useState<'info' | 'header' | 'signature'>('info');

  const [customCompName, setCustomCompName] = useState(appState.reportHeaderCompanyName || appState.nomePosto || "");
  const [customCnpj, setCustomCnpj] = useState(appState.reportHeaderCnpj || cnpjPosto || "");
  const [customAddress, setCustomAddress] = useState(appState.reportHeaderAddress || "Av. Brasil, 1500 - Centro, São José dos Campos - SP");
  const [customLogo, setCustomLogo] = useState(appState.reportHeaderLogo || "");

  const [sigName, setSigName] = useState(appState.reportSignatureName || currentUser?.nomeCompleto || "");
  const [sigRole, setSigRole] = useState(appState.reportSignatureRole || currentUser?.cargo || "");
  const [sigEnabled, setSigEnabled] = useState(appState.reportSignatureEnabled ?? true);
  const [sigBase64, setSigBase64] = useState(appState.reportSignatureBase64 || "");

  // Drawing signature canvas refs and events
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale coordinates in case canvas CSS size differs from internal canvas width/height
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F172A"; // dark slate color
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Sync state values with appState if updated elsewhere
  useEffect(() => {
    if (appState.reportHeaderCompanyName) setCustomCompName(appState.reportHeaderCompanyName);
    if (appState.reportHeaderCnpj) setCustomCnpj(appState.reportHeaderCnpj);
    if (appState.reportHeaderAddress) setCustomAddress(appState.reportHeaderAddress);
    if (appState.reportHeaderLogo) setCustomLogo(appState.reportHeaderLogo);

    if (appState.reportSignatureName) setSigName(appState.reportSignatureName);
    if (appState.reportSignatureRole) setSigRole(appState.reportSignatureRole);
    if (appState.reportSignatureEnabled !== undefined) setSigEnabled(appState.reportSignatureEnabled);
    if (appState.reportSignatureBase64) setSigBase64(appState.reportSignatureBase64);
  }, [appState]);

  const handleSaveHeaderSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateReportCustomization) {
      onUpdateReportCustomization({
        reportHeaderCompanyName: customCompName,
        reportHeaderCnpj: customCnpj,
        reportHeaderAddress: customAddress,
        reportHeaderLogo: customLogo,
      });
      onAddAuditLog("UPDATE", "Configuração", "Atualizou o cabeçalho personalizado dos relatórios", "Regular");
      setSyncStatus({ type: "success", message: "Configurações de cabeçalho salvas com sucesso!" });
      setTimeout(() => setSyncStatus({ type: null, message: "" }), 3000);
    }
  };

  const handleSaveSignatureSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateReportCustomization) {
      onUpdateReportCustomization({
        reportSignatureName: sigName,
        reportSignatureRole: sigRole,
        reportSignatureEnabled: sigEnabled,
        reportSignatureBase64: sigBase64,
      });
      onAddAuditLog("UPDATE", "Configuração", "Atualizou a assinatura digital registrada dos relatórios", "Regular");
      setSyncStatus({ type: "success", message: "Configurações de assinatura digital salvas com sucesso!" });
      setTimeout(() => setSyncStatus({ type: null, message: "" }), 3000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setCustomLogo(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigBase64("");
  };

  const handleSaveCanvasAsSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if empty by reading image data
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isBlank = !buffer.data.some(channel => channel !== 0);
    if (isBlank) {
      alert("Desenhe sua assinatura no quadro antes de salvar.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    setSigBase64(dataUrl);
    if (onUpdateReportCustomization) {
      onUpdateReportCustomization({
        reportSignatureBase64: dataUrl,
        reportSignatureName: sigName,
        reportSignatureRole: sigRole,
        reportSignatureEnabled: sigEnabled
      });
      onAddAuditLog("UPDATE", "Configuração", "Registrou nova assinatura desenhada no painel", "Regular");
      setSyncStatus({ type: "success", message: "Assinatura desenhada registrada com sucesso!" });
      setTimeout(() => setSyncStatus({ type: null, message: "" }), 3000);
    }
  };

  // Firestore Sync Table States
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);

  const handleCopyShareLink = () => {
    const shareUrl = "https://ais-pre-lm6st5ndq4ild6xlpv5ha3-627952343829.us-west2.run.app";
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setSyncStatus({ type: "success", message: "Link de compartilhamento copiado! Qualquer usuário que acessar poderá visualizar e sincronizar os dados do posto." });
    setTimeout(() => setCopiedShareLink(false), 3000);
    setTimeout(() => setSyncStatus({ type: null, message: "" }), 5000);
  };
  const [syncFilterStatus, setSyncFilterStatus] = useState<"all" | "pending" | "synced">("all");
  const [syncFilterModule, setSyncFilterModule] = useState<string>("all");
  const [syncSearchTerm, setSyncSearchTerm] = useState<string>("");

  const recordList = useMemo(() => buildSyncRecordList(appState, syncConfig.lastCloudSyncDate), [appState, syncConfig.lastCloudSyncDate]);
  
  const syncedCount = useMemo(() => recordList.filter((r) => r.isSynced).length, [recordList]);
  const pendingCount = useMemo(() => recordList.filter((r) => !r.isSynced).length, [recordList]);

  const filteredRecordList = useMemo(() => {
    return recordList.filter((item) => {
      if (syncFilterStatus === "pending" && item.isSynced) return false;
      if (syncFilterStatus === "synced" && !item.isSynced) return false;
      if (syncFilterModule !== "all" && item.module !== syncFilterModule) return false;
      if (syncSearchTerm.trim()) {
        const term = syncSearchTerm.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(term);
        const matchesDetail = item.detail?.toLowerCase().includes(term);
        const matchesId = item.id.toLowerCase().includes(term);
        const matchesResp = item.responsible?.toLowerCase().includes(term);
        if (!matchesTitle && !matchesDetail && !matchesId && !matchesResp) return false;
      }
      return true;
    });
  }, [recordList, syncFilterStatus, syncFilterModule, syncSearchTerm]);

  const handleSyncAllToFirestore = async () => {
    setIsSyncingFirestore(true);
    const cleanCnpj = cnpjPosto ? cnpjPosto.replace(/\D/g, "") : "12345678000199";
    setSyncStatus({ type: "info", message: "Enviando e gravando todos os registros pendentes no Firebase Firestore..." });
    try {
      const docRef = doc(db, "postos", cleanCnpj);
      await setDoc(docRef, appState);
      const nowIso = new Date().toISOString();
      onUpdateConfig({
        ...syncConfig,
        lastCloudSyncDate: nowIso,
        lastBackupDate: nowIso,
      });
      onAddAuditLog("UPLOAD", "Firestore Cloud", "Sincronizou todos os registros do posto no banco de dados Firestore", "Regular");
      setSyncStatus({ type: "success", message: "🎉 Todos os registros foram salvos e sincronizados com sucesso no Firestore!" });
    } catch (err: any) {
      console.error("Erro na sincronização Firestore:", err);
      setSyncStatus({ type: "error", message: "Erro ao sincronizar com Firestore: " + (err.message || "Erro de conexão") });
    } finally {
      setIsSyncingFirestore(false);
    }
    setTimeout(() => setSyncStatus({ type: null, message: "" }), 5000);
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setLockError(false);
    const requiredPass = appState.securePassword || "adm001";
    if (lockPassword === requiredPass) {
      setIsUnlocked(true);
      setLockPassword("");
    } else {
      setLockError(true);
    }
  };

  const handleTogglePassword = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveSyncConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      ...syncConfig,
      apiUrl,
      token,
      autoSync,
    });
    setSyncStatus({ type: "success", message: "Configurações de sincronização salvas!" });
    setTimeout(() => setSyncStatus({ type: null, message: "" }), 3000);
  };

  const handleSaveBackupSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...syncConfig,
      scheduledBackupEnabled,
      backupFrequency,
      backupDestination,
      autoDownloadLocalJson,
      googleDriveBackupEnabled,
      googleDriveFolderName,
      googleDriveTokens,
      lastBackupDate: syncConfig.lastBackupDate || new Date().toISOString(),
    };
    onUpdateConfig(updated);
    onAddAuditLog("UPDATE", "Segurança", `Configuração de backup agendado atualizada (${scheduledBackupEnabled ? "Ativo - " + backupFrequency : "Desativado"}${googleDriveBackupEnabled ? " | Drive Ativo: " + googleDriveFolderName : ""})`, "Regular");
    setSyncStatus({ type: "success", message: "Parâmetros de backup agendado salvos com sucesso!" });
    setTimeout(() => setSyncStatus({ type: null, message: "" }), 3000);
  };

  const handleConnectGoogleDrive = () => {
    const width = 520;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      "/api/auth/google",
      "GoogleDriveOAuth",
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
    );
  };

  const handleDisconnectGoogleDrive = () => {
    setGoogleDriveTokens(null);
    setGoogleDriveBackupEnabled(false);
    const updated = {
      ...syncConfig,
      googleDriveTokens: null,
      googleDriveBackupEnabled: false,
    };
    onUpdateConfig(updated);
    onAddAuditLog("UPDATE", "Segurança", "Desconectou conta do Google Drive das configurações de backup", "Regular");
    setSyncStatus({
      type: "info",
      message: "Conta do Google Drive desconectada com sucesso.",
    });
  };

  const handleManualGoogleDriveUpload = async () => {
    if (!googleDriveTokens) {
      alert("Conecte sua conta do Google Drive antes de realizar o backup.");
      return;
    }

    setIsUploadingDrive(true);
    setSyncStatus({ type: "info", message: "Enviando backup completo em JSON para a pasta do Google Drive..." });

    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `backup_posto_${cnpjPosto.replace(/\D/g, "")}_${dateStr}.json`;

      const res = await fetch("/api/drive/upload-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: googleDriveTokens,
          folderName: googleDriveFolderName || "Backups_MeuPosto",
          cnpj: cnpjPosto,
          backupData: appState,
          filename: filename,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao realizar upload no Google Drive");
      }

      const nowIso = new Date().toISOString();
      const updated = {
        ...syncConfig,
        googleDriveBackupEnabled,
        googleDriveFolderName,
        lastGoogleDriveBackupDate: nowIso,
        lastGoogleDriveFileLink: data.webViewLink,
      };
      onUpdateConfig(updated);

      onAddAuditLog(
        "DOWNLOAD",
        "Segurança",
        `Backup em JSON enviado para a pasta "${data.folderName}" no Google Drive (${data.fileName})`,
        "Regular"
      );

      setSyncStatus({
        type: "success",
        message: `Backup em JSON enviado com sucesso para o Google Drive na pasta "${data.folderName}"!`,
      });
    } catch (err: any) {
      console.error("Google Drive Upload Error:", err);
      setSyncStatus({
        type: "error",
        message: "Erro ao enviar backup para o Google Drive: " + err.message,
      });
    } finally {
      setIsUploadingDrive(false);
    }
  };

  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (json.tanks || json.timesheetEntries || json.lmcRecords || json.users)) {
          if (confirm(`Deseja restaurar a base de dados do posto a partir do arquivo "${file.name}"? As informações atuais serão atualizadas.`)) {
            onRestoreState(json);
            onAddAuditLog("RESTORE", "Segurança", `Banco de dados restaurado a partir do arquivo local JSON "${file.name}"`, "Regular");
            setSyncStatus({ type: "success", message: `Backup "${file.name}" restaurado com sucesso!` });
            setTimeout(() => setSyncStatus({ type: null, message: "" }), 4000);
          }
        } else {
          alert("O arquivo selecionado não possui a estrutura válida de dados do Meu Posto.");
        }
      } catch (err: any) {
        alert("Erro ao ler o arquivo de backup: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleBackupDownload = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 4));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("download", `backup_posto_${cnpjPosto.replace(/[\.\/-]/g, "")}_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      onAddAuditLog("DOWNLOAD", "Segurança", "Baixou arquivo local de backup JSON do sistema", "Regular");
      setSyncStatus({ type: "success", message: "Cópia local de segurança JSON exportada!" });
      setTimeout(() => setSyncStatus({ type: null, message: "" }), 3000);
    } catch (e: any) {
      setSyncStatus({ type: "error", message: "Erro ao gerar arquivo de backup: " + e.message });
    }
  };

  // Upload/Download real synchronization with Firebase Firestore
  const handleUploadCloud = async () => {
    const cleanCnpj = cnpjPosto ? cnpjPosto.replace(/\D/g, "") : "12345678000199";
    setSyncStatus({ type: "info", message: "Enviando e salvando estado completo no Firebase Firestore..." });
    try {
      const docRef = doc(db, "postos", cleanCnpj);
      await setDoc(docRef, appState);
      const nowIso = new Date().toISOString();
      onUpdateConfig({
        ...syncConfig,
        lastCloudSyncDate: nowIso,
        lastBackupDate: nowIso,
      });
      onAddAuditLog("UPLOAD", "Segurança", "Enviou e sincronizou dados do posto com o Firebase Firestore", "Regular");
      setSyncStatus({ type: "success", message: "Dados sincronizados com sucesso no Firebase Firestore!" });
    } catch (err: any) {
      console.error("Erro no envio para Firestore:", err);
      setSyncStatus({ type: "error", message: "Erro ao enviar para o Firebase: " + (err.message || "Erro desconhecido") });
    }
    setTimeout(() => setSyncStatus({ type: null, message: "" }), 4000);
  };

  const handleDownloadCloud = async () => {
    const cleanCnpj = cnpjPosto ? cnpjPosto.replace(/\D/g, "") : "12345678000199";
    setSyncStatus({ type: "info", message: "Buscando backup mais recente no Firebase Firestore..." });
    try {
      const docRef = doc(db, "postos", cleanCnpj);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as AppState;
        onRestoreState(cloudData);
        onAddAuditLog("DOWNLOAD", "Segurança", "Restaurou banco de dados do posto a partir do Firebase Firestore", "Regular");
        setSyncStatus({ type: "success", message: "Banco de dados restaurado do Firebase com sucesso!" });
      } else {
        setSyncStatus({ type: "error", message: "Nenhum backup encontrado no Firebase para este CNPJ." });
      }
    } catch (err: any) {
      console.error("Erro ao baixar do Firestore:", err);
      setSyncStatus({ type: "error", message: "Erro ao carregar do Firebase: " + (err.message || "Erro desconhecido") });
    }
    setTimeout(() => setSyncStatus({ type: null, message: "" }), 4000);
  };

  // Credential operations
  const handleSaveCredential = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credName.trim() || !credLogin.trim() || !credPass.trim()) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const newCred: SystemCredential = {
      id: "cred_" + Date.now(),
      systemName: credName,
      category: credCategory,
      login: credLogin,
      password: credPass,
      description: credDesc,
      stationCnpj: cnpjPosto,
    };

    onUpdateCredentials([...systemCredentials, newCred]);
    onAddAuditLog("CREATE", "Segurança", `Adicionou nova credencial de TI para: "${credName}"`, "Regular");

    setIsCredModalOpen(false);
    setCredName("");
    setCredLogin("");
    setCredPass("");
    setCredDesc("");
  };

  const handleDeleteCredential = (id: string) => {
    if (confirm("Remover esta credencial de acesso?")) {
      const filtered = systemCredentials.filter((c) => c.id !== id);
      onUpdateCredentials(filtered);
      onAddAuditLog("DELETE", "Segurança", `Excluiu credencial de sistema ID ${id}`, "Regular");
    }
  };

  // Viewer accounts operations
  const handleSaveViewer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim() || !vEmail.trim() || !vPass.trim()) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const isDuplicate = users.some((u) => u.email.toLowerCase() === vEmail.toLowerCase());
    if (isDuplicate) {
      alert("Esta conta de e-mail já existe.");
      return;
    }

    const newViewer: User = {
      id: "u_view_" + Date.now(),
      nomeCompleto: vName,
      email: vEmail,
      senhaCriptografada: vPass,
      cpf: "000.000.000-00",
      cargo: "Frentista", // acts as read-only or limited
      cnpjPosto,
      telefone: "(11) 99999-9999",
    };

    onUpdateUsers([...users, newViewer]);
    onAddAuditLog("CREATE", "Segurança", `Adicionou nova conta de visualizador: ${vName}`, "Regular");

    setIsViewerModalOpen(false);
    setVName("");
    setVEmail("");
    setVPass("");
  };

  const handleDeleteViewer = (id: string) => {
    if (confirm("Remover o acesso deste visualizador?")) {
      const filtered = users.filter((u) => u.id !== id);
      onUpdateUsers(filtered);
      onAddAuditLog("DELETE", "Segurança", `Acesso de visualizador ID ${id} revogado`, "Regular");
    }
  };

  // Filtered operational values
  const filteredCredentials = systemCredentials.filter((c) => c.stationCnpj === cnpjPosto);
  const viewerUsers = users.filter((u) => u.cnpjPosto === cnpjPosto && u.cpf === "000.000.000-00");

  if (!isUnlocked) {
    return (
      <div className="max-w-md w-full mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
          <Lock className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2 font-display">Área Restrita do Gerente</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Para visualizar credenciais de sistemas do posto, dados de faturamento PJ e configurar backups Supabase Cloud, digite a senha administrativa.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder={appState.securePassword ? "Digite a senha administrativa" : "Digite a senha (padrão: adm001)"}
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center font-semibold"
            />
            {lockError && (
              <p className="text-[10px] text-rose-600 font-bold mt-1.5 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Senha administrativa incorreta! {appState.securePassword ? "Use a nova senha que você alterou." : "Tente adm001."}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center space-x-2 text-xs shadow-sm cursor-pointer"
          >
            <Unlock className="h-4 w-4" />
            <span>Desbloquear Área de Sistemas</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Sistemas, Finanças e Segurança"
        titleIcon={<Unlock className="h-5 w-5" />}
        subtitle="Configure faturamento bancário PJ, credenciais de concentradores / SEFAZ, visualizadores de escala e backups em nuvem"
        activeTab="sistemas"
        onChange={() => {}}
        tabs={[
          {
            id: "sistemas",
            label: "Sistemas e Segurança",
            icon: <Unlock className="h-4 w-4" />,
          }
        ]}
        rightElement={
          <button
            type="button"
            onClick={() => setIsUnlocked(false)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            <span>Bloquear Acesso</span>
          </button>
        }
      />

      {syncStatus.message && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            syncStatus.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : syncStatus.type === "error"
              ? "bg-rose-50 border-rose-100 text-rose-800"
              : "bg-blue-50 border-blue-100 text-blue-800"
          }`}
        >
          {syncStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-indigo-600" />}
          {syncStatus.message}
        </div>
      )}

      {/* BANNER: Link de Acesso Global & Sincronização em Qualquer Local */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                <Globe className="h-4 w-4" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Acesso Global e Sincronização Ativa
              </span>
            </div>
            <h3 className="text-lg font-bold font-display text-white">
              Sincronizar com Banco de Dados em Qualquer Local
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Utilize o link de compartilhamento abaixo para acessar o sistema de qualquer computador, tablet ou smartphone. Todos os dados inseridos são sincronizados em tempo real com o banco de dados Firebase Firestore.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`px-5 py-3 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                copiedShareLink
                  ? "bg-emerald-500 text-white"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {copiedShareLink ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copiar Link de Compartilhamento</span>
                </>
              )}
            </button>

            <a
              href="https://ais-pre-lm6st5ndq4ild6xlpv5ha3-627952343829.us-west2.run.app"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4 text-slate-300" />
              <span>Abrir App</span>
            </a>
          </div>
        </div>

        <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 truncate text-slate-300">
            <Share2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">https://ais-pre-lm6st5ndq4ild6xlpv5ha3-627952343829.us-west2.run.app</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-sans font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0 self-start sm:self-auto">
            🟢 Firestore Cloud Online
          </span>
        </div>
      </div>

      {/* SECTION: Logged User Profile Editing */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Perfil do Usuário Logado
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Personalize sua foto de perfil, dados pessoais e selecione um avatar pré-definido para toda a plataforma
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Cargo: {currentUser?.cargo}
            </span>
          </div>
        </div>

        {profileSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Perfil atualizado com sucesso! Suas preferências de foto e avatar já estão ativas em toda a interface do aplicativo.</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            
            {/* Column 1: Live Avatar Preview & Controls */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center text-center space-y-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Visualização em Tempo Real
              </span>
              
              <div className="relative group">
                <UserAvatar user={tempUserPreview} size="xl" className="ring-4 ring-white shadow-md" />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition cursor-pointer border-2 border-white"
                  title="Fazer Upload de Foto"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <p className="text-xs font-black text-slate-800">{tempUserPreview.nomeCompleto}</p>
                <p className="text-[10px] font-medium text-slate-500">{tempUserPreview.email}</p>
              </div>

              <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="w-full space-y-2 pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Upload className="h-3.5 w-3.5 text-indigo-600" />
                  Upload de Foto de Perfil
                </button>

                {(profileAvatarUrl || profileAvatarIcon) && (
                  <button
                    type="button"
                    onClick={handleClearAvatar}
                    className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Restaurar Avatar Padrão
                  </button>
                )}
              </div>
            </div>

            {/* Column 2: Select Preset Emoji Avatar Icons */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Smile className="h-3.5 w-3.5 text-indigo-600" />
                  Avatares Pré-definidos
                </span>
                {profileAvatarIcon && (
                  <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    Ativo: {profileAvatarIcon}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                Escolha um dos ícones pré-definidos abaixo se preferir não enviar uma foto pessoal:
              </p>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {PRESET_AVATAR_ICONS.map((icon) => {
                  const isSelected = profileAvatarIcon === icon && !profileAvatarUrl;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => handleSelectPresetIcon(icon)}
                      className={`h-11 rounded-xl text-xl flex items-center justify-center transition cursor-pointer border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400 scale-105 shadow-sm"
                          : "bg-white hover:bg-indigo-50 border-slate-200 text-slate-800 hover:border-indigo-300"
                      }`}
                      title={`Selecionar ícone ${icon}`}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Personal Information Inputs */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Informações do Perfil
              </span>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Salvar Alterações do Perfil
                  </button>
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* Main Grid: Bank and Credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Bank info card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Building className="h-4 w-4 text-indigo-600" />
              Dados PJ & Conta Corrente
            </h3>
            <p className="text-[11px] text-slate-500">
              Informações oficiais do posto para emissão de notas fiscais SEFAZ e faturamento comercial.
            </p>

            <div className="space-y-3 font-medium text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Instituição</p>
                <p className="text-slate-800 font-bold">{bankName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agência</p>
                  <p className="text-slate-800 font-bold">{bankAgency}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Conta Corrente</p>
                  <p className="text-slate-800 font-bold">{bankAccount}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chave PIX Recebimento (PJ)</p>
                <p className="text-slate-800 font-bold truncate">{bankPixKey}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsBankModalOpen(true)}
            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 border border-indigo-100 mt-4 cursor-pointer"
          >
            <Edit className="h-3.5 w-3.5" />
            Editar Conta PJ
          </button>
        </div>

        {/* Column 2 & 3: Credentials manager */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Key className="h-4 w-4 text-indigo-600" />
              Credenciais de Acesso a Sistemas de TI
            </h3>
            <button
              onClick={() => setIsCredModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova Credencial
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-3">Serviço / IP</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Usuário</th>
                  <th className="py-2.5 px-3">Senha</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCredentials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 italic">No credentials recorded.</td>
                  </tr>
                ) : (
                  filteredCredentials.map((cred) => {
                    const isVisible = visiblePasswords[cred.id];
                    return (
                      <tr key={cred.id} className="border-b border-slate-100/60 hover:bg-slate-50/40">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-800">{cred.systemName}</p>
                          <p className="text-[9.5px] text-slate-500 mt-0.5">{cred.description}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded font-semibold text-slate-600 text-[10px]">
                            {cred.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium">{cred.login}</td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{isVisible ? cred.password : "••••••••"}</span>
                            <button
                              onClick={() => handleTogglePassword(cred.id)}
                              className="text-slate-400 hover:text-indigo-600 transition"
                            >
                              {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteCredential(cred.id)}
                            className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                          >
                            Excluir
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

      {/* Authorized Read-only Viewers */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Unlock className="h-4 w-4 text-indigo-600" />
            Visualizadores Autorizados do Posto
          </h3>
          <button
            onClick={() => setIsViewerModalOpen(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Visualizador
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                <th className="py-2.5 px-3">Nome</th>
                <th className="py-2.5 px-3">Login / E-mail</th>
                <th className="py-2.5 px-3">Senha de Acesso</th>
                <th className="py-2.5 px-3">Nível Permissão</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {viewerUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic">Nenhum visualizador cadastrado ainda.</td>
                </tr>
              ) : (
                viewerUsers.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100/60 hover:bg-slate-50/40">
                    <td className="py-3 px-3 font-semibold text-slate-800">{v.nomeCompleto}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-600">{v.email}</td>
                    <td className="py-3 px-3 font-mono font-medium">••••••••</td>
                    <td className="py-3 px-3">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-bold px-2 py-0.5 text-[9px] uppercase">
                        Visualizador (Read-only)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDeleteViewer(v.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                      >
                        Revogar Acesso
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Central de Monitoramento de Pendências de Sincronização Firestore */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-800">
                  Status de Sincronização em Nuvem (Firebase Firestore)
                </h3>
                {pendingCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {pendingCount} {pendingCount === 1 ? "Registro Pendente" : "Registros Pendentes"}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    100% Sincronizado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhe em tempo real quais dados foram criados/editados localmente e quais já estão gravados e seguros no Firestore.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncAllToFirestore}
            disabled={isSyncingFirestore}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingFirestore ? "animate-spin" : ""}`} />
            <span>{isSyncingFirestore ? "Sincronizando..." : "Sincronizar Pendências Agora"}</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total de Registros</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-slate-800">{recordList.length}</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Registros cadastrados no sistema</span>
          </div>

          <div className={`p-3.5 rounded-xl border ${pendingCount > 0 ? "bg-amber-50/60 border-amber-200" : "bg-slate-50/80 border-slate-200/80"}`}>
            <span className="text-[10px] font-black uppercase tracking-wider block text-amber-700">Pendentes (Local)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className={`text-xl font-black ${pendingCount > 0 ? "text-amber-800" : "text-slate-800"}`}>{pendingCount}</span>
              <Clock className={`h-4 w-4 ${pendingCount > 0 ? "text-amber-600" : "text-slate-400"}`} />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {pendingCount > 0 ? "Aguardando envio ao Firestore" : "Nenhum pendente"}
            </span>
          </div>

          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Sincronizados</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-emerald-900">{syncedCount}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">Confirmados em nuvem</span>
          </div>

          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Última Nuvem</span>
            <div className="mt-1">
              <span className="text-xs font-bold text-slate-800 font-mono block truncate">
                {syncConfig.lastCloudSyncDate
                  ? new Date(syncConfig.lastCloudSyncDate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                  : "Não realizada"}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Data do último upload</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por descrição, usuário, nota fiscal ou id..."
              value={syncSearchTerm}
              onChange={(e) => setSyncSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            {syncSearchTerm && (
              <button
                onClick={() => setSyncSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Status buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setSyncFilterStatus("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                syncFilterStatus === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos ({recordList.length})
            </button>
            <button
              type="button"
              onClick={() => setSyncFilterStatus("pending")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                syncFilterStatus === "pending"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Clock className="h-3 w-3" />
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setSyncFilterStatus("synced")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                syncFilterStatus === "synced"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Check className="h-3 w-3" />
              Sincronizados ({syncedCount})
            </button>
          </div>

          {/* Module Selector */}
          <div className="w-full sm:w-auto shrink-0">
            <select
              value={syncFilterModule}
              onChange={(e) => setSyncFilterModule(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">Todos os Módulos</option>
              <option value="Turnos & Checklists">Turnos & Checklists</option>
              <option value="Folha de Ponto">Folha de Ponto</option>
              <option value="Suprimentos & Fardamento">Suprimentos & Fardamento</option>
              <option value="Financeiro & Caixa">Financeiro & Caixa</option>
              <option value="Controle de Qualidade ANP">Controle de Qualidade ANP</option>
              <option value="Lubrificantes & Combustíveis">Lubrificantes & Combustíveis</option>
              <option value="Credenciais TI">Credenciais TI</option>
              <option value="LMC & Balanços">LMC & Balanços</option>
            </select>
          </div>
        </div>

        {/* Table of records */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10 text-[10px] uppercase font-black text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Status Nuvem</th>
                  <th className="py-2.5 px-3">Módulo</th>
                  <th className="py-2.5 px-3">Descrição do Registro</th>
                  <th className="py-2.5 px-3">Data / Registro</th>
                  <th className="py-2.5 px-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecordList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                      {syncFilterStatus === "pending" && pendingCount === 0 ? (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                          <p className="font-bold text-slate-700 text-xs">Nenhum registro pendente de sincronização!</p>
                          <p className="text-[11px] text-slate-400">Todos os dados do posto já foram transmitidos e gravados com segurança no Firestore.</p>
                        </div>
                      ) : (
                        <p>Nenhum registro encontrado para os filtros selecionados.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecordList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.isSynced ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            SINCRONIZADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                            <Clock className="h-3 w-3 text-amber-600" />
                            PENDENTE (LOCAL)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-600 text-[11px]">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200/60">
                          {item.module}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-800 leading-tight">{item.title}</p>
                        {item.detail && (
                          <p className="text-[11px] text-slate-500 font-normal mt-0.5 truncate max-w-md">{item.detail}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                        {item.dateStr}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-semibold text-[11px]">
                        {item.responsible || "Sistema"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
            <span>Exibindo <strong>{filteredRecordList.length}</strong> de <strong>{recordList.length}</strong> registros</span>
            <span>{pendingCount > 0 ? `⚠️ ${pendingCount} pendente(s) de sincronização` : "✅ Todos sincronizados com Firestore"}</span>
          </div>
        </div>
      </div>

      {/* Cloud Sync & Supabase Backup & Station Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supabase Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Cloud className="h-4 w-4 text-emerald-600" />
            Sincronização Nuvem Supabase ☁️
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Configure credenciais ou endpoints para o sincronizador automático cloud para permitir backup instantâneo de transações, checklists e LMC do posto.
          </p>

          <form onSubmit={handleSaveSyncConfig} className="space-y-4 pt-1">
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                URL da API do Servidor (Backup Host)
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Token de Autorização API (Supabase / Anon Key)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700"
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer text-center"
              >
                Salvar Parâmetros
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleUploadCloud}
                  className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer text-center"
                >
                  Enviar Nuvem
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCloud}
                  className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer text-center"
                >
                  Sincronizar
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Local offline backup card & Scheduled Backup Configuration */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 text-indigo-600" />
              Backups Agendados & Exportação JSON
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${scheduledBackupEnabled ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
              {scheduledBackupEnabled ? "Agendado" : "Inativo"}
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Configure a geração automática e periódica de backups do estado completo do aplicativo (tanques, folha de ponto, LMC, checklists e auditoria) e realize downloads JSON do estado a qualquer momento.
          </p>

          <form onSubmit={handleSaveBackupSchedule} className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduledBackupEnabled}
                  onChange={(e) => setScheduledBackupEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Ativar Backup Agendado Automático
              </label>
            </div>

            {scheduledBackupEnabled && (
              <div className="space-y-3 pt-2 border-t border-slate-200/50 text-xs">
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Frequência do Agendamento
                  </label>
                  <select
                    value={backupFrequency}
                    onChange={(e) => setBackupFrequency(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="daily">Diário (A cada 24 horas)</option>
                    <option value="12h">A cada 12 horas</option>
                    <option value="weekly">Semanalmente (A cada 7 dias)</option>
                    <option value="shift_end">A cada Encerramento de Turno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Destino / Ação do Backup
                  </label>
                  <select
                    value={backupDestination}
                    onChange={(e) => setBackupDestination(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="both">Download Local + Sincronização em Nuvem</option>
                    <option value="download">Somente Download do Arquivo JSON</option>
                    <option value="cloud">Somente Sincronização em Nuvem (Firebase)</option>
                  </select>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Salvar Agendamento
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Google Drive Extra Cloud Storage Box */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-slate-50 border border-indigo-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
                  <Cloud className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Google Drive (Armazenamento em Nuvem Extra)</h4>
                  <p className="text-[11px] text-slate-500">Backup automático de dados JSON em pasta do Google Drive</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                googleDriveTokens ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-200 text-slate-600"
              }`}>
                {googleDriveTokens ? "Conectado" : "Não Conectado"}
              </span>
            </div>

            {!googleDriveTokens ? (
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                className="w-full py-2 bg-white hover:bg-slate-50 text-indigo-700 font-bold border border-indigo-200 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Cloud className="h-3.5 w-3.5 text-indigo-600" />
                <span>Conectar Conta do Google Drive</span>
              </button>
            ) : (
              <div className="space-y-3 text-xs pt-1 border-t border-indigo-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={googleDriveBackupEnabled}
                      onChange={(e) => setGoogleDriveBackupEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    Ativar cópia automática para o Drive
                  </label>

                  <button
                    type="button"
                    onClick={handleDisconnectGoogleDrive}
                    className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                  >
                    Desconectar
                  </button>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nome da Pasta no Google Drive
                  </label>
                  <input
                    type="text"
                    value={googleDriveFolderName}
                    onChange={(e) => setGoogleDriveFolderName(e.target.value)}
                    placeholder="Ex: Backups_MeuPosto"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleManualGoogleDriveUpload}
                  disabled={isUploadingDrive}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  <span>{isUploadingDrive ? "Enviando para o Drive..." : "Enviar Backup para o Google Drive Agora"}</span>
                </button>

                {syncConfig.lastGoogleDriveBackupDate && (
                  <div className="pt-1 text-[10px] text-slate-500 font-mono space-y-0.5">
                    <div>Último upload Drive: {new Date(syncConfig.lastGoogleDriveBackupDate).toLocaleString("pt-BR")}</div>
                    {syncConfig.lastGoogleDriveFileLink && (
                      <a
                        href={syncConfig.lastGoogleDriveFileLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline font-bold flex items-center gap-1"
                      >
                        Ver arquivo no Google Drive ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Download & Restore Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleBackupDownload}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer border-0"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Baixar Estado Atual em JSON</span>
            </button>

            <label className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-200">
              <Upload className="h-3.5 w-3.5 text-indigo-600" />
              <span>Restaurar de Arquivo JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreJsonBackup}
                className="hidden"
              />
            </label>
          </div>

          {syncConfig.lastBackupDate && (
            <p className="text-[10px] text-slate-400 text-center font-mono">
              Último backup realizado: {new Date(syncConfig.lastBackupDate).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        {/* Configuração de Unidade, Cabeçalho e Assinatura */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between lg:col-span-1">
          <div className="space-y-4">
            {/* Tabs Selector */}
            <div className="flex border-b border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setStationTab("info")}
                className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                  stationTab === "info"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Dados Gerais
              </button>
              <button
                type="button"
                onClick={() => setStationTab("header")}
                className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                  stationTab === "header"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Cabeçalho
              </button>
              <button
                type="button"
                onClick={() => setStationTab("signature")}
                className={`flex-1 pb-2 border-b-2 text-center transition-all cursor-pointer ${
                  stationTab === "signature"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Assinatura
              </button>
            </div>

            {/* TAB CONTENT: INFO */}
            {stationTab === "info" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 pb-1">
                  <Building className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-black uppercase text-slate-800">Dados do Posto</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Gerencie o Nome Fantasia e CNPJ ativo do posto de serviços para faturamento e LMC.
                </p>

                <div className="space-y-3 font-medium text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Nome Fantasia do Posto</p>
                    <p className="text-slate-800 font-bold truncate">{appState.nomePosto || "Meu Posto - Gestão Inteligente"}</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">CNPJ Cadastrado</p>
                    <p className="text-slate-800 font-bold font-mono">{cnpjPosto}</p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Senha da Área Segura</p>
                    <div className="flex justify-between items-center">
                      <p className="text-slate-800 font-mono font-bold">
                        {stationShowPassword ? (appState.securePassword || "adm001") : "••••••••"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setStationShowPassword(!stationShowPassword)}
                        className="text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase font-sans tracking-wide border-0 cursor-pointer"
                      >
                        {stationShowPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewStationName(appState.nomePosto || "Meu Posto - Gestão Inteligente");
                    setNewStationCnpj(cnpjPosto);
                    setNewStationPassword(appState.securePassword || "adm001");
                    setIsStationModalOpen(true);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl transition mt-4 text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-0"
                >
                  <Edit className="h-4 w-4 text-indigo-600" />
                  <span>Editar Posto & Senha</span>
                </button>
              </div>
            )}

            {/* TAB CONTENT: HEADER CUSTOMIZATION */}
            {stationTab === "header" && (
              <form onSubmit={handleSaveHeaderSettings} className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 pb-1">
                  <FileJson className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-black uppercase text-slate-800">Customizar Cabeçalho</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Defina os dados padrão emitidos no topo de todos os relatórios PDF (LMC, Qualidade ANP, Balanços, Fechamentos).
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Razão Social / Nome Fantasia</label>
                    <input
                      type="text"
                      required
                      value={customCompName}
                      onChange={(e) => setCustomCompName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">CNPJ do Relatório</label>
                    <input
                      type="text"
                      required
                      value={customCnpj}
                      onChange={(e) => setCustomCnpj(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Endereço da Unidade</label>
                    <textarea
                      rows={2}
                      value={customAddress}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Logomarca do Posto (Opcional)</label>
                    <div className="flex items-center gap-3">
                      {customLogo ? (
                        <div className="relative h-12 w-12 border border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
                          <img src={customLogo} alt="Logo Posto" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => setCustomLogo("")}
                            className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-0.5 shadow-sm hover:bg-rose-500"
                            title="Remover logo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300 shrink-0 text-slate-400">
                          <Building className="h-5 w-5" />
                        </div>
                      )}
                      <label className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl transition text-xs text-center cursor-pointer">
                        <Upload className="h-3.5 w-3.5 inline mr-1.5 text-indigo-600" />
                        Carregar Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar Cabeçalho</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: SIGNATURE CUSTOMIZATION */}
            {stationTab === "signature" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 pb-1">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-black uppercase text-slate-800">Assinatura Digital</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Registre sua assinatura legal. Ela será impressa automaticamente no rodapé de cada relatório PDF emitido no sistema.
                </p>

                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/50">
                  <span className="text-xs font-semibold text-slate-700">Imprimir em todos relatórios</span>
                  <input
                    type="checkbox"
                    checked={sigEnabled}
                    onChange={(e) => {
                      setSigEnabled(e.target.checked);
                      if (onUpdateReportCustomization) {
                        onUpdateReportCustomization({ reportSignatureEnabled: e.target.checked });
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Assinante</label>
                    <input
                      type="text"
                      required
                      value={sigName}
                      onChange={(e) => setSigName(e.target.value)}
                      placeholder="Ex: Carlos Eduardo de Oliveira"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cargo / Função do Assinante</label>
                    <input
                      type="text"
                      required
                      value={sigRole}
                      onChange={(e) => setSigRole(e.target.value)}
                      placeholder="Ex: Gerente Geral / Representante Legal"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Desenho da Assinatura</label>
                      <button
                        type="button"
                        onClick={handleClearSignature}
                        className="text-rose-600 hover:text-rose-500 text-[10px] font-bold uppercase tracking-wider cursor-pointer border-0 bg-transparent"
                      >
                        Limpar Quadro
                      </button>
                    </div>

                    <div className="border border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 relative">
                      <canvas
                        ref={canvasRef}
                        width={300}
                        height={120}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="w-full h-[100px] bg-slate-50 block cursor-crosshair touch-none"
                      />
                      {!sigBase64 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Desenhe sua assinatura aqui
                        </div>
                      )}
                    </div>
                  </div>

                  {sigBase64 && (
                    <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-800 font-semibold">Assinatura salva e ativa</span>
                      </div>
                      <img src={sigBase64} alt="Assinatura" className="h-8 max-w-[120px] object-contain shrink-0 bg-white p-0.5 rounded border" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSaveCanvasAsSignature}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Registrar Assinatura
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSignatureSettings}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Salvar Dados
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Bank Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in duration-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-indigo-600" />
              Editar Dados Bancários PJ
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsBankModalOpen(false);
                onAddAuditLog("UPDATE", "Finanças", "Alterou dados de conta PJ corporativa no ERP", "Regular");
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Banco</label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agência</label>
                  <input
                    type="text"
                    required
                    value={bankAgency}
                    onChange={(e) => setBankAgency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Conta Corrente</label>
                  <input
                    type="text"
                    required
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chave PIX PJ</label>
                <input
                  type="text"
                  required
                  value={bankPixKey}
                  onChange={(e) => setBankPixKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credential Modal */}
      {isCredModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in duration-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-1">
              <Key className="h-4 w-4 text-indigo-600" />
              Nova Credencial de Sistema
            </h3>

            <form onSubmit={handleSaveCredential} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Sistema</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: SEFAZ NFE"
                    value={credName}
                    onChange={(e) => setCredName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria</label>
                  <select
                    value={credCategory}
                    onChange={(e) => setCredCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 cursor-pointer"
                  >
                    <option value="Operacional">Operacional</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Equipamentos">Equipamentos</option>
                    <option value="Segurança">Segurança</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Login / ID</label>
                  <input
                    type="text"
                    required
                    value={credLogin}
                    onChange={(e) => setCredLogin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha</label>
                  <input
                    type="text"
                    required
                    value={credPass}
                    onChange={(e) => setCredPass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">IP local / Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: IP 192.168.1.100 ou link de acesso"
                  value={credDesc}
                  onChange={(e) => setCredDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCredModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Criar Credencial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewer Modal */}
      {isViewerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in duration-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-1">
              <Plus className="h-4 w-4 text-emerald-600" />
              Adicionar Visualizador Secundário
            </h3>

            <form onSubmit={handleSaveViewer} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Marcos Souza (Supervisor)"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Login E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="Ex: marcos@posto.com"
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha de Acesso</label>
                <input
                  type="password"
                  required
                  value={vPass}
                  onChange={(e) => setVPass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsViewerModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Conceder Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Station / Password Modal */}
      {isStationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in duration-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Building className="h-4 w-4 text-indigo-600" />
              Editar Cadastro do Posto & Senha Segura
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newStationName.trim()) {
                  alert("Por favor, preencha o Nome do Posto.");
                  return;
                }
                if (!newStationCnpj.trim()) {
                  alert("Por favor, preencha o CNPJ do Posto.");
                  return;
                }
                if (!newStationPassword.trim()) {
                  alert("A senha de proteção da Área Segura não pode ser vazia.");
                  return;
                }
                onUpdateStationDetails(newStationName, newStationCnpj, newStationPassword);
                onAddAuditLog(
                  "UPDATE",
                  "Configuração",
                  `Alterou o Nome para "${newStationName}", CNPJ para "${newStationCnpj}" e a senha da área segura.`,
                  "Regular"
                );
                setIsStationModalOpen(false);
                setSyncStatus({ type: "success", message: "Cadastro do posto e senha administrativa salvos com sucesso!" });
                setTimeout(() => setSyncStatus({ type: null, message: "" }), 4000);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Fantasia do Posto</label>
                <input
                  type="text"
                  required
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                  placeholder="Ex: Posto Central Ltda"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CNPJ do Posto</label>
                <input
                  type="text"
                  required
                  value={newStationCnpj}
                  onChange={(e) => setNewStationCnpj(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono font-semibold"
                  placeholder="Ex: 12.345.678/0001-99"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nova Senha da Área Segura</label>
                <input
                  type="text"
                  required
                  value={newStationPassword}
                  onChange={(e) => setNewStationPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono font-semibold text-slate-800"
                  placeholder="Digite a nova senha administrativa"
                />
                <p className="text-[9px] text-slate-400 mt-1">
                  Esta senha será solicitada para acessar esta aba no próximo desbloqueio.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStationModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer border-0"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
