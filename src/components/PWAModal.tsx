import React, { useState, useEffect } from "react";
import { 
  Smartphone, Download, Share2, CheckCircle2, X, Globe, Monitor, Apple, 
  ShieldCheck, Zap, QrCode, RefreshCw, Copy, Check, Info, Cpu, HardDrive, Wifi, WifiOff 
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PWAModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstall: () => void;
}

export default function PWAModal({ isOpen, onClose, deferredPrompt, onInstall }: PWAModalProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [activeTab, setActiveTab] = useState<"install" | "guide" | "benefits" | "diagnostics">("install");
  const [guidePlatform, setGuidePlatform] = useState<"android" | "ios" | "desktop">("android");
  
  // PWA Diagnostic state
  const [swStatus, setSwStatus] = useState<"active" | "installing" | "unregistered" | "unsupported">("unregistered");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheSizeInfo, setCacheSizeInfo] = useState<string>("Calculando...");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUpdatingCache, setIsUpdatingCache] = useState(false);

  const currentAppUrl = typeof window !== "undefined" ? window.location.href : "https://meuposto.app";

  useEffect(() => {
    // Check if running as standalone PWA
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone ||
      document.referrer.includes("android-app://");
    setIsStandalone(isStandaloneMode);

    // Detect OS for default platform guide
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setGuidePlatform("ios");
    } else if (/android/i.test(userAgent)) {
      setGuidePlatform("android");
    } else {
      setGuidePlatform("desktop");
    }

    // Check Service Worker status
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          if (reg.active) setSwStatus("active");
          else if (reg.installing || reg.waiting) setSwStatus("installing");
        } else {
          setSwStatus("unregistered");
        }
      }).catch(() => setSwStatus("unregistered"));
    } else {
      setSwStatus("unsupported");
    }

    // Calculate Cache Storage size
    if ("storage" in navigator && "estimate" in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        if (usage !== undefined) {
          const mb = (usage / (1024 * 1024)).toFixed(1);
          setCacheSizeInfo(`${mb} MB em cache local`);
        }
      }).catch(() => setCacheSizeInfo("Disponível"));
    } else {
      setCacheSizeInfo("Ativo (Offline)");
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentAppUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleForceUpdatePwaCache = async () => {
    setIsUpdatingCache(true);
    try {
      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error("Erro ao atualizar cache PWA:", err);
      setIsUpdatingCache(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden border border-slate-200 shadow-2xl relative flex flex-col max-h-[92vh]">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-500/15 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50 shrink-0 border border-emerald-300/30">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-white font-display leading-tight">
                    Instalador Web App (PWA)
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    v2.0
                  </span>
                </div>
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                  Meu Posto Infinity - Operação Mobile & Desktop
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Main Navigation Tabs */}
          <div className="flex gap-1 mt-4 p-1 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/60 text-xs font-bold relative z-10 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("install")}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === "install"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Instalação</span>
            </button>

            <button
              onClick={() => setActiveTab("guide")}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === "guide"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Guia Manual</span>
            </button>

            <button
              onClick={() => setActiveTab("benefits")}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === "benefits"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Vantagens</span>
            </button>

            <button
              onClick={() => setActiveTab("diagnostics")}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === "diagnostics"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Diagnóstico</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-slate-800">

          {/* Status Badge */}
          {isStandalone ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 shadow-xs">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-xs">
                <p className="font-extrabold text-emerald-950">Aplicativo Instalado e Ativo!</p>
                <p className="text-[11px] text-emerald-800 font-medium">
                  Você está executando o <strong>Meu Posto Infinity</strong> no modo PWA Standalone (Tela Cheia sem barras).
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-amber-900 shadow-xs">
              <div className="flex items-center gap-3 text-xs">
                <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-extrabold text-amber-950">Navegador Web Detectado</p>
                  <p className="text-[11px] text-amber-800 font-medium">Instale no seu celular ou computador para habilitar o modo PWA nativo.</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-1 rounded-lg shrink-0">
                Pronto para Instalar
              </span>
            </div>
          )}

          {/* TAB 1: INSTALLATION & QR CODE */}
          {activeTab === "install" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Direct Installation Action Box (If browser prompt is available) */}
              {deferredPrompt && !isStandalone ? (
                <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        Instalação Direta com 1-Clique
                      </h4>
                      <p className="text-xs text-emerald-100 font-medium mt-0.5">
                        Seu navegador é 100% compatível com a instalação automática.
                      </p>
                    </div>
                    <button
                      onClick={onInstall}
                      className="px-5 py-3 bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0 active:scale-95"
                    >
                      <Download className="h-4 w-4 text-emerald-600 animate-bounce" />
                      Instalar Agora
                    </button>
                  </div>
                </div>
              ) : null}

              {/* QR Code Section for Mobile Scanning */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-emerald-600" />
                      Instalar no Celular via QR Code
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Abra a câmera do seu smartphone e aponte para o código abaixo para abrir e instalar o aplicativo no celular.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    title="Copiar Link"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-extrabold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-xs shrink-0">
                    <QRCodeSVG 
                      value={currentAppUrl}
                      size={120}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 text-center sm:text-left">
                    <p className="font-bold text-slate-900">
                      Como funciona no Celular:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                      <li>Aponte a câmera do seu smartphone para o QR Code.</li>
                      <li>Toque no link que aparece na tela do celular.</li>
                      <li>No navegador do celular, clique em <strong>"Instalar App"</strong> ou <strong>"Adicionar à Tela Inicial"</strong>.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Offline Capability Box */}
              <div className="p-3.5 bg-slate-900 text-slate-200 rounded-2xl flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>Proteção Offline Inteligente: Todos os checklists e LMC são salvos localmente mesmo sem internet no posto.</span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MANUAL STEP BY STEP GUIDES */}
          {activeTab === "guide" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setGuidePlatform("android")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    guidePlatform === "android"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Android</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGuidePlatform("ios")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    guidePlatform === "ios"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Apple className="h-3.5 w-3.5 text-slate-900" />
                  <span>iPhone / iOS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGuidePlatform("desktop")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    guidePlatform === "desktop"
                      ? "bg-white text-slate-900 shadow-xs font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5 text-blue-600" />
                  <span>Computador</span>
                </button>
              </div>

              {/* Instructions Container */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-3">
                
                {guidePlatform === "android" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                      <Smartphone className="h-4 w-4 text-emerald-600" />
                      Instalação no Android (Google Chrome / Samsung Internet)
                    </div>
                    <ol className="space-y-2.5 list-decimal list-inside font-medium text-slate-700 leading-relaxed">
                      <li>
                        Abra o navegador <strong>Google Chrome</strong> no seu celular Android.
                      </li>
                      <li>
                        Toque no menu de três pontos <strong className="bg-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-800">⋮</strong> no canto superior direito.
                      </li>
                      <li>
                        Selecione a opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                      </li>
                      <li>
                        Confirme em <strong>"Instalar"</strong>. O ícone oficial do <strong>Meu Posto Infinity</strong> surgirá na gaveta de aplicativos.
                      </li>
                    </ol>
                  </div>
                )}

                {guidePlatform === "ios" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                      <Apple className="h-4 w-4 text-slate-900" />
                      Instalação no iPhone / iPad (Safari iOS)
                    </div>
                    <ol className="space-y-2.5 list-decimal list-inside font-medium text-slate-700 leading-relaxed">
                      <li>
                        Abra esta página obrigatoriamente no navegador nativo <strong>Safari</strong> do seu iPhone/iPad.
                      </li>
                      <li>
                        Toque no botão de <strong>Compartilhar</strong> <Share2 className="h-4 w-4 inline text-blue-600 bg-blue-50 p-0.5 rounded" /> na barra inferior do Safari.
                      </li>
                      <li>
                        Role a lista para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                      </li>
                      <li>
                        Toque em <strong>"Adicionar"</strong> no canto superior direito. O aplicativo ficará pronto para uso em tela cheia!
                      </li>
                    </ol>
                  </div>
                )}

                {guidePlatform === "desktop" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                      <Monitor className="h-4 w-4 text-blue-600" />
                      Instalação no Computador (Windows / Mac / Linux)
                    </div>
                    <ol className="space-y-2.5 list-decimal list-inside font-medium text-slate-700 leading-relaxed">
                      <li>
                        Acesse a plataforma pelo <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>.
                      </li>
                      <li>
                        Observe o ícone de instalação <Download className="h-3.5 w-3.5 inline text-emerald-600" /> do lado direito da barra de endereço URL.
                      </li>
                      <li>
                        Se preferir, clique no menu <strong className="bg-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-800">⋮</strong> &gt; <strong>"Salvar e Compartilhar" &gt; "Instalar Meu Posto..."</strong>.
                      </li>
                      <li>
                        O aplicativo abrirá em uma janela nativa independente sem barras de navegação.
                      </li>
                    </ol>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 3: ADVANTAGES & FEATURES */}
          {activeTab === "benefits" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200">
              
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Smartphone className="h-4 w-4" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-900">100% Tela Cheia Standalone</h5>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Navegação limpa sem barra de endereços do navegador, parecendo um app nativo baixado na Play Store ou App Store.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Globe className="h-4 w-4" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-900">Operação Offline Garantida</h5>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Continue batendo folha de ponto, preenchendo checklists da pista e lançando LMC mesmo com instabilidades de sinal de internet.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Zap className="h-4 w-4" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-900">Carregamento Ultra Rápido</h5>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Arquivos estáticos pré-carregados na memória (Cache Service Worker), economizando dados e bateria na operação diária.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="h-8 w-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h5 className="font-extrabold text-xs text-slate-900">Sincronização em Background</h5>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Quando a conexão retorna, os dados em fila são enviados automaticamente para a nuvem sem perdas.
                </p>
              </div>

            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & PWA CACHE */}
          {activeTab === "diagnostics" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-extrabold text-white flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-400" />
                    Diagnóstico Técnico do PWA
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    System Health
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="p-2.5 bg-slate-800/80 rounded-xl space-y-0.5 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Conexão de Rede:</span>
                    <span className={`font-extrabold flex items-center gap-1.5 ${isOnline ? "text-emerald-400" : "text-rose-400"}`}>
                      {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                      {isOnline ? "Online (Conectado)" : "Offline (Rede Local)"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-xl space-y-0.5 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Service Worker:</span>
                    <span className={`font-extrabold flex items-center gap-1.5 ${
                      swStatus === "active" ? "text-emerald-400" : "text-amber-400"
                    }`}>
                      <HardDrive className="h-3.5 w-3.5" />
                      {swStatus === "active" ? "Ativo (v2.0)" : "Pendente / Não Registrado"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-xl space-y-0.5 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Modo de Exibição:</span>
                    <span className="font-extrabold text-white flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5 text-blue-400" />
                      {isStandalone ? "Standalone (App)" : "Browser Web"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-800/80 rounded-xl space-y-0.5 border border-slate-700/50">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Armazenamento Cache:</span>
                    <span className="font-extrabold text-emerald-300">
                      {cacheSizeInfo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Force Update Cache Action */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <h5 className="font-extrabold text-xs text-slate-900">Atualizar Cache e Service Worker</h5>
                  <p className="text-[11px] text-slate-500 font-medium">Limpe a memória local se houver uma nova versão disponível da plataforma.</p>
                </div>
                <button
                  type="button"
                  disabled={isUpdatingCache}
                  onClick={handleForceUpdatePwaCache}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isUpdatingCache ? "animate-spin" : ""}`} />
                  <span>{isUpdatingCache ? "Atualizando..." : "Recarregar Cache"}</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>Meu Posto Infinity PWA • Suporte nativo Android, iOS, Windows & Mac</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
