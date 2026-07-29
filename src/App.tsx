/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { AppState, User, SyncConfig } from "./types";
import { INITIAL_STATE } from "./data/mockData";
import AuthScreen from "./components/AuthScreen";
import DashboardOverview from "./components/DashboardOverview";
import TanksManagement from "./components/TanksManagement";
import NozzlesManagement from "./components/NozzlesManagement";
import ShiftsChecklists from "./components/ShiftsChecklists";
import CashManagement from "./components/CashManagement";
import ANPQualityControl from "./components/ANPQualityControl";
import ReportsAdvanced from "./components/ReportsAdvanced";
import CloudSyncPanel from "./components/CloudSyncPanel";
import LMCManagement from "./components/LMCManagement";
import AuditorLog from "./components/AuditorLog";
import CashierShortage from "./components/CashierShortage";
import LubricantDeliveries from "./components/LubricantDeliveries";
import DailyBalance from "./components/DailyBalance";
import MonthlyDRE from "./components/MonthlyDRE";
import SupplyRequests from "./components/SupplyRequests";
import TimesheetManagement from "./components/TimesheetManagement";
import { UserAvatar } from "./components/UserAvatar";
import WelcomeOnboarding from "./components/WelcomeOnboarding";
import PWAModal from "./components/PWAModal";
import { AnimatedStationManager } from "./components/AnimatedStationManager";
import { getPendingFormsCountSW, triggerOfflineFormsSync } from "./lib/offlineSync";

import {
  LayoutDashboard,
  Fuel,
  Activity,
  ClipboardList,
  DollarSign,
  Thermometer,
  FileText,
  Cloud,
  LogOut,
  UserCheck,
  Building2,
  Menu,
  X,
  Lock,
  History,
  BookOpen,
  AlertTriangle,
  Droplets,
  BarChart3,
  Package,
  Calculator,
  Fingerprint,
  Download,
  Smartphone,
  Heart,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Users,
  Wifi,
  WifiOff,
  Share2,
  Copy,
  CheckCircle2,
  Trash2,
  Bot,
} from "lucide-react";

const STORAGE_KEY = "meu_posto_app_state";
const CONFIG_KEY = "meu_posto_sync_config";

import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut, 
  doc, 
  getDoc, 
  setDoc,
  onSnapshot,
  getRedirectResult,
  logAuthTelemetry
} from "./lib/firebase";

