import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppState } from "../types";
import {
  MessageSquare,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Fuel,
  Send,
  UserCheck,
  Minimize2,
  Maximize2,
  Bot,
  Lightbulb,
  ShieldCheck,
  Play,
  Square,
  ChevronRight,
  Smile,
  Info
} from "lucide-react";

interface AnimatedStationManagerProps {
  appState: AppState;
  onNavigateTab?: (tab: string) => void;
}

export const AnimatedStationManager: React.FC<AnimatedStationManagerProps> = ({
  appState,
  onNavigateTab,
}) => {
  // Widget Visibility & Display Mode
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"tips" | "chat" | "status">("tips");

  // Character Expression State
  const [expression, setExpression] = useState<"happy" | "speaking" | "alert" | "thinking">("happy");
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWaving, setIsWaving] = useState(false);

  // Speech / Audio State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSpeechText, setCurrentSpeechText] = useState("");

  // Chat State
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "manager"; text: string; timestamp: string }>
  >([
    {
      sender: "manager",
      text: "Olá! Sou o Marcos, seu Gerente Virtual do posto! Como posso ajudar na gestão da sua pista e caixa hoje?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");

  // Speech Synthesis Ref
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Event Listener for external open triggers
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setExpression("happy");
      setIsWaving(true);
      setTimeout(() => setIsWaving(false), 2000);
    };

    window.addEventListener("OPEN_GERENTE_MARCOS", handleOpen);
    return () => window.removeEventListener("OPEN_GERENTE_MARCOS", handleOpen);
  }, []);
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Waving gesture trigger periodically
  useEffect(() => {
    const waveInterval = setInterval(() => {
      if (!isSpeaking) {
        setIsWaving(true);
        setTimeout(() => setIsWaving(false), 2000);
      }
    }, 12000);
    return () => clearInterval(waveInterval);
  }, [isSpeaking]);

  // Contextual Insights Calculation from AppState
  const getStationInsights = () => {
    const insights = [];

    // 1. Tank levels
    const tanks = appState.tanks || [];
    const lowTanks = tanks.filter(
      (t) => (t.volumeAtual / t.capacidade) * 100 < 25
    );
    if (lowTanks.length > 0) {
      insights.push({
        type: "alert",
        title: "Atenção nos Tanques!",
        message: `${lowTanks.length} tanque(s) com nível abaixo de 25%: ${lowTanks
          .map((t) => t.nome)
          .join(", ")}. Programe um pedido de combustível.`,
        actionTab: "tanks",
        actionText: "Ver Tanques",
      });
    }

    // 2. Cashier shortages
    const shortages = appState.shortages || [];
    const pendingShortages = shortages.filter((s) => s.status === "pendente");
    if (pendingShortages.length > 0) {
      insights.push({
        type: "warning",
        title: "Quebras de Caixa Pendentes",
        message: `Existem ${pendingShortages.length} ocorrência(s) de quebra de caixa aguardando acerto ou justificativa.`,
        actionTab: "shortage",
        actionText: "Analisar Caixa",
      });
    }

    // 3. ANP Quality Tests
    const audits = appState.qualityAudits || [];
    const todayStr = new Date().toISOString().split("T")[0];
    const todayAudits = audits.filter((a) => a.data === todayStr);
    if (todayAudits.length === 0) {
      insights.push({
        type: "info",
        title: "Controle de Qualidade ANP",
        message:
          "Lembrete do Gerente: Ainda não consta registro do Teste de Proveta/Densidade de hoje. Mantenha seu posto 100% regularizado!",
        actionTab: "anp",
        actionText: "Registrar Teste",
      });
    } else {
      insights.push({
        type: "success",
        title: "Teste ANP em Dia!",
        message: `Ótimo trabalho! Foram realizados ${todayAudits.length} testes de qualidade hoje. Posto conforme com as normas da ANP.`,
        actionTab: "anp",
        actionText: "Ver Relatório ANP",
      });
    }

    // 4. Daily Revenue Performance
    const balances = appState.dailyBalances || [];
    const todayBalance = balances.find((b) => b.data === todayStr);
    if (todayBalance) {
      const totalVendas =
        (todayBalance.vendaCombustivel || 0) +
        (todayBalance.vendaLubrificantes || 0) +
        (todayBalance.outrasReceitas || 0);
      insights.push({
        type: "success",
        title: "Desempenho de Vendas do Dia",
        message: `Vendas totais hoje: R$ ${totalVendas.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}. Lucro líquido estimado em R$ ${todayBalance.saldoFinal.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}.`,
        actionTab: "daily-balance",
        actionText: "Ver Fechamento",
      });
    } else {
      insights.push({
        type: "tip",
        title: "Dica do Marcos",
        message:
          "Inicie o fechamento diário do caixa para acompanhar as margens de lucro e comparar com o movimento dos turnos anteriores.",
        actionTab: "daily-balance",
        actionText: "Abrir Fechamento",
      });
    }

    return insights;
  };

  const insights = getStationInsights();
  const alertCount = insights.filter((i) => i.type === "alert" || i.type === "warning").length;

  // Speak function
  const speakText = (text: string) => {
    if (isMuted || !synthRef.current) return;

    // Stop current speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 0.95; // Friendly masculine warm tone

    // Attempt to pick a male pt-BR voice if available
    const voices = synthRef.current.getVoices();
    const ptVoice = voices.find(
      (v) => v.lang.includes("pt") && (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("ricardo") || v.name.toLowerCase().includes("daniel"))
    ) || voices.find((v) => v.lang.includes("pt"));

    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setExpression("speaking");
      setCurrentSpeechText(text);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setExpression("happy");
      setCurrentSpeechText("");
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setExpression("happy");
      setCurrentSpeechText("");
    };

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setExpression("happy");
      setCurrentSpeechText("");
    }
  };

  // Handle User Chat
  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim()) return;

    const userMsg = {
      sender: "user" as const,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");

    setExpression("thinking");

    // Generate Manager Response
    setTimeout(() => {
      let reply = "";
      const qLower = query.toLowerCase();

      if (qLower.includes("tanque") || qLower.includes("combustivel") || qLower.includes("gasolina")) {
        const totalCap = appState.tanks.reduce((acc, t) => acc + t.capacidade, 0);
        const totalVol = appState.tanks.reduce((acc, t) => acc + t.volumeAtual, 0);
        const pct = totalCap ? Math.round((totalVol / totalCap) * 100) : 0;
        reply = `Atualmente nossos tanques estão com ${pct}% da capacidade total (${totalVol.toLocaleString("pt-BR")}L de ${totalCap.toLocaleString("pt-BR")}L). Recomendo conferir a medição na régua e fazer a calibração diária.`;
      } else if (qLower.includes("caixa") || qLower.includes("venda") || qLower.includes("dinheiro") || qLower.includes("faturamento")) {
        const lastBalance = appState.dailyBalances[appState.dailyBalances.length - 1];
        if (lastBalance) {
          reply = `No último fechamento (${lastBalance.data}), registramos R$ ${lastBalance.vendaCombustivel.toLocaleString("pt-BR")} em combustíveis e R$ ${lastBalance.vendaLubrificantes.toLocaleString("pt-BR")} em lubrificantes. Mantenha os comprovantes organizados!`;
        } else {
          reply = "Seu caixa está sem fechamentos recentes. Lembre-se de lançar as movimentações diárias na aba 'Balancete Diário' para gerar o gráfico DRE!";
        }
      } else if (qLower.includes("anp") || qLower.includes("teste") || qLower.includes("qualidade") || qLower.includes("proveta")) {
        reply = "Para a fiscalização da ANP, sempre registre a densidade a 20°C e o teor de etanol anidro. Em caso de fiscalização, a planilha e o relatório impresso devem estar na gaveta da gerência!";
      } else if (qLower.includes("turno") || qLower.includes("frentista") || qLower.includes("escala") || qLower.includes("checklist")) {
        reply = "Na troca de turno, oriente os frentistas a aferirem os bicos, conferirem o troco inicial do caixa e verificar a limpeza da pista. O checklist digital evita esquecimentos!";
      } else if (qLower.includes("piada") || qLower.includes("alegria") || qLower.includes("motivação")) {
        reply = "Sabe qual é a bebida favorita da bomba do posto? É o Café com 'Octanagem'! Brincadeiras à parte, com trabalho em equipe e bom atendimento, a pista sempre roda cheia!";
      } else {
        reply = `Entendi sua dúvida sobre "${query}". Como gerente do posto, recomendo verificar os relatórios detalhados no menu principal. Estou sempre atento aos tanques, trocas de óleo e conciliação do caixa!`;
      }

      const managerMsg = {
        sender: "manager" as const,
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setChatMessages((prev) => [...prev, managerMsg]);
      setExpression("speaking");
      speakText(reply);
    }, 600);
  };

  return (
    <>
      {/* 1. FLOATING CHARACTER WIDGET (Bottom Right) */}
      {!isOpen && (
        <motion.div
          initial={{ scale: 0, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            setIsOpen(true);
            setExpression("happy");
            if (insights.length > 0) {
              speakText(`Olá! Sou o Marcos, Gerente do Posto. Tenho ${insights.length} avisos importantes para você hoje!`);
            }
          }}
        >
          {/* Quick Speech Bubble Preview */}
          <div className="hidden sm:flex flex-col bg-slate-900/90 text-white text-xs px-3.5 py-2 rounded-2xl shadow-xl border border-emerald-500/30 backdrop-blur-md max-w-[200px] transition-all group-hover:scale-105">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
              <span>Gerente Marcos</span>
            </div>
            <p className="text-slate-200 line-clamp-2">
              {insights.length > 0
                ? insights[0].title
                : "Clique para conversar sobre a operação do posto!"}
            </p>
          </div>

          {/* Avatar Container */}
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 p-1 shadow-2xl ring-4 ring-emerald-500/20 group-hover:ring-emerald-500/50 transition-all transform group-hover:scale-110">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden relative">
                {/* Visual SVG Avatar of Dark-Skinned Manager */}
                <StationManagerSVG
                  expression={expression}
                  isBlinking={isBlinking}
                  isSpeaking={isSpeaking}
                  isWaving={isWaving}
                />
              </div>
            </div>

            {/* Alert Badge */}
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                {alertCount}
              </span>
            )}

            {/* Online Pulse Status */}
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>
        </motion.div>
      )}

      {/* 2. EXPANDED MANAGER PANEL / OFFICE MODAL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 100, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
            >
              {/* Header Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700/50">
                <div className="flex items-center gap-3.5">
                  {/* Animated Avatar Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg relative flex-shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center overflow-hidden">
                      <StationManagerSVG
                        expression={expression}
                        isBlinking={isBlinking}
                        isSpeaking={isSpeaking}
                        isWaving={isWaving}
                      />
                    </div>
                    {isSpeaking && (
                      <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-full text-[10px] shadow animate-pulse">
                        <Volume2 className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg tracking-tight text-white">
                        Gerente Marcos
                      </h3>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        AO VIVO
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Gerente Operacional do Posto • Consultor do Caixa e Pista
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Audio Speech Toggle */}
                  <button
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        setIsMuted(!isMuted);
                      }
                    }}
                    className={`p-2 rounded-xl border transition-all ${
                      isSpeaking
                        ? "bg-amber-500 text-slate-950 border-amber-400 animate-pulse"
                        : isMuted
                        ? "bg-slate-800 text-slate-400 border-slate-700"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                    }`}
                    title={isMuted ? "Ativar Áudio do Gerente" : "Silenciar Gerente"}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => {
                      stopSpeaking();
                      setIsOpen(false);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Speech Banner Indicator */}
              {isSpeaking && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2 truncate">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <span className="font-semibold truncate">
                      " {currentSpeechText} "
                    </span>
                  </div>
                  <button
                    onClick={stopSpeaking}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 underline hover:text-amber-800 ml-2 shrink-0"
                  >
                    Parar
                  </button>
                </div>
              )}

              {/* Navigation Tabs inside Manager Window */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 pt-2 gap-2">
                <button
                  onClick={() => setActiveTab("tips")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                    activeTab === "tips"
                      ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Lightbulb className="w-4 h-4" />
                  Dicas do Gerente ({insights.length})
                </button>

                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                    activeTab === "chat"
                      ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Conversar com Marcos
                </button>

                <button
                  onClick={() => setActiveTab("status")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                    activeTab === "status"
                      ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-sm"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Perfil do Gerente
                </button>
              </div>

              {/* TAB CONTENT 1: DICAS & DIAGNÓSTICO */}
              {activeTab === "tips" && (
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
                    <Smile className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Acompanhamento Diário da Pista
                      </h4>
                      <p className="text-xs text-slate-6-00 dark:text-slate-300 mt-0.5 leading-relaxed">
                        Analisei seu banco de dados em tempo real. Veja abaixo as recomendações operacionais para manter seu posto lucrativo e seguro:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {insights.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          item.type === "alert"
                            ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200"
                            : item.type === "warning"
                            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
                            : item.type === "success"
                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {item.type === "alert" && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
                            {item.type === "warning" && <Info className="w-5 h-5 text-amber-600 shrink-0" />}
                            {item.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                            {item.type === "tip" && <Lightbulb className="w-5 h-5 text-teal-600 shrink-0" />}
                            <h5 className="font-bold text-sm">{item.title}</h5>
                          </div>

                          <button
                            onClick={() => speakText(`${item.title}. ${item.message}`)}
                            className="p-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 hover:bg-white text-slate-700 dark:text-slate-200 transition-all text-xs flex items-center gap-1 font-semibold"
                            title="Ouvir esta dica"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            Ouvir
                          </button>
                        </div>

                        <p className="text-xs leading-relaxed opacity-90">{item.message}</p>

                        {item.actionTab && onNavigateTab && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => {
                                onNavigateTab(item.actionTab!);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all shadow-sm"
                            >
                              {item.actionText}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: CONVERSA E PERGUNTAS */}
              {activeTab === "chat" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Messages Area */}
                  <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/50 dark:bg-slate-950/30">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 ${
                          msg.sender === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.sender === "manager" && (
                          <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                            msg.sender === "user"
                              ? "bg-emerald-600 text-white rounded-tr-none"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none"
                          }`}
                        >
                          <p>{msg.text}</p>
                          <span className="block text-[10px] opacity-60 text-right mt-1 font-mono">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Action Pills */}
                  <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                      Pergunte:
                    </span>
                    {[
                      "Como estão os tanques?",
                      "Relatório do caixa",
                      "Dica de fiscalização ANP",
                      "Troca de turno da pista",
                      "Motivação para frentistas",
                    ].map((pill, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => handleSendMessage(pill)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-600 dark:text-slate-300 transition-all shrink-0 border border-slate-200/60 dark:border-slate-700"
                      >
                        {pill}
                      </button>
                    ))}
                  </div>

                  {/* Input Footer */}
                  <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Pergunte ao Gerente Marcos sobre a operação..."
                      className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 3: PERFIL DO GERENTE */}
              {activeTab === "status" && (
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-emerald-950 text-white">
                    <div className="w-24 h-24 rounded-2xl bg-slate-950 p-1 border-2 border-emerald-500/40 shadow-2xl relative shrink-0">
                      <StationManagerSVG
                        expression="happy"
                        isBlinking={false}
                        isSpeaking={false}
                        isWaving={true}
                      />
                    </div>
                    <div className="space-y-2 text-center sm:text-left">
                      <h4 className="text-base font-extrabold text-white">
                        Marcos Antonio de Oliveira
                      </h4>
                      <p className="text-emerald-400 font-medium">
                        Gerente Geral de Operações e Posto de Combustíveis
                      </p>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        Especialista em conformidade ANP, controle de perdas por temperatura/evaporação, gestão de equipes de frentistas e análise financeira de margens de lucro por litro.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <h5 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-emerald-500" />
                        Capacidades e Atribuições
                      </h5>
                      <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                        <li>• Leitura preditiva de tanques e perdas</li>
                        <li>• Notificação imediata de quebras de caixa</li>
                        <li>• Orientações para testes de proveta ANP</li>
                        <li>• Síntese vocal em português (TTS)</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <h5 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-teal-500" />
                        Status da Assistência Inteligente
                      </h5>
                      <div className="space-y-2 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span>Sintetizador de Voz:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">Ativo</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Análise de Banco de Dados:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">Sincronizado</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Normas ANP:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">Atualizado 2026</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* SVG VECTOR ARTWORK OF DARK-SKINNED GAS STATION MANAGER ("Gerente Marcos")  */
/* -------------------------------------------------------------------------- */
interface StationManagerSVGProps {
  expression: "happy" | "speaking" | "alert" | "thinking";
  isBlinking: boolean;
  isSpeaking: boolean;
  isWaving: boolean;
}

export const StationManagerSVG: React.FC<StationManagerSVGProps> = ({
  expression,
  isBlinking,
  isSpeaking,
  isWaving,
}) => {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Dark Skin Tones Gradients */}
        <radialGradient id="skinGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#7a4b31" />
          <stop offset="70%" stopColor="#5c3622" />
          <stop offset="100%" stopColor="#422515" />
        </radialGradient>

        <radialGradient id="highlightSkin" cx="40%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#8d593c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#5c3622" stopOpacity="0" />
        </radialGradient>

        {/* Uniform Polo Shirt Gradient */}
        <linearGradient id="poloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="50%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>

        {/* Cap Gradient */}
        <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Badge Gold Accent */}
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* BACKGROUND CIRCLE SHADOW */}
      <circle cx="100" cy="100" r="92" fill="#0b1329" />

      {/* CHEST & UNIFORM POLO SHIRT */}
      <motion.g animate={{ y: expression === "speaking" ? [0, -1, 0] : [0, 0.5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
        {/* Shoulders */}
        <path
          d="M 30,195 Q 100,140 170,195 L 180,200 L 20,200 Z"
          fill="url(#poloGrad)"
        />
        {/* Collar Right */}
        <path d="M 100,150 L 135,170 L 120,185 L 100,165 Z" fill="#0f766e" />
        {/* Collar Left */}
        <path d="M 100,150 L 65,170 L 80,185 L 100,165 Z" fill="#0d9488" />
        {/* Inner Shirt Neck */}
        <path d="M 85,150 Q 100,165 115,150 Z" fill="#382013" />

        {/* Manager Name Badge */}
        <rect x="125" y="172" width="38" height="16" rx="4" fill="url(#badgeGrad)" stroke="#78350f" strokeWidth="1" />
        <text x="144" y="183" fontSize="7" fontWeight="bold" fill="#451a03" textAnchor="middle" fontFamily="sans-serif">
          MARCOS
        </text>

        {/* Gas Nozzle Logo on Shirt */}
        <circle cx="60" cy="178" r="6" fill="#f59e0b" />
        <path d="M 58,175 L 62,175 L 62,181 L 58,181 Z" fill="#1e293b" />
      </motion.g>

      {/* NECK */}
      <rect x="85" y="125" width="30" height="30" rx="6" fill="url(#skinGrad)" />

      {/* HEAD & FACE */}
      <g>
        {/* Main Face Shape */}
        <path
          d="M 55,80 C 55,40 145,40 145,80 C 145,125 125,145 100,145 C 75,145 55,125 55,80 Z"
          fill="url(#skinGrad)"
        />

        {/* Soft Cheek Highlight */}
        <ellipse cx="100" cy="75" rx="35" ry="30" fill="url(#highlightSkin)" />

        {/* Ears */}
        <circle cx="53" cy="85" r="9" fill="url(#skinGrad)" />
        <circle cx="147" cy="85" r="9" fill="url(#skinGrad)" />

        {/* EYES */}
        {/* Left Eye */}
        <g>
          <ellipse cx="78" cy="78" rx="8" ry={isBlinking ? "1" : "7"} fill="#ffffff" />
          {!isBlinking && (
            <>
              <circle cx="79" cy="78" r="4" fill="#2d170a" />
              <circle cx="80.5" cy="76.5" r="1.5" fill="#ffffff" />
            </>
          )}
        </g>

        {/* Right Eye */}
        <g>
          <ellipse cx="122" cy="78" rx="8" ry={isBlinking ? "1" : "7"} fill="#ffffff" />
          {!isBlinking && (
            <>
              <circle cx="121" cy="78" r="4" fill="#2d170a" />
              <circle cx="122.5" cy="76.5" r="1.5" fill="#ffffff" />
            </>
          )}
        </g>

        {/* EYEBROWS */}
        <motion.g
          animate={{
            y: expression === "alert" ? -4 : expression === "thinking" ? -2 : 0,
            rotate: expression === "alert" ? [0, -3, 0] : 0,
          }}
        >
          {/* Left Eyebrow */}
          <path
            d="M 68,66 Q 78,61 88,67"
            stroke="#1c0d06"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Right Eyebrow */}
          <path
            d="M 112,67 Q 122,61 132,66"
            stroke="#1c0d06"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>

        {/* NOSE */}
        <path
          d="M 96,82 Q 100,94 104,82 Q 100,98 96,82"
          fill="#3d2011"
        />

        {/* NEAT MUSTACHE & BEARD TRIM */}
        <path
          d="M 82,104 C 92,100 108,100 118,104 C 114,108 86,108 82,104 Z"
          fill="#1c0d06"
          opacity="0.95"
        />

        {/* MOUTH WITH LIP SYNC MOTION */}
        <motion.g
          animate={{
            scaleY: isSpeaking ? [1, 1.8, 0.8, 1.5, 1] : 1,
          }}
          transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.3 }}
        >
          {expression === "happy" || isSpeaking ? (
            <path
              d="M 82,112 Q 100,130 118,112 Q 100,120 82,112 Z"
              fill="#ffffff"
              stroke="#2e1408"
              strokeWidth="1.5"
            />
          ) : expression === "alert" ? (
            <ellipse cx="100" cy="115" rx="10" ry="6" fill="#2d1207" />
          ) : (
            <path
              d="M 85,114 Q 100,118 115,114"
              stroke="#2e1408"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </motion.g>

        {/* CAP & HAIR */}
        {/* Dark Afro Hair Trim Edges */}
        <path d="M 52,70 C 50,45 150,45 148,70 Z" fill="#170a04" />

        {/* Station Cap */}
        <g>
          {/* Visor / Brim */}
          <path
            d="M 45,55 C 80,48 120,48 155,55 C 160,65 40,65 45,55 Z"
            fill="url(#capGrad)"
            stroke="#0f172a"
          />
          {/* Cap Crown */}
          <path
            d="M 52,55 C 50,22 150,22 148,55 Z"
            fill="url(#capGrad)"
          />
          {/* Green/Gold Accent Stripe on Cap */}
          <path d="M 55,50 Q 100,43 145,50 L 146,54 Q 100,47 54,54 Z" fill="#10b981" />

          {/* Fuel Logo Emblem on Cap */}
          <circle cx="100" cy="38" r="8" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
          <path
            d="M 97,35 L 101,35 L 103,39 L 103,42 Q 101,43 97,42 Z"
            fill="#0f172a"
          />
        </g>
      </g>

      {/* WAVING ARM / HAND */}
      <AnimatePresence>
        {isWaving && (
          <motion.g
            initial={{ rotate: 0, x: 0 }}
            animate={{ rotate: [0, 15, -10, 15, 0] }}
            transition={{ duration: 1.5, repeat: 1 }}
            style={{ originX: "160px", originY: "180px" }}
          >
            {/* Arm */}
            <path d="M 155,180 Q 180,140 185,110" stroke="url(#skinGrad)" strokeWidth="18" strokeLinecap="round" fill="none" />
            {/* Hand */}
            <circle cx="185" cy="105" r="12" fill="url(#skinGrad)" />
            <circle cx="192" cy="100" r="4" fill="url(#skinGrad)" />
            <circle cx="188" cy="95" r="4" fill="url(#skinGrad)" />
            <circle cx="182" cy="94" r="4" fill="url(#skinGrad)" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
};
