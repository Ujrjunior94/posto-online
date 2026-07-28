import React, { useState, useEffect } from "react";
import { Smartphone, Download, Share2, CheckCircle2, X, Globe, Monitor, Apple, ShieldCheck, Zap } from "lucide-react";

interface PWAModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstall: () => void;
}

export default function PWAModal({ isOpen, onClose, deferredPrompt, onInstall }: PWAModalProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [activeTab, setActiveTab] = useState<"android" | "ios" | "desktop">("android");

  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone ||
      document.referrer.includes("android-app://");
    setIsStandalone(isStandaloneMode);

    // Detect OS for default tab
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setActiveTab("ios");
    } else if (/android/i.test(userAgent)) {
      setActiveTab("android");
    } else {
      setActiveTab("desktop");
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-slate-200 shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#0F172A] text-white p-6 relative overflow-hidden shrink-0">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#10B981]/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#10B981] flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 shrink-0">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white font-display leading-tight">
                  Instalar Web App (PWA)
                </h3>
                <p className="text-xs text-emerald-400 font-semibold">
                  Meu Posto - Gestão Inteligente
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Status Badge */}
          {isStandalone ? (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-extrabold">Aplicativo já instalado!</p>
                <p className="text-[11px] text-emerald-700">Você está utilizando o Meu Posto no modo PWA Standalone em tela cheia.</p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-700">
              <Zap className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <p className="font-extrabold text-slate-800">Acesso Rápido & Funcionalidade Offline</p>
                <p className="text-[11px] text-slate-500">Instale no celular ou PC para abrir sem navegador e usar offline no posto.</p>
              </div>
            </div>
          )}

          {/* Prompt Direct Install Button if available */}
          {deferredPrompt && !isStandalone && (
            <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-900/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm">Instalação Automática Disponível</h4>
                  <p className="text-xs text-emerald-100">Seu navegador suporta instalação com 1 clique.</p>
                </div>
                <button
                  onClick={onInstall}
                  className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Download className="h-4 w-4 text-emerald-600" />
                  Instalar Agora
                </button>
              </div>
            </div>
          )}

          {/* Tabs Platform instructions */}
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Instruções de Instalação Manual por Dispositivo
            </label>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab("android")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === "android"
                    ? "bg-white text-slate-800 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                <span>Android</span>
              </button>

              <button
                onClick={() => setActiveTab("ios")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === "ios"
                    ? "bg-white text-slate-800 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Apple className="h-3.5 w-3.5 text-slate-800" />
                <span>iPhone / iOS</span>
              </button>

              <button
                onClick={() => setActiveTab("desktop")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === "desktop"
                    ? "bg-white text-slate-800 shadow-2xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Monitor className="h-3.5 w-3.5 text-blue-600" />
                <span>Computador</span>
              </button>
            </div>

            {/* Instruction content based on active tab */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 text-xs text-slate-700 space-y-3">
              {activeTab === "android" && (
                <ol className="space-y-2.5 list-decimal list-inside font-medium">
                  <li>
                    Abra o navegador <strong>Google Chrome</strong> no seu celular Android.
                  </li>
                  <li>
                    Toque no menu de três pontos <strong className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">⋮</strong> no canto superior direito.
                  </li>
                  <li>
                    Selecione a opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </li>
                  <li>
                    Confirme em <strong>"Instalar"</strong>. O ícone do <strong>Meu Posto</strong> surgirá na tela do seu telefone.
                  </li>
                </ol>
              )}

              {activeTab === "ios" && (
                <ol className="space-y-2.5 list-decimal list-inside font-medium">
                  <li>
                    Abra esta página usando o navegador nativo <strong>Safari</strong> do seu iPhone/iPad.
                  </li>
                  <li>
                    Toque no botão de <strong>Compartilhar</strong> <Share2 className="h-3.5 w-3.5 inline text-blue-600" /> no menu inferior.
                  </li>
                  <li>
                    Role para baixo no menu e toque em <strong>"Adicionar à Tela de Início"</strong>.
                  </li>
                  <li>
                    Toque em <strong>"Adicionar"</strong> no canto superior direito para concluir.
                  </li>
                </ol>
              )}

              {activeTab === "desktop" && (
                <ol className="space-y-2.5 list-decimal list-inside font-medium">
                  <li>
                    Utilize o <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong> no seu PC.
                  </li>
                  <li>
                    Procure o ícone de instalação <Download className="h-3.5 w-3.5 inline text-emerald-600" /> no lado direito da barra de endereço URL.
                  </li>
                  <li>
                    Caso não veja o ícone, clique no menu de três pontos <strong className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">⋮</strong> e escolha <strong>"Salvar e Compartilhar" &gt; "Instalar Meu Posto..."</strong>.
                  </li>
                </ol>
              )}
            </div>
          </div>

          {/* Benefícios PWA */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 bg-slate-100/70 rounded-xl flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-700">Modo Standalone Sem Barras</span>
            </div>
            <div className="p-2.5 bg-slate-100/70 rounded-xl flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-700">Cache Offline Inteligente</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