export default function App() {
  // 1. Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("meu_posto_logged_user");
    return saved ? JSON.parse(saved) : null;
  });

  // 2. Main App State (Offline-First local storage)
  const [appState, setAppStateInternal] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
      return INITIAL_STATE;
    }
    return JSON.parse(saved);
  });

  const setAppState = (value: React.SetStateAction<AppState>) => {
    setAppStateInternal((prev) => {
      const next = typeof value === "function" ? (value as Function)(prev) : value;
      
      // Force synchronous revalidation of dailyBalances records to guarantee Firestore receives a complete, non-polluted snapshot
      let validatedBalances = next.dailyBalances;
      if (Array.isArray(validatedBalances)) {
        validatedBalances = validatedBalances.map((b) => {
          const combustivel = Number(b.vendaCombustivel) || 0;
          const lubrificantes = Number(b.vendaLubrificantes) || 0;
          const outras = Number(b.outrasReceitas) || 0;
          const despesas = Number(b.totalDespesas) || 0;
          const calculado = combustivel + lubrificantes + outras - despesas;
          
          return {
            ...b,
            vendaCombustivel: combustivel,
            vendaLubrificantes: lubrificantes,
            outrasReceitas: outras,
            totalDespesas: despesas,
            saldoFinal: typeof b.saldoFinal === 'number' && !isNaN(b.saldoFinal) ? b.saldoFinal : calculado,
            metodosPagamento: b.metodosPagamento ? {
              dinheiro: Number(b.metodosPagamento.dinheiro) || 0,
              cartaoCredito: Number(b.metodosPagamento.cartaoCredito) || 0,
              cartaoDebito: Number(b.metodosPagamento.cartaoDebito) || 0,
              pix: Number(b.metodosPagamento.pix) || 0,
              prazo: Number(b.metodosPagamento.prazo) || 0,
            } : {
              dinheiro: 0,
              cartaoCredito: 0,
              cartaoDebito: 0,
              pix: 0,
              prazo: 0,
            }
          };
        });
      }

      const updated = {
        ...next,
        dailyBalances: validatedBalances,
        updatedAt: Date.now()
      };
      
      // Force synchronous update of appStateRef.current so that any immediate or async event reads the fresh data
      appStateRef.current = updated;
      return updated;
    });
  };

  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // 3. Sync Configuration
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.lastCloudSyncDate) {
          parsed.lastCloudSyncDate = new Date().toISOString();
        }
        return parsed;
      } catch (e) {
        console.warn("Erro ao ler syncConfig do localStorage:", e);
      }
    }
    return {
      apiUrl: window.location.origin,
      token: "",
      autoSync: true,
      lastCloudSyncDate: new Date().toISOString(),
    };
  });

  // 4. UI Layout States & PWA Install
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingState, setLoadingState] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingFormsCount, setPendingFormsCount] = useState<number>(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Global Clear Data Modal States
  const [isGlobalClearModalOpen, setIsGlobalClearModalOpen] = useState(false);
  const [globalClearOptions, setGlobalClearOptions] = useState({
    tanks: false,
    nozzles: false,
    shifts: false,
    transactions: false,
    dailyBalances: false,
    shortages: false,
    lubricants: false,
    qualityAudits: false,
    lmc: false,
    supplyRequests: false,
    timesheetEntries: false,
    audits: false,
  });

  const handleOpenGlobalClear = (tabId?: string) => {
    const targetTab = tabId || activeTab;
    setGlobalClearOptions({
      tanks: targetTab === "tanques" || targetTab === "dashboard",
      nozzles: targetTab === "bicos" || targetTab === "dashboard",
      shifts: targetTab === "escalas" || targetTab === "dashboard",
      transactions: targetTab === "caixa" || targetTab === "relatorios" || targetTab === "dashboard",
      dailyBalances: targetTab === "balanco" || targetTab === "relatorios" || targetTab === "dashboard",
      shortages: targetTab === "faltas" || targetTab === "dashboard",
      lubricants: targetTab === "lubrificantes" || targetTab === "dashboard",
      qualityAudits: targetTab === "qualidade" || targetTab === "dashboard",
      lmc: targetTab === "lmc" || targetTab === "balanco" || targetTab === "dashboard",
      supplyRequests: targetTab === "pedidos" || targetTab === "dashboard",
      timesheetEntries: targetTab === "ponto" || targetTab === "dashboard",
      audits: targetTab === "auditoria" || targetTab === "dashboard",
    });
    setIsGlobalClearModalOpen(true);
  };

  const handleConfirmGlobalClear = () => {
    const clearedModules: string[] = [];
    setAppState((prev) => {
      const nextState = { ...prev };
      if (globalClearOptions.tanks) {
        nextState.tanks = [];
        clearedModules.push("Tanques & Medições");
      }
      if (globalClearOptions.nozzles) {
        nextState.nozzles = [];
        nextState.nozzleClosings = [];
        nextState.calibrations = [];
        clearedModules.push("Bicos & Encerantes");
      }
      if (globalClearOptions.shifts) {
        nextState.shifts = [];
        nextState.schedulePatterns = [];
        clearedModules.push("Escalas & Plantões");
      }
      if (globalClearOptions.transactions) {
        nextState.transactions = [];
        nextState.reconciliations = [];
        clearedModules.push("Transações & Caixas");
      }
      if (globalClearOptions.dailyBalances) {
        nextState.dailyBalances = [];
        clearedModules.push("Balanços Diários");
      }
      if (globalClearOptions.shortages) {
        nextState.shortages = [];
        clearedModules.push("Faltas de Caixa");
      }
      if (globalClearOptions.lubricants) {
        nextState.lubricantDeliveries = [];
        clearedModules.push("Entregas de Lubrificantes");
      }
      if (globalClearOptions.qualityAudits) {
        nextState.qualityAudits = [];
        clearedModules.push("Testes de Qualidade ANP");
      }
      if (globalClearOptions.lmc) {
        nextState.lmc = [];
        clearedModules.push("Livro LMC");
      }
      if (globalClearOptions.supplyRequests) {
        nextState.supplyRequests = [];
        clearedModules.push("Pedidos de Suprimentos");
      }
      if (globalClearOptions.timesheetEntries) {
        nextState.timesheetEntries = [];
        clearedModules.push("Registros de Ponto");
      }
      if (globalClearOptions.audits) {
        nextState.audits = [];
        clearedModules.push("Logs de Auditoria");
      }

      return nextState;
    });

    if (clearedModules.length > 0) {
      handleAddAuditLog(
        "DELETE",
        "Limpeza de Dados",
        `Limpeza executada nos módulos: ${clearedModules.join(", ")}`,
        "Crítico"
      );
    }

    setIsGlobalClearModalOpen(false);
  };

  // Auto-trigger onboarding for new users if not completed
  useEffect(() => {
    if (currentUser) {
      const completed = localStorage.getItem(`meu_posto_onboarding_completed_${currentUser.id}`);
      if (!completed) {
        setShowOnboarding(true);
      }
    }
  }, [currentUser]);

  // Monitor network connectivity & offline form sync queue
  useEffect(() => {
    const checkPendingForms = () => {
      getPendingFormsCountSW().then((count) => setPendingFormsCount(count));
    };

    // Initial check
    checkPendingForms();
    const intervalId = setInterval(checkPendingForms, 10000);

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_FORM_QUEUED" || event.data?.type === "OFFLINE_SYNC_COMPLETE") {
        checkPendingForms();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync offline forms queued in Service Worker
      triggerOfflineFormsSync().then(() => checkPendingForms());

      if (currentUser) {
        const rawCnpj = currentUser.cnpjPosto || "12.345.678/0001-99";
        const cleanCnpj = rawCnpj.replace(/\D/g, "") || "12345678000199";
        const docRef = doc(db, "postos", cleanCnpj);
        setDoc(docRef, appStateRef.current).then(() => {
          const nowIso = new Date().toISOString();
          setSyncConfig((prev) => ({
            ...prev,
            lastCloudSyncDate: nowIso,
            lastBackupDate: nowIso,
          }));
        }).catch((err) => console.error("Erro na ressincronização ao voltar online:", err));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      checkPendingForms();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(intervalId);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [currentUser]);
  const [showPwaBanner, setShowPwaBanner] = useState(true);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstallable(false);
          setDeferredPrompt(null);
          setIsPwaModalOpen(false);
        } else {
          setIsPwaModalOpen(true);
        }
      } catch (err) {
        setIsPwaModalOpen(true);
      }
    } else {
      setIsPwaModalOpen(true);
    }
  };

  // Sync Firebase Auth session
  useEffect(() => {
    // Process redirect result if page has reloaded from Google signInWithRedirect
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("Usuário autenticado via redirect com sucesso:", result.user);
          const pendingLogId = localStorage.getItem("pending_auth_log_id");
          if (pendingLogId) {
            logAuthTelemetry(pendingLogId, "redirect_result", "success", {
              uid: result.user?.uid,
              email: result.user?.email,
              message: "Autenticado via redirect com sucesso"
            });
            localStorage.removeItem("pending_auth_log_id");
          }
        }
      })
      .catch((err: any) => {
        console.error("Erro ao obter resultado do redirecionamento de autenticação:", err);
        const pendingLogId = localStorage.getItem("pending_auth_log_id");
        if (pendingLogId) {
          logAuthTelemetry(pendingLogId, "redirect_result", "failed", {
            errorCode: err.code || "unknown",
            errorMessage: err.message || "Erro no redirect",
            message: "Falha na autenticação via redirect"
          });
          localStorage.removeItem("pending_auth_log_id");
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let userData: User | null = null;
        try {
          const fetchPromise = getDoc(doc(db, "users", firebaseUser.uid));
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
          const userDoc = await Promise.race([fetchPromise, timeoutPromise]);
          if (userDoc && "exists" in userDoc && userDoc.exists()) {
            userData = userDoc.data() as User;
          }
        } catch (err: any) {
          console.warn("Firestore offline ou timeout ao buscar sessão do usuário:", err?.message || err);
        }

        if (!userData) {
          // Fallback to local storage
          const saved = localStorage.getItem("meu_posto_logged_user");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && (parsed.email === firebaseUser.email || parsed.id === firebaseUser.uid)) {
                userData = parsed;
              }
            } catch (e) {
              console.warn("Erro ao ler usuário salvo no localStorage:", e);
            }
          }
        }

        if (!userData && firebaseUser.email) {
          // Fallback default user object for firebase user
          userData = {
            id: firebaseUser.uid,
            nomeCompleto: firebaseUser.displayName || firebaseUser.email.split("@")[0].toUpperCase() || "Usuário Google",
            email: firebaseUser.email,
            senhaCriptografada: "google_oauth_auth",
            cpf: "000.000.000-00",
            cargo: "Gerente",
            cnpjPosto: "12.345.678/0001-99",
            telefone: firebaseUser.phoneNumber || "(00) 00000-0000",
          };

          // Save Google-redirect fallback user into Firestore so they are registered permanently
          try {
            await setDoc(doc(db, "users", firebaseUser.uid), userData);
          } catch (saveErr) {
            console.error("Erro ao registrar usuário fallback do Google no Firestore:", saveErr);
          }
        }

        if (userData) {
          setCurrentUser(userData);
          localStorage.setItem("meu_posto_logged_user", JSON.stringify(userData));
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem("meu_posto_logged_user");
      }
    });
    return () => unsubscribe();
  }, []);

  const hasLoadedFromCloudRef = useRef<boolean>(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string>("");

  useEffect(() => {
    // Reset cloud load tracking whenever logged-in user or station changes
    hasLoadedFromCloudRef.current = false;
  }, [currentUser?.id, currentUser?.cnpjPosto]);

  // Sync Firestore AppState in real-time when currentUser is loaded
  useEffect(() => {
    if (!currentUser) return;
    const rawCnpj = currentUser.cnpjPosto || "12.345.678/0001-99";
    const cleanCnpj = rawCnpj.replace(/\D/g, "") || "12345678000199";
    
    setLoadingState(true);
    const docRef = doc(db, "postos", cleanCnpj);
    const userAppStateRef = doc(db, "users_appstate", currentUser.id);

    // Subscribe to real-time changes
    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        setLoadingState(false);
        if (docSnap.exists()) {
          // Avoid overwriting local edits if snapshot is generated by our own pending write
          if (!docSnap.metadata.hasPendingWrites) {
            const cloudData = docSnap.data() as AppState;
            const localUpdatedAt = appStateRef.current.updatedAt || 0;
            const cloudUpdatedAt = cloudData.updatedAt || 0;

            // On initial login on ANY device, OR if cloud has newer/equal data, force load from cloud database!
            if (!hasLoadedFromCloudRef.current || cloudUpdatedAt >= localUpdatedAt || !appStateRef.current.updatedAt) {
              hasLoadedFromCloudRef.current = true;
              setAppStateInternal(cloudData);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));

              const nowIso = new Date().toISOString();
              setSyncConfig((prev) => ({
                ...prev,
                lastCloudSyncDate: nowIso,
              }));

              const totalRecords = (cloudData.dailyBalances?.length || 0) + (cloudData.qualityAudits?.length || 0) + (cloudData.shifts?.length || 0) + (cloudData.transactions?.length || 0);
              setSyncToastMessage(`☁️ Dados do banco resgatados com sucesso neste dispositivo! (${totalRecords} registros recuperados)`);
              setTimeout(() => setSyncToastMessage(""), 6000);
            }
          }
        } else {
          // Check if user has a backup at users_appstate/{uid}
          try {
            const userSnap = await getDoc(userAppStateRef);
            if (userSnap.exists()) {
              const userCloudData = userSnap.data() as AppState;
              hasLoadedFromCloudRef.current = true;
              setAppStateInternal(userCloudData);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(userCloudData));
              await setDoc(docRef, userCloudData);

              setSyncToastMessage("☁️ Estado do usuário resgatado com sucesso da nuvem!");
              setTimeout(() => setSyncToastMessage(""), 6000);
            } else {
              // Create initial document in Firestore
              await setDoc(docRef, appStateRef.current);
              await setDoc(userAppStateRef, appStateRef.current);
              hasLoadedFromCloudRef.current = true;
              const nowIso = new Date().toISOString();
              setSyncConfig((prev) => ({
                ...prev,
                lastCloudSyncDate: nowIso,
                lastBackupDate: nowIso,
              }));
            }
          } catch (err) {
            console.error("Erro ao inicializar documento do posto no Firestore:", err);
          }
        }
      },
      (err) => {
        console.error("Erro na escuta em tempo real do Firestore:", err);
        setLoadingState(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.cnpjPosto]);

  // Auto-persist AppState to localStorage and debounced setDoc to Firestore
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    
    if (!currentUser) return;
    const rawCnpj = currentUser.cnpjPosto || "12.345.678/0001-99";
    const cleanCnpj = rawCnpj.replace(/\D/g, "") || "12345678000199";
    
    const saveToFirestore = async () => {
      try {
        const docRef = doc(db, "postos", cleanCnpj);
        const userAppStateRef = doc(db, "users_appstate", currentUser.id);

        console.log(`[Firestore Save Trigger] Gravando appState atualizado no Firestore (Posto: ${cleanCnpj}, User: ${currentUser.id}).`);
        await Promise.all([
          setDoc(docRef, appState),
          setDoc(userAppStateRef, appState)
        ]);
        console.log(`[Firestore Save Success] Gravação concluída com sucesso no Firestore.`);

        const nowIso = new Date().toISOString();
        setSyncConfig((prev) => ({
          ...prev,
          lastCloudSyncDate: nowIso,
          lastBackupDate: nowIso,
        }));
      } catch (err) {
        console.error("Erro ao salvar dados no Firestore:", err);
      }
    };

    const timer = setTimeout(() => {
      saveToFirestore();
    }, 300);

    return () => clearTimeout(timer);
  }, [appState, currentUser?.id, currentUser?.cnpjPosto]);

  // Auto-persist SyncConfig
  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(syncConfig));
  }, [syncConfig]);

  // Auto scheduled backup checker
  useEffect(() => {
    if (!syncConfig.scheduledBackupEnabled) return;

    const checkAndExecuteBackup = () => {
      const now = new Date();
      const last = syncConfig.lastBackupDate ? new Date(syncConfig.lastBackupDate) : null;
      let shouldRun = false;

      if (!last) {
        shouldRun = true;
      } else {
        const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
        const freq = syncConfig.backupFrequency || "daily";

        if (freq === "12h" && diffHours >= 12) shouldRun = true;
        else if (freq === "daily" && diffHours >= 24) shouldRun = true;
        else if (freq === "weekly" && diffHours >= 168) shouldRun = true;
      }

      if (shouldRun) {
        const dateStr = now.toISOString().split("T")[0];

        if (syncConfig.backupDestination === "download" || syncConfig.backupDestination === "both" || syncConfig.autoDownloadLocalJson) {
          try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 4));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `backup_agendado_posto_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          } catch (e) {
            console.error("Erro ao gerar download de backup agendado:", e);
          }
        }

        if (syncConfig.googleDriveBackupEnabled && syncConfig.googleDriveTokens) {
          fetch("/api/drive/upload-backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokens: syncConfig.googleDriveTokens,
              folderName: syncConfig.googleDriveFolderName || "Backups_MeuPosto",
              cnpj: currentUser?.cnpjPosto || "12.345.678/0001-99",
              backupData: appState,
            }),
          })
            .then((r) => r.json())
            .then((res) => {
              if (res.success) {
                console.log("[Auto-Backup] Backup enviado para o Google Drive:", res.webViewLink);
                setSyncConfig((prev) => ({
                  ...prev,
                  lastGoogleDriveBackupDate: new Date().toISOString(),
                  lastGoogleDriveFileLink: res.webViewLink,
                }));
              }
            })
            .catch((err) => console.error("Erro no backup automático para Google Drive:", err));
        }

        setSyncConfig((prev) => ({
          ...prev,
          lastBackupDate: now.toISOString(),
        }));
      }
    };

    checkAndExecuteBackup();
    const interval = setInterval(checkAndExecuteBackup, 1000 * 60 * 15);
    return () => clearInterval(interval);
  }, [syncConfig.scheduledBackupEnabled, syncConfig.backupFrequency, syncConfig.backupDestination, appState]);

  // Handle Logins
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("meu_posto_logged_user", JSON.stringify(user));
    // Reset to dashboard upon login
    setActiveTab("dashboard");
  };

  // Handle Logouts
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
    setCurrentUser(null);
    localStorage.removeItem("meu_posto_logged_user");
  };

  // Handle Registering a new User
  const handleRegisterUser = (newUser: User) => {
    const updatedUsers = [...appState.users, newUser];
    setAppState({
      ...appState,
      users: updatedUsers,
    });
  };

  // Custom State Modifiers
  const handleUpdateTanks = (tanks: typeof appState.tanks) => {
    setAppState((prev) => ({ ...prev, tanks }));
  };

  const handleUpdateNozzles = (nozzles: typeof appState.nozzles) => {
    setAppState((prev) => ({ ...prev, nozzles }));
  };

  const handleUpdateShifts = (shifts: typeof appState.shifts) => {
    setAppState((prev) => ({ ...prev, shifts }));
  };

  const handleUpdateTransactions = (transactions: typeof appState.transactions) => {
    setAppState((prev) => ({ ...prev, transactions }));
  };

  const handleUpdateClosings = (nozzleClosings: typeof appState.nozzleClosings) => {
    setAppState((prev) => ({ ...prev, nozzleClosings }));
  };

  const handleUpdateReconciliations = (reconciliations: typeof appState.reconciliations) => {
    setAppState((prev) => ({ ...prev, reconciliations }));
  };

  const handleUpdateCalibrations = (calibrations: typeof appState.calibrations) => {
    setAppState((prev) => ({ ...prev, calibrations }));
  };

  const handleUpdateQualityAudits = (qualityAudits: typeof appState.qualityAudits) => {
    setAppState((prev) => ({ ...prev, qualityAudits }));
  };

  const handleUpdateDeliveries = (deliveries: typeof appState.deliveries) => {
    setAppState((prev) => ({ ...prev, deliveries }));
  };

  const handleUpdateLmc = (lmc: typeof appState.lmc) => {
    setAppState((prev) => ({ ...prev, lmc }));
  };

  const handleUpdateCredentials = (systemCredentials: typeof appState.systemCredentials) => {
    setAppState((prev) => ({ ...prev, systemCredentials }));
  };

  const handleUpdateUsers = (users: typeof appState.users) => {
    setAppState((prev) => ({ ...prev, users }));
  };

  const handleUpdateCurrentUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("meu_posto_logged_user", JSON.stringify(updatedUser));

    setAppState((prev) => {
      const updatedUsers = (prev.users || []).map((u) => (u.id === updatedUser.id ? updatedUser : u));
      return { ...prev, users: updatedUsers };
    });
  };

  const handleUpdateAudits = (audits: typeof appState.audits) => {
    setAppState((prev) => ({ ...prev, audits }));
  };

  const handleUpdateShortages = (shortages: typeof appState.shortages) => {
    setAppState((prev) => ({ ...prev, shortages }));
  };

  const handleUpdatePreferences = (dashboardPreferences: typeof appState.dashboardPreferences) => {
    setAppState((prev) => ({ ...prev, dashboardPreferences }));
  };

  const handleUpdateLubricants = (lubricantDeliveries: typeof appState.lubricantDeliveries) => {
    setAppState((prev) => ({ ...prev, lubricantDeliveries }));
  };

  const handleUpdateBalances = (dailyBalances: typeof appState.dailyBalances) => {
    console.log("[DailyBalance Debug] handleUpdateBalances acionado com novos balanços:", dailyBalances);
    setAppState((prev) => {
      console.log("[DailyBalance Debug] Atualizando appState com total de registros:", dailyBalances.length);
      return { ...prev, dailyBalances };
    });
  };

  const handleUpdateSupplyRequests = (supplyRequests: typeof appState.supplyRequests) => {
    setAppState((prev) => ({ ...prev, supplyRequests }));
  };

  const handleUpdateTimesheetEntries = (timesheetEntries: typeof appState.timesheetEntries) => {
    setAppState((prev) => ({ ...prev, timesheetEntries }));
  };

  const handleUpdateSchedulePatterns = (schedulePatterns: typeof appState.schedulePatterns) => {
    setAppState((prev) => ({ ...prev, schedulePatterns }));
  };

  const handleUpdateStationDetails = (nomePosto: string, cnpjPosto: string, securePassword?: string) => {
    setAppState((prev) => {
      const oldCnpj = currentUser?.cnpjPosto || "12.345.678/0001-99";
      
      const updatedUsers = (prev.users || []).map((u) => {
        if (u.cnpjPosto === oldCnpj) {
          return { ...u, cnpjPosto };
        }
        return u;
      });

      if (currentUser && currentUser.cnpjPosto === oldCnpj) {
        const updatedCurrentUser = { ...currentUser, cnpjPosto };
        setCurrentUser(updatedCurrentUser);
        localStorage.setItem("meu_posto_logged_user", JSON.stringify(updatedCurrentUser));
      }

      const updatedShifts = (prev.shifts || []).map(s => s.stationCnpj === oldCnpj ? { ...s, stationCnpj: cnpjPosto } : s);
      const updatedLmc = (prev.lmc || []).map(r => r.stationCnpj === oldCnpj ? { ...r, stationCnpj: cnpjPosto } : r);
      const updatedAppointments = (prev.appointments || []).map(a => a.stationCnpj === oldCnpj ? { ...a, stationCnpj: cnpjPosto } : a);
      const updatedCredentials = (prev.systemCredentials || []).map(c => c.stationCnpj === oldCnpj ? { ...c, stationCnpj: cnpjPosto } : c);
      const updatedDeliveries = (prev.deliveries || []).map(d => d.stationCnpj === oldCnpj ? { ...d, stationCnpj: cnpjPosto } : d);
      const updatedAudits = (prev.audits || []).map(a => a.stationCnpj === oldCnpj ? { ...a, stationCnpj: cnpjPosto } : a);
      const updatedLubricants = (prev.lubricantDeliveries || []).map(d => d.stationCnpj === oldCnpj ? { ...d, stationCnpj: cnpjPosto } : d);
      const updatedBalances = (prev.dailyBalances || []).map(b => b.stationCnpj === oldCnpj ? { ...b, stationCnpj: cnpjPosto } : b);

      return {
        ...prev,
        nomePosto,
        securePassword: securePassword || prev.securePassword || "adm001",
        users: updatedUsers,
        shifts: updatedShifts,
        lmc: updatedLmc,
        appointments: updatedAppointments,
        systemCredentials: updatedCredentials,
        deliveries: updatedDeliveries,
        audits: updatedAudits,
        lubricantDeliveries: updatedLubricants,
        dailyBalances: updatedBalances
      };
    });
  };

  const handleUpdateReportCustomization = (customSettings: Partial<AppState>) => {
    setAppState((prev) => ({
      ...prev,
      ...customSettings,
    }));
  };

  const handleAddAuditLog = (actionType: string, target: string, details: string, status: string = "Regular") => {
    const newLog = {
      id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 100),
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("pt-BR"),
      actionType,
      target,
      details,
      operator: currentUser ? currentUser.nomeCompleto : "Sistema",
      complianceStatus: status,
      stationCnpj: currentUser ? currentUser.cnpjPosto : "12.345.678/0001-99",
    };
    setAppState((prev) => ({
      ...prev,
      audits: [newLog, ...(prev.audits || [])],
    }));
  };

  const handleRestoreState = (restoredState: AppState) => {
    // Safely map and fallback all state properties to empty arrays if missing from the backup JSON
    const cleanRestored: AppState = {
      users: Array.isArray(restoredState.users) ? restoredState.users : [],
      tanks: Array.isArray(restoredState.tanks) ? restoredState.tanks : [],
      nozzles: Array.isArray(restoredState.nozzles) ? restoredState.nozzles : [],
      shifts: Array.isArray(restoredState.shifts) ? restoredState.shifts : [],
      transactions: Array.isArray(restoredState.transactions) ? restoredState.transactions : [],
      nozzleClosings: Array.isArray(restoredState.nozzleClosings) ? restoredState.nozzleClosings : [],
      reconciliations: Array.isArray(restoredState.reconciliations) ? restoredState.reconciliations : [],
      calibrations: Array.isArray(restoredState.calibrations) ? restoredState.calibrations : [],
      qualityAudits: Array.isArray(restoredState.qualityAudits) ? restoredState.qualityAudits : [],
      lmc: Array.isArray(restoredState.lmc) ? restoredState.lmc : [],
      appointments: Array.isArray(restoredState.appointments) ? restoredState.appointments : [],
      systemCredentials: Array.isArray(restoredState.systemCredentials) ? restoredState.systemCredentials : [],
      deliveries: Array.isArray(restoredState.deliveries) ? restoredState.deliveries : [],
      audits: Array.isArray(restoredState.audits) ? restoredState.audits : [],
      shortages: Array.isArray(restoredState.shortages) ? restoredState.shortages : [],
      lubricantDeliveries: Array.isArray(restoredState.lubricantDeliveries) ? restoredState.lubricantDeliveries : [],
      dailyBalances: Array.isArray(restoredState.dailyBalances) ? restoredState.dailyBalances : [],
      supplyRequests: Array.isArray(restoredState.supplyRequests) ? restoredState.supplyRequests : [],
      timesheetEntries: Array.isArray(restoredState.timesheetEntries) ? restoredState.timesheetEntries : [],
      schedulePatterns: Array.isArray(restoredState.schedulePatterns) ? restoredState.schedulePatterns : [],
      dashboardPreferences: restoredState.dashboardPreferences || appState.dashboardPreferences,
      nomePosto: restoredState.nomePosto || appState.nomePosto,
      securePassword: restoredState.securePassword || appState.securePassword,
      reportHeaderLogo: restoredState.reportHeaderLogo || appState.reportHeaderLogo,
      reportHeaderCompanyName: restoredState.reportHeaderCompanyName || appState.reportHeaderCompanyName,
      reportHeaderCnpj: restoredState.reportHeaderCnpj || appState.reportHeaderCnpj,
      reportHeaderAddress: restoredState.reportHeaderAddress || appState.reportHeaderAddress,
      reportSignatureBase64: restoredState.reportSignatureBase64 || appState.reportSignatureBase64,
      reportSignatureName: restoredState.reportSignatureName || appState.reportSignatureName,
      reportSignatureRole: restoredState.reportSignatureRole || appState.reportSignatureRole,
      reportSignatureEnabled: restoredState.reportSignatureEnabled !== undefined ? restoredState.reportSignatureEnabled : appState.reportSignatureEnabled,
    };

    // Keep the current logged in user and existing users if restored state has no users
    const currentUsers = appState.users || [];
    if (cleanRestored.users.length === 0) {
      cleanRestored.users = currentUsers;
    }

    if (currentUser) {
      const exists = cleanRestored.users.some(u => u.id === currentUser.id);
      if (!exists) {
        cleanRestored.users.push(currentUser);
      }

      // If the backup belongs to a specific CNPJ, ensure the current user inherits it to synchronize correctly
      const targetCnpj = cleanRestored.reportHeaderCnpj || (cleanRestored as any).cnpjPosto || restoredState.reportHeaderCnpj || (restoredState as any).cnpjPosto;
      if (targetCnpj && currentUser.cnpjPosto !== targetCnpj) {
        console.log(`[Backup Restore] Alinhando CNPJ do usuário de ${currentUser.cnpjPosto} para ${targetCnpj}`);
        const updatedUser = { ...currentUser, cnpjPosto: targetCnpj };
        setCurrentUser(updatedUser);
        localStorage.setItem("meu_posto_logged_user", JSON.stringify(updatedUser));
        
        // Ensure user record in the array is also updated
        cleanRestored.users = cleanRestored.users.map(u => u.id === currentUser.id ? updatedUser : u);
      }
    }

    setAppState(cleanRestored);
  };

  // Render AuthScreen if no user is signed in
  if (!currentUser) {
    return (
      <AuthScreen
        existingUsers={appState.users}
        onLogin={handleLogin}
        onRegister={handleRegisterUser}
      />
    );
  }

  // Check role constraints: Frentistas can only view Dashboard, Caixa & Turnos checklists
  const isFrentista = currentUser.cargo === "Frentista";

  // Sidebar Menu Tabs Definitions with Permission guards grouped by section
  const navigationSections = [
    {
      title: "Visão Geral",
      items: [
        { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, frentistaAllowed: true },
        { id: "balanco", name: "Balanço Diário", icon: BarChart3, frentistaAllowed: false },
        { id: "dre", name: "DRE Mensal", icon: Calculator, frentistaAllowed: false },
      ],
    },
    {
      title: "Pista & Operação",
      items: [
        { id: "caixa", name: "Leitura de Bicos", icon: ClipboardList, frentistaAllowed: true },
        { id: "escalas", name: "Escala & Checklists", icon: ClipboardList, frentistaAllowed: true },
        { id: "ponto", name: "Folha de Ponto", icon: Fingerprint, frentistaAllowed: true },
        { id: "pedidos", name: "Pedidos de Material", icon: Package, frentistaAllowed: true },
        { id: "lubrificantes", name: "Recebimento Lubrif.", icon: Droplets, frentistaAllowed: true },
      ],
    },
    {
      title: "Estoque & Bombas",
      items: [
        { id: "tanques", name: "Controle de Tanques", icon: Fuel, frentistaAllowed: false },
        { id: "bicos", name: "Bicos & Bombas", icon: Activity, frentistaAllowed: false },
        { id: "faltas", name: "Faltas de Caixa", icon: AlertTriangle, frentistaAllowed: true },
      ],
    },
    {
      title: "ANP, Fiscal & ERP",
      items: [
        { id: "qualidade", name: "Qualidade ANP", icon: Thermometer, frentistaAllowed: false },
        { id: "lmc", name: "Livro LMC (ANP)", icon: BookOpen, frentistaAllowed: false },
        { id: "relatorios", name: "Relatórios & PDF", icon: FileText, frentistaAllowed: false },
        { id: "sincronizacao", name: "Sistemas & Cloud", icon: Cloud, frentistaAllowed: false },
        { id: "auditoria", name: "Auditoria ERP", icon: History, frentistaAllowed: false },
      ],
    },
  ];

  const navigationItems = navigationSections.flatMap((s) => s.items);

  return (
    <div className="min-h-screen bg-[#121417] flex text-slate-100 font-sans pb-16 lg:pb-0">
      
      {/* 1. SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#16191f] border-r border-slate-800/90 p-4 shrink-0 justify-between h-screen sticky top-0 shadow-2xl">
        <div className="space-y-4 overflow-y-auto pr-1">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-[#d4af37] flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Building2 className="h-5 w-5 text-slate-950" />
            </div>
            <div className="truncate min-w-0">
              <h1 className="font-black text-white tracking-tight text-base font-display truncate" title={appState.nomePosto || "Meu Posto"}>
                {appState.nomePosto || "Meu Posto"}
              </h1>
              <span className="text-[10px] text-amber-400 font-mono uppercase tracking-widest font-black block truncate">
                CORPORATE ERP ANP
              </span>
            </div>
          </div>

          {/* Nav Sections */}
          <nav className="space-y-4 pt-1">
            {navigationSections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 block">
                  {sec.title}
                </span>

                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const isAllowed = item.frentistaAllowed || !isFrentista;
                    const IconComponent = item.icon;

                    return (
                      <button
                        key={item.id}
                        disabled={!isAllowed}
                        onClick={() => {
                          setActiveTab(item.id);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition group relative cursor-pointer ${
                          activeTab === item.id
                            ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
                            : isAllowed
                            ? "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                            : "text-slate-600 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          <IconComponent className={`h-4 w-4 shrink-0 ${activeTab === item.id ? "text-slate-950" : "text-slate-400 group-hover:text-amber-400"}`} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        
                        {!isAllowed && (
                          <Lock className="h-3.5 w-3.5 text-slate-600 shrink-0 ml-1" title="Acesso Restrito a Gerentes/Master" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User Info bottom card */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2.5 bg-[#121417] p-2.5 rounded-2xl border border-slate-800">
            <UserAvatar user={currentUser} size="sm" />
            <div className="truncate min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser.nomeCompleto}</p>
              <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold inline-block">
                {currentUser.cargo}
              </span>
            </div>
          </div>

          {/* Auto-Sync status line inside desktop sidebar */}
          <div className="flex items-center justify-between text-[11px] px-2 text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className={`relative flex h-2 w-2`}>
                {syncConfig.autoSync ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                )}
              </span>
              Auto-Sync Cloud
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-amber-400 font-bold">{syncConfig.autoSync ? "Ativo" : "Pause"}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleInstallPWA}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 font-bold text-[11px] rounded-xl transition cursor-pointer"
              title="Instalar Web App PWA"
            >
              <Smartphone className="h-3.5 w-3.5" />
              PWA
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-rose-950/30 border border-rose-900/40 hover:bg-rose-900/40 text-rose-300 font-bold text-[11px] rounded-xl transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* 2. SIDEBAR MOBILE */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 lg:hidden flex">
          <div className="w-72 bg-[#0F172A] p-4 flex flex-col justify-between h-full border-r border-slate-800">
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#10B981]" />
                  <span className="font-bold text-white font-display truncate max-w-[150px]" title={appState.nomePosto || "Meu Posto"}>
                    {appState.nomePosto || "Meu Posto"}
                  </span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-4">
                {navigationSections.map((sec, secIdx) => (
                  <div key={secIdx} className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 block">
                      {sec.title}
                    </span>
                    <div className="space-y-0.5">
                      {sec.items.map((item) => {
                        const isAllowed = item.frentistaAllowed || !isFrentista;
                        const IconComponent = item.icon;

                        return (
                          <button
                            key={item.id}
                            disabled={!isAllowed}
                            onClick={() => {
                              setActiveTab(item.id);
                              setSidebarOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              activeTab === item.id
                                ? "bg-[#10B981] text-white"
                                : isAllowed
                                ? "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                                : "text-slate-600 cursor-not-allowed"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <IconComponent className="h-4 w-4" />
                              <span>{item.name}</span>
                            </div>
                            {!isAllowed && <Lock className="h-3.5 w-3.5 text-slate-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2 shrink-0">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2.5 text-xs">
                <UserAvatar user={currentUser} size="sm" />
                <div className="truncate min-w-0">
                  <p className="font-bold text-white truncate">{currentUser.nomeCompleto}</p>
                  <span className="text-[10px] text-emerald-400 font-semibold block">{currentUser.cargo}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={handleInstallPWA}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-bold text-xs rounded-xl cursor-pointer"
                >
                  <Smartphone className="h-4 w-4" />
                  PWA
                </button>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-rose-950/20 border border-rose-900/50 text-rose-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Toast Notificação de Sincronização em Nuvem por Login */}
        {syncToastMessage && (
          <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-300 max-w-md">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Cloud className="h-5 w-5" />
            </div>
            <div className="flex-1 text-xs font-semibold leading-tight">
              {syncToastMessage}
            </div>
            <button
              onClick={() => setSyncToastMessage("")}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {/* Top Header Principal */}
        <header className="bg-[#16191f] backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div>
              <h1 className="font-black text-white text-lg sm:text-2xl font-display tracking-tight leading-tight">
                {navigationItems.find((n) => n.id === activeTab)?.name}
              </h1>
              <p className="text-xs text-slate-400 font-medium hidden sm:block font-mono">
                CNPJ do Posto Ativo: <span className="font-mono text-amber-400 font-bold">{currentUser.cnpjPosto}</span> • Sistema Corporativo ANP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Continuous Online Sync Badge */}
            <button
              onClick={() => setActiveTab("sincronizacao")}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border transition flex items-center gap-2 cursor-pointer shadow-sm ${
                isOnline
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
              }`}
              title="Status da Sincronização Contínua em Tempo Real no Banco de Dados"
            >
              <span className="relative flex h-2 w-2">
                {isOnline ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
              {isOnline ? (
                <span className="flex items-center gap-1">
                  <Wifi className="h-3.5 w-3.5 text-emerald-400 hidden sm:inline" />
                  <span className="hidden md:inline">SINCRONIA NUVEM</span>
                  <span className="md:hidden">ONLINE</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <WifiOff className="h-3.5 w-3.5 text-rose-400 hidden sm:inline" />
                  <span>OFFLINE</span>
                </span>
              )}
            </button>

            {/* Offline Form Sync Pending Queue Button */}
            {pendingFormsCount > 0 && (
              <button
                onClick={() => {
                  triggerOfflineFormsSync().then(() => {
                    getPendingFormsCountSW().then((c) => setPendingFormsCount(c));
                  });
                }}
                className="px-3 py-1.5 rounded-full text-xs font-mono font-black border bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 transition flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
                title="Sincronizar formulários salvos offline no dispositivo"
              >
                <span>📦 {pendingFormsCount} FORM{pendingFormsCount > 1 ? "S" : ""} OFFLINE</span>
                {isOnline && <span className="text-[10px] underline ml-0.5">SINCRONIZAR</span>}
              </button>
            )}

            {/* Compartilhar Link Button */}
            <button
              onClick={() => {
                setCopiedShareLink(false);
                setIsShareModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-full transition cursor-pointer"
              title="Compartilhar link de acesso do posto"
            >
              <Share2 className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>

            {/* Guide/Onboarding Helper button */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-full transition cursor-pointer"
              title="Acessar o assistente de introdução"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <span className="hidden md:inline">Guia Inicial</span>
            </button>

            {/* Pill/Badge de Data Monospaçada */}
            <div className="bg-[#121417] border border-slate-800 px-3.5 py-1.5 rounded-full text-xs font-mono text-slate-200 font-bold flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>
                {new Date().toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                })}
              </span>
            </div>

            {/* Gerente Marcos Button in Header */}
            <button
              onClick={() => {
                const event = new CustomEvent("OPEN_GERENTE_MARCOS");
                window.dispatchEvent(event);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 border border-amber-500/40 font-black text-xs rounded-full transition shadow-xs cursor-pointer"
              title="Abrir Gerente Virtual Marcos"
            >
              <Bot className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Gerente Marcos</span>
            </button>

            {/* Limpar Dados Button in Top Header */}
            <button
              onClick={() => handleOpenGlobalClear()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-full transition cursor-pointer"
              title={`Limpar dados da aba ${navigationItems.find((n) => n.id === activeTab)?.name || "ativa"} ou do sistema`}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline">Limpar Dados</span>
            </button>

            <div className="bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-2">
              <UserAvatar user={currentUser} size="xs" />
              <span>{currentUser.cargo}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Section 3.A: Banner de Instalação PWA (Suave / Pastel Green) */}
          {showPwaBanner && (
            <div className="bg-[#E8F7EE] border border-[#00B880]/30 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#00B880] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-[#0F172A]">Aplicativo Web Meu Posto (PWA)</h4>
                  <p className="text-xs text-[#64748B] font-medium">Instale na sua tela inicial para acesso instantâneo, batimento de ponto e operação em campo.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstallPWA}
                  className="px-4 py-2 bg-[#00B880] hover:bg-[#05C480] text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  Instalar App
                </button>
                <button
                  onClick={() => setShowPwaBanner(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  title="Fechar aviso"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Main Router Logic */}
          {activeTab === "dashboard" && (
            <DashboardOverview 
              appState={appState} 
              onNavigate={setActiveTab} 
              onUpdatePreferences={handleUpdatePreferences}
            />
          )}

          {activeTab === "tanques" && (
            <TanksManagement
              appState={appState}
              userRole={currentUser.cargo}
              onUpdateTanks={handleUpdateTanks}
              onUpdateLmc={handleUpdateLmc}
              onClearData={() => handleOpenGlobalClear("tanques")}
            />
          )}

          {activeTab === "bicos" && (
            <NozzlesManagement
              appState={appState}
              userRole={currentUser.cargo}
              onUpdateNozzles={handleUpdateNozzles}
              onUpdateCalibrations={handleUpdateCalibrations}
              onAddAuditLog={handleAddAuditLog}
              onClearData={() => handleOpenGlobalClear("bicos")}
            />
          )}

          {activeTab === "escalas" && (
            <ShiftsChecklists
              appState={appState}
              userRole={currentUser.cargo}
              cnpjPosto={currentUser.cnpjPosto}
              onUpdateShifts={handleUpdateShifts}
              onUpdateUsers={handleUpdateUsers}
              onUpdateSchedulePatterns={handleUpdateSchedulePatterns}
              onAddAuditLog={handleAddAuditLog}
              onClearData={() => handleOpenGlobalClear("escalas")}
            />
          )}

          {activeTab === "caixa" && (
            <CashManagement
              appState={appState}
              userRole={currentUser.cargo}
              onUpdateTransactions={handleUpdateTransactions}
              onUpdateClosings={handleUpdateClosings}
              onUpdateReconciliations={handleUpdateReconciliations}
              onClearData={() => handleOpenGlobalClear("caixa")}
            />
          )}

          {activeTab === "balanco" && (
            <DailyBalance
              appState={appState}
              userRole={currentUser.cargo}
              cnpjPosto={currentUser.cnpjPosto}
              onUpdateBalances={handleUpdateBalances}
              onUpdateLmc={handleUpdateLmc}
              onAddAuditLog={handleAddAuditLog}
              onUpdateReportCustomization={handleUpdateReportCustomization}
              onClearData={() => handleOpenGlobalClear("balanco")}
            />
          )}

          {activeTab === "dre" && (
            <MonthlyDRE
              appState={appState}
              onNavigateToBalanco={() => setActiveTab("balanco")}
            />
          )}

          {activeTab === "faltas" && (
            <CashierShortage
              appState={appState}
              userRole={currentUser.cargo}
              onUpdateShortages={handleUpdateShortages}
              onAddAuditLog={handleAddAuditLog}
              onClearData={() => handleOpenGlobalClear("faltas")}
            />
          )}

          {activeTab === "lubrificantes" && (
            <LubricantDeliveries
              appState={appState}
              userRole={currentUser.cargo}
              onUpdateLubricants={handleUpdateLubricants}
              onAddAuditLog={handleAddAuditLog}
              onClearData={() => handleOpenGlobalClear("lubrificantes")}
            />
          )}

          {activeTab === "qualidade" && (
            <ANPQualityControl
              appState={appState}
              userRole={currentUser.cargo}
              cnpjPosto={currentUser.cnpjPosto}
              onUpdateCalibrations={handleUpdateCalibrations}
              onUpdateQualityAudits={handleUpdateQualityAudits}
              onUpdateDeliveries={handleUpdateDeliveries}
              onAddAuditLog={handleAddAuditLog}
              onUpdateShifts={handleUpdateShifts}
              onUpdateTanks={handleUpdateTanks}
              onUpdateReportCustomization={handleUpdateReportCustomization}
              onClearData={() => handleOpenGlobalClear("qualidade")}
            />
          )}

          {activeTab === "lmc" && (
            <LMCManagement
              appState={appState}
              userRole={currentUser.cargo}
              cnpjPosto={currentUser.cnpjPosto}
              onUpdateLmc={handleUpdateLmc}
              onAddAuditLog={handleAddAuditLog}
              onUpdateReportCustomization={handleUpdateReportCustomization}
              onClearData={() => handleOpenGlobalClear("lmc")}
            />
          )}

          {activeTab === "relatorios" && (
            <ReportsAdvanced
              appState={appState}
              onUpdateReportCustomization={handleUpdateReportCustomization}
            />
          )}

          {activeTab === "sincronizacao" && (
            <CloudSyncPanel
              cnpjPosto={currentUser.cnpjPosto}
              currentUser={currentUser}
              appState={appState}
              syncConfig={syncConfig}
              onUpdateConfig={setSyncConfig}
              onRestoreState={handleRestoreState}
              onUpdateCredentials={handleUpdateCredentials}
              onUpdateUsers={handleUpdateUsers}
              onUpdateCurrentUser={handleUpdateCurrentUser}
              onAddAuditLog={handleAddAuditLog}
              onUpdateStationDetails={handleUpdateStationDetails}
              onUpdateReportCustomization={handleUpdateReportCustomization}
            />
          )}

          {activeTab === "pedidos" && (
            <SupplyRequests
              appState={appState}
              userRole={currentUser.cargo}
              currentUser={currentUser}
              onUpdateSupplyRequests={handleUpdateSupplyRequests}
              onAddAuditLog={handleAddAuditLog}
              onClearData={() => handleOpenGlobalClear("pedidos")}
            />
          )}

          {activeTab === "ponto" && (
            <TimesheetManagement
              appState={appState}
              userRole={currentUser.cargo}
              currentUser={currentUser}
              onUpdateTimesheetEntries={handleUpdateTimesheetEntries}
              onAddAuditLog={handleAddAuditLog}
              onClearData={() => handleOpenGlobalClear("ponto")}
            />
          )}

          {activeTab === "auditoria" && (
            <AuditorLog
              appState={appState}
              cnpjPosto={currentUser.cnpjPosto}
              onUpdateAudits={handleUpdateAudits}
              onClearData={() => handleOpenGlobalClear("auditoria")}
            />
          )}

        </main>
      </div>

      {/* Section 3.E: Floating Action Button (FAB) */}
      <button
        onClick={() => setActiveTab("ponto")}
        className="fixed bottom-20 right-5 sm:bottom-6 sm:right-6 z-40 w-14 h-14 rounded-full bg-[#00B880] hover:bg-[#05C480] text-white shadow-xl shadow-[#00B880]/30 flex items-center justify-center cursor-pointer transition transform hover:scale-105 active:scale-95 border-2 border-white/20 group"
        title="Bater Ponto / Registro Rápido"
      >
        <Heart className="h-6 w-6 text-white group-hover:scale-110 transition-transform fill-white/20" />
      </button>

      {/* Section 3.E: Barra de Navegação Fixa Inferior (Bottom Bar) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#16191f] border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl lg:hidden backdrop-blur-md">
        {[
          { id: "dashboard", name: "Início", icon: LayoutDashboard },
          { id: "caixa", name: "Operação", icon: ClipboardList },
          { id: "escalas", name: "Equipe", icon: Users },
          { id: "relatorios", name: "Relatórios", icon: FileText },
          { id: "more_menu", name: "Mais", icon: Menu },
        ].map((tab) => {
          const isActive = tab.id === "more_menu" ? sidebarOpen : activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "more_menu") {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`transition cursor-pointer flex flex-col items-center gap-0.5 ${
                isActive
                  ? "text-amber-400 font-extrabold text-xs"
                  : "text-slate-400 hover:text-white text-[10px] font-medium"
              }`}
            >
              <div className={`p-1 rounded-xl transition ${isActive ? "bg-amber-400/10 text-amber-400 border border-amber-400/30" : ""}`}>
                <TabIcon className="h-4 w-4 shrink-0" />
              </div>
              <span className="text-[10px]">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* 3.F MODAL COMPARTILHAR LINK DO POSTO */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Compartilhar Acesso do Posto</h3>
                  <p className="text-xs text-slate-500 font-medium">Link para funcionários e gerentes</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Posto Ativo</span>
                <p className="text-sm font-black text-slate-800">{appState.nomePosto || "Meu Posto"}</p>
                <p className="text-xs text-slate-500 font-mono">CNPJ: {currentUser.cnpjPosto}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Link Direto da Aplicação
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.href}
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setCopiedShareLink(true);
                      setTimeout(() => setCopiedShareLink(false), 2500);
                      handleAddAuditLog("SHARE", "Sistema", "Copiou link de compartilhamento do posto", "Regular");
                    }}
                    className="px-4 py-2 bg-[#00B880] hover:bg-[#05C480] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedShareLink ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    const text = `Acesse o sistema do ${appState.nomePosto || "Posto"} (CNPJ: ${currentUser.cnpjPosto}):\n${window.location.href}`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                    window.open(whatsappUrl, "_blank");
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Share2 className="h-4 w-4" /> Compartilhar via WhatsApp
                </button>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ONBOARDING WELCOME WIZARD MODAL */}
      {showOnboarding && currentUser && (
        <WelcomeOnboarding
          currentUser={currentUser}
          appState={appState}
          onUpdateStationDetails={handleUpdateStationDetails}
          onAddAuditLog={handleAddAuditLog}
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {/* 5. GLOBAL CLEAR DATA MODAL */}
      {isGlobalClearModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Limpar Dados do Sistema
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Aba Ativa: <span className="font-bold text-slate-800">{navigationItems.find((n) => n.id === activeTab)?.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGlobalClearModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-3 flex items-start gap-2.5 text-amber-800 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Atenção: Ações de limpeza são definitivas!</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Selecione quais módulos você deseja apagar. As alterações serão sincronizadas automaticamente.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
              <div className="flex items-center justify-between pb-1">
                <span className="font-black text-slate-700 uppercase tracking-wider text-[10px]">Módulos Selecionados</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalClearOptions({
                        tanks: true, nozzles: true, shifts: true, transactions: true,
                        dailyBalances: true, shortages: true, lubricants: true, qualityAudits: true,
                        lmc: true, supplyRequests: true, timesheetEntries: true, audits: true
                      });
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Marcar Todos
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalClearOptions({
                        tanks: false, nozzles: false, shifts: false, transactions: false,
                        dailyBalances: false, shortages: false, lubricants: false, qualityAudits: false,
                        lmc: false, supplyRequests: false, timesheetEntries: false, audits: false
                      });
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              </div>

              {[
                { key: "tanks", label: "Tanques & Medições de Combustível" },
                { key: "nozzles", label: "Bicos, Bombas, Encerantes e Aferições" },
                { key: "shifts", label: "Escalas de Trabalho e Plantões do Posto" },
                { key: "transactions", label: "Fechamento de Caixa, Vendas e Conciliação" },
                { key: "dailyBalances", label: "Balanços Financeiros e Volumétricos Diários" },
                { key: "lmc", label: "Registros e Livro de Movimentação (LMC)" },
                { key: "shortages", label: "Ocorrências e Faltas de Caixa" },
                { key: "lubricants", label: "Entregas e Estoque de Lubrificantes" },
                { key: "qualityAudits", label: "Testes de Qualidade ANP e Amostras" },
                { key: "supplyRequests", label: "Pedidos e Solicitante de Suprimentos" },
                { key: "timesheetEntries", label: "Registros de Ponto Eletrônico dos Frentistas" },
                { key: "audits", label: "Histórico de Logs da Auditoria ERP" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(globalClearOptions as any)[item.key]}
                    onChange={(e) => setGlobalClearOptions(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsGlobalClearModalOpen(false)}
                className="flex-1 py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmGlobalClear}
                disabled={!Object.values(globalClearOptions).some(Boolean)}
                className={`flex-1 py-2.5 px-4 text-white font-bold text-xs rounded-xl transition cursor-pointer ${
                  !Object.values(globalClearOptions).some(Boolean)
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-900/20"
                }`}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. PWA INSTALLATION MODAL & GUIDANCE */}
      <PWAModal
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstall={handleInstallPWA}
      />

      {/* 7. GERENTE VIRTUAL DO POSTO (BONECO ANIMADO PELE ESCURA - MARCOS) */}
      <AnimatedStationManager
        appState={appState}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}
