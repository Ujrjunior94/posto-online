/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import SubTabNavigation from "./SubTabNavigation";
import { AppState, SupplyRequest, User } from "../types";
import { 
  Package, 
  Shirt, 
  Wrench, 
  FileText, 
  PlusCircle, 
  ListFilter, 
  Search, 
  Download, 
  CheckCircle, 
  Clock, 
  XCircle, 
  UserCheck, 
  Building, 
  Info, 
  HelpCircle,
  FileCheck,
  Calendar,
  Layers,
  ArrowRight,
  Bell,
  Trash2
} from "lucide-react";
import { notifySupplyRequestStatus, requestBrowserNotificationPermission } from "../lib/notifications";

interface SupplyRequestsProps {
  appState: AppState;
  userRole: string;
  currentUser: User;
  onUpdateSupplyRequests: (requests: SupplyRequest[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status?: string) => void;
  onClearData?: () => void;
}

export default function SupplyRequests({ 
  appState, 
  userRole, 
  currentUser,
  onUpdateSupplyRequests, 
  onAddAuditLog,
  onClearData
}: SupplyRequestsProps) {
  
  const requests = appState.supplyRequests || [];
  const users = appState.users || [];

  // Local UI States
  const [activeTab, setActiveTab] = useState<"listar" | "novo" | "estatisticas">("listar");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("Todos");
  const [filterStatus, setFilterStatus] = useState<string>("Todos");
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null);

  // Form States
  const [tipo, setTipo] = useState<SupplyRequest["tipo"]>("Fardamento");
  const [nomePosto, setNomePosto] = useState("Posto Central Sol");
  const [cnpjPosto, setCnpjPosto] = useState(currentUser.cnpjPosto || "12.345.678/0001-99");
  const [quemSolicita, setQuemSolicita] = useState(currentUser.nomeCompleto || "");
  const [paraQuemSolicita, setParaQuemSolicita] = useState("");
  const [relacionadoFuncionario, setRelacionadoFuncionario] = useState(true);
  const [funcionarioNome, setFuncionarioNome] = useState("");
  const [tamanhoFarda, setTamanhoFarda] = useState("M");
  const [numeracaoBota, setNumeracaoBota] = useState("40");
  const [itemDescricao, setItemDescricao] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [observacoes, setObservacoes] = useState("");

  const isMasterOrGerente = userRole === "Master" || userRole === "Gerente";

  // Auto-adjust relacionadoFuncionario checkbox when selecting type
  const handleTipoChange = (newTipo: SupplyRequest["tipo"]) => {
    setTipo(newTipo);
    if (newTipo === "Fardamento" || newTipo === "Bota") {
      setRelacionadoFuncionario(true);
    } else {
      setRelacionadoFuncionario(false);
    }
  };

  // Handle employee dropdown selection
  const handleEmployeeSelect = (employeeName: string) => {
    setParaQuemSolicita(employeeName);
    if (relacionadoFuncionario) {
      setFuncionarioNome(employeeName);
    }
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemDescricao.trim()) {
      alert("Por favor, descreva o item solicitado.");
      return;
    }

    if (!paraQuemSolicita.trim()) {
      alert("Por favor, informe para quem é a solicitação.");
      return;
    }

    const now = new Date();
    const formattedDate = now.toISOString().split("T")[0];
    const formattedTime = now.toLocaleTimeString("pt-BR");
    const dataHora = `${formattedDate} ${formattedTime}`;

    const newRequest: SupplyRequest = {
      id: "req_" + Date.now(),
      dataHora,
      tipo,
      nomePosto,
      cnpjPosto,
      quemSolicita,
      paraQuemSolicita,
      relacionadoFuncionario,
      ...(relacionadoFuncionario ? {
        funcionarioNome: funcionarioNome || paraQuemSolicita,
        tamanhoFarda: tipo === "Fardamento" ? tamanhoFarda : undefined,
        numeracaoBota: tipo === "Bota" ? numeracaoBota : undefined
      } : {}),
      itemDescricao,
      quantidade,
      observacoes: observacoes.trim() || undefined,
      status: "Pendente"
    };

    const updatedRequests = [newRequest, ...requests];
    onUpdateSupplyRequests(updatedRequests);
    onAddAuditLog(
      "CADASTRO", 
      "Suprimentos", 
      `Nova solicitação de ${tipo} criada por ${quemSolicita} para ${paraQuemSolicita}`, 
      "Regular"
    );

    alert("Solicitação criada com sucesso! Você já pode gerar e baixar o comprovante em imagem.");
    
    // Reset Form
    setItemDescricao("");
    setQuantidade(1);
    setObservacoes("");
    setActiveTab("listar");
  };

  const handleUpdateStatus = (id: string, newStatus: SupplyRequest["status"]) => {
    const updated = requests.map(r => {
      if (r.id === id) {
        return { ...r, status: newStatus };
      }
      return r;
    });
    onUpdateSupplyRequests(updated);
    
    const request = requests.find(r => r.id === id);
    if (request) {
      onAddAuditLog(
        "ALTERACAO", 
        "Suprimentos", 
        `Solicitação de ${request.tipo} (#${id.substring(4)}) alterada para ${newStatus} por ${currentUser.nomeCompleto}`, 
        "Regular"
      );

      // DISPARAR NOTIFICAÇÃO DO NAVEGADOR (Aprovado / Rejeitado / Cancelado)
      notifySupplyRequestStatus({
        itemDescricao: request.itemDescricao,
        tipo: request.tipo,
        paraQuemSolicita: request.paraQuemSolicita,
        status: newStatus
      });

      if (selectedRequest && selectedRequest.id === id) {
        setSelectedRequest({ ...selectedRequest, status: newStatus });
      }
    }
  };

  const handleDeleteRequest = (id: string) => {
    if (!window.confirm("Deseja realmente remover esta solicitação?")) return;
    
    const updated = requests.filter(r => r.id !== id);
    onUpdateSupplyRequests(updated);
    onAddAuditLog("EXCLUSAO", "Suprimentos", `Solicitação #${id.substring(4)} removida`, "Aviso");
    
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest(null);
    }
  };

  // Canvas Image Voucher Generator
  const handleDownloadVoucherImage = (req: SupplyRequest) => {
    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 750;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Gradient background for the container
    const mainGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    mainGrad.addColorStop(0, "#0f172a"); // slate-900
    mainGrad.addColorStop(1, "#1e1b4b"); // indigo-950
    ctx.fillStyle = mainGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Elegant neon-like outer border
    ctx.strokeStyle = "#4f46e5"; // indigo-600
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Draw header banner
    ctx.fillStyle = "#312e81"; // deep indigo
    ctx.fillRect(22, 22, canvas.width - 44, 90);

    // Title text
    ctx.fillStyle = "#ffffff";
    ctx.font = "black 22px 'Inter', sans-serif, Arial";
    ctx.textAlign = "center";
    ctx.fillText("MEU POSTO - SOLICITAÇÃO DE MATERIAL", canvas.width / 2, 60);

    ctx.fillStyle = "#a5b4fc"; // indigo-300
    ctx.font = "bold 13px monospace";
    ctx.fillText("COMPROVANTE DIGITAL DE PEDIDO DE SUPRIMENTOS", canvas.width / 2, 85);

    // Draw inner card white container for readability
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(40, 130, canvas.width - 80, 480);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 130, canvas.width - 80, 480);

    // Decorative line
    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 195);
    ctx.lineTo(canvas.width - 60, 195);
    ctx.stroke();

    // ID Voucher Code
    ctx.textAlign = "left";
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`CÓDIGO DE PROTOCOLO: #${req.id.toUpperCase().substring(4)}`, 60, 175);

    // Content rows
    let currentY = 235;
    const drawRow = (label: string, value: string, isHighlighted = false) => {
      ctx.textAlign = "left";
      ctx.font = "bold 12px 'Inter', sans-serif, Arial";
      ctx.fillStyle = "#64748b"; // slate-500
      ctx.fillText(label.toUpperCase(), 60, currentY);

      ctx.font = isHighlighted ? "bold 13px 'Inter', sans-serif, Arial" : "13px 'Inter', sans-serif, Arial";
      ctx.fillStyle = isHighlighted ? "#4f46e5" : "#0f172a";
      ctx.fillText(value, 210, currentY);

      currentY += 34;
    };

    drawRow("Tipo de Item:", req.tipo, true);
    drawRow("Posto Solicitante:", req.nomePosto);
    drawRow("CNPJ do Posto:", req.cnpjPosto);
    drawRow("Data e Hora:", req.dataHora);
    drawRow("Quem Solicitou:", req.quemSolicita);
    drawRow("Destinatário / Para:", req.paraQuemSolicita);

    if (req.relacionadoFuncionario) {
      drawRow("Funcionário Associado:", req.funcionarioNome || req.paraQuemSolicita);
      if (req.tamanhoFarda) {
        drawRow("Tamanho do Fardamento:", req.tamanhoFarda, true);
      }
      if (req.numeracaoBota) {
        drawRow("Numeração da Bota:", req.numeracaoBota, true);
      }
    }

    drawRow("Quantidade:", `${req.quantidade} unidades`);

    // Draw multi-line description
    ctx.font = "bold 12px 'Inter', sans-serif, Arial";
    ctx.fillStyle = "#64748b";
    ctx.fillText("DETALHES DO MATERIAL:", 60, currentY);

    ctx.font = "italic 13px 'Inter', sans-serif, Arial";
    ctx.fillStyle = "#1e293b";
    
    // Simple text wrapper
    const text = req.itemDescricao;
    const maxTextWidth = 360;
    const words = text.split(" ");
    let line = "";
    let descY = currentY + 18;
    
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + " ";
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && n > 0) {
        ctx.fillText(line, 60, descY);
        line = words[n] + " ";
        descY += 18;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 60, descY);

    // Observações se houver
    if (req.observacoes) {
      descY += 24;
      ctx.font = "bold 12px 'Inter', sans-serif, Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText("OBSERVAÇÕES ADICIONAIS:", 60, descY);

      ctx.font = "12px 'Inter', sans-serif, Arial";
      ctx.fillStyle = "#334155";
      ctx.fillText(req.observacoes, 60, descY + 16);
    }

    // Status Section (Stamp-like)
    ctx.textAlign = "center";
    ctx.fillStyle = req.status === "Aprovado" ? "#10b981" : req.status === "Pendente" ? "#f59e0b" : req.status === "Entregue" ? "#3b82f6" : "#ef4444";
    ctx.fillRect(canvas.width / 2 - 120, 530, 240, 45);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px 'Inter', sans-serif, Arial";
    ctx.fillText(`PEDIDO: ${req.status.toUpperCase()}`, canvas.width / 2, 558);

    // Signatures / Footers
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'Inter', sans-serif, Arial";
    ctx.fillText("Este é um documento autenticado pelo sistema operacional ERP Meu Posto.", canvas.width / 2, 595);

    // Bottom Decorative elements
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 680);
    ctx.lineTo(260, 680);
    ctx.moveTo(390, 680);
    ctx.lineTo(550, 680);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px 'Inter', sans-serif, Arial";
    ctx.fillText("Assinatura do Solicitante", 180, 698);
    ctx.fillText("Responsável pela Entrega", 470, 698);

    ctx.fillStyle = "#6366f1";
    ctx.font = "9px monospace";
    ctx.fillText(`HASH AUTENTICAÇÃO: ${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`, canvas.width / 2, 725);

    // Download flow
    const link = document.createElement("a");
    link.download = `comprovante_pedido_${req.id.substring(4)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Filter & Search Logic
  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.itemDescricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.paraQuemSolicita.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.quemSolicita.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.funcionarioNome && r.funcionarioNome.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTipo = filterTipo === "Todos" || r.tipo === filterTipo;
    const matchesStatus = filterStatus === "Todos" || r.status === filterStatus;

    return matchesSearch && matchesTipo && matchesStatus;
  });

  // Calculate statistics for metrics
  const totalCount = requests.length;
  const pendingCount = requests.filter(r => r.status === "Pendente").length;
  const approvedCount = requests.filter(r => r.status === "Aprovado").length;
  const deliveredCount = requests.filter(r => r.status === "Entregue").length;

  return (
    <div className="space-y-6">
      
      <SubTabNavigation
        title="Pedidos de Suprimentos"
        titleIcon={<Package className="h-5 w-5" />}
        subtitle="Fardamentos, botas, materiais administrativos e manutenção"
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as any)}
        tabs={[
          {
            id: "listar",
            label: "Listar Pedidos",
            icon: <Package className="h-4 w-4" />,
            badge: filteredRequests.length,
          },
          {
            id: "novo",
            label: "Novo Pedido",
            icon: <PlusCircle className="h-4 w-4" />,
          },
          {
            id: "estatisticas",
            label: "Estatísticas",
            icon: <FileText className="h-4 w-4" />,
          },
        ]}
        rightElement={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onClearData) {
                  onClearData();
                } else if (confirm("Deseja apagar todos os pedidos de suprimentos?")) {
                  onUpdateSupplyRequests([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Limpar pedidos de suprimentos"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Limpar Pedidos</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const granted = await requestBrowserNotificationPermission();
                if (granted) {
                  alert("🔔 Notificações ativadas! Você receberá alertas em tempo real sobre Pedidos de Material no navegador.");
                } else {
                  alert("⚠️ Permissão de notificação não concedida no navegador.");
                }
              }}
              className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Ativar Alertas no Navegador"
            >
              <Bell className="h-3.5 w-3.5 text-indigo-400" />
              <span>Alertas</span>
            </button>
          </div>
        }
      />

      {/* Mini metric counters bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Geral</p>
            <p className="text-xl font-black text-slate-900 font-display mt-1">{totalCount}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Layers className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pendentes</p>
            <p className="text-xl font-black text-amber-600 font-display mt-1">{pendingCount}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aprovados</p>
            <p className="text-xl font-black text-emerald-600 font-display mt-1">{approvedCount}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entregues</p>
            <p className="text-xl font-black text-indigo-600 font-display mt-1">{deliveredCount}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <FileCheck className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Main View Router */}
      {activeTab === "listar" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por item, solicitante ou beneficiário..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <ListFilter className="h-3.5 w-3.5 text-slate-400" />
                Filtros:
              </div>

              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="Todos">Todos os Tipos</option>
                <option value="Fardamento">👕 Fardamento</option>
                <option value="Bota">🥾 Bota</option>
                <option value="Material de Escritório">📁 Material Escritório</option>
                <option value="Equipamento de Manutenção">🛠️ Manutenção</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="Todos">Todos os Status</option>
                <option value="Pendente">⏳ Pendente</option>
                <option value="Aprovado">✅ Aprovado</option>
                <option value="Entregue">📦 Entregue</option>
                <option value="Cancelado">❌ Cancelado</option>
              </select>
            </div>
          </div>

          {/* List/Table */}
          {filteredRequests.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-300">
                <Package className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-black text-slate-700 uppercase">Nenhum pedido encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">Não há solicitações correspondentes aos filtros definidos. Crie uma nova solicitação!</p>
              <button
                onClick={() => setActiveTab("novo")}
                className="mt-6 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-indigo-100"
              >
                Fazer Nova Solicitação
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-4 px-6">Voucher/Data</th>
                      <th className="py-4 px-6">Tipo</th>
                      <th className="py-4 px-6">Quem/Para Quem</th>
                      <th className="py-4 px-6">Especificação</th>
                      <th className="py-4 px-6">Qtd</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => {
                      // Status tags styles
                      let statusStyle = "bg-amber-50 border-amber-200 text-amber-700";
                      if (req.status === "Aprovado") statusStyle = "bg-emerald-50 border-emerald-200 text-emerald-700";
                      if (req.status === "Entregue") statusStyle = "bg-indigo-50 border-indigo-200 text-indigo-700";
                      if (req.status === "Cancelado") statusStyle = "bg-rose-50 border-rose-200 text-rose-700";

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-6">
                            <span className="font-mono text-xs font-black text-indigo-600 block">
                              #{req.id.substring(4)}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                              {req.dataHora}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-700 uppercase">
                              {req.tipo === "Fardamento" && <Shirt className="h-3.5 w-3.5 text-indigo-500" />}
                              {req.tipo === "Bota" && <Wrench className="h-3.5 w-3.5 text-sky-500" />}
                              {req.tipo === "Material de Escritório" && <FileText className="h-3.5 w-3.5 text-amber-500" />}
                              {req.tipo === "Equipamento de Manutenção" && <Wrench className="h-3.5 w-3.5 text-rose-500" />}
                              {req.tipo}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                <span className="text-[10px] text-slate-400 block">De: {req.quemSolicita}</span>
                                Para: {req.paraQuemSolicita}
                              </p>
                              {req.relacionadoFuncionario && (
                                <span className="inline-block text-[9px] bg-slate-100 border border-slate-200/50 rounded px-1.5 font-bold text-slate-500 uppercase mt-1">
                                  {req.tamanhoFarda ? `Tam: ${req.tamanhoFarda}` : ""}
                                  {req.numeracaoBota ? `Bota Num: ${req.numeracaoBota}` : ""}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 max-w-xs">
                            <p className="text-xs font-medium text-slate-600 truncate" title={req.itemDescricao}>
                              {req.itemDescricao}
                            </p>
                            {req.observacoes && (
                              <p className="text-[10px] text-slate-400 italic truncate mt-0.5" title={req.observacoes}>
                                * {req.observacoes}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                              {req.quantidade}x
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-block text-[9px] font-black uppercase border rounded-full px-2 py-0.5 ${statusStyle}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 rounded-lg transition inline-flex items-center gap-1 text-[10px] font-bold uppercase"
                              title="Visualizar Comprovante"
                            >
                              <Info className="h-3.5 w-3.5" />
                              Ver
                            </button>
                            <button
                              onClick={() => handleDownloadVoucherImage(req)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg transition inline-flex items-center gap-1 text-[10px] font-bold uppercase"
                              title="Baixar Imagem"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Imagem
                            </button>
                            {isMasterOrGerente && (
                              <div className="inline-block relative group/actions">
                                <button className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-100 transition">
                                  Status ▾
                                </button>
                                <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-xl shadow-xl border border-slate-200 hidden group-hover/actions:block z-50 text-left p-1 space-y-1">
                                  {req.status !== "Pendente" && (
                                    <button 
                                      onClick={() => handleUpdateStatus(req.id, "Pendente")}
                                      className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-amber-50 text-amber-700 rounded-lg"
                                    >
                                      Pendente
                                    </button>
                                  )}
                                  {req.status !== "Aprovado" && (
                                    <button 
                                      onClick={() => handleUpdateStatus(req.id, "Aprovado")}
                                      className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg"
                                    >
                                      Aprovar
                                    </button>
                                  )}
                                  {req.status !== "Entregue" && (
                                    <button 
                                      onClick={() => handleUpdateStatus(req.id, "Entregue")}
                                      className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-indigo-50 text-indigo-700 rounded-lg"
                                    >
                                      Entregue
                                    </button>
                                  )}
                                  {req.status !== "Cancelado" && (
                                    <button 
                                      onClick={() => handleUpdateStatus(req.id, "Cancelado")}
                                      className="w-full text-left text-[10px] font-bold uppercase px-2.5 py-1.5 hover:bg-rose-50 text-rose-700 rounded-lg"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                  <div className="border-t border-slate-100 my-1" />
                                  <button 
                                    onClick={() => handleDeleteRequest(req.id)}
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

      {activeTab === "novo" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Request Form */}
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <PlusCircle className="text-indigo-600 h-5 w-5" />
                Formulário de Solicitação
              </h2>
              <p className="text-xs text-slate-500 font-medium">Preencha os dados necessários para o fornecimento do material ou equipamento.</p>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo de Solicitação</label>
                  <select
                    value={tipo}
                    onChange={(e) => handleTipoChange(e.target.value as SupplyRequest["tipo"])}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                  >
                    <option value="Fardamento">👕 Fardamento / Vestuário</option>
                    <option value="Bota">🥾 Bota / Calçado de Segurança</option>
                    <option value="Material de Escritório">📁 Material de Escritório</option>
                    <option value="Equipamento de Manutenção">🛠️ Equipamento de Manutenção</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Posto de Combustíveis</label>
                  <input
                    type="text"
                    value={nomePosto}
                    onChange={(e) => setNomePosto(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">CNPJ do Posto</label>
                  <input
                    type="text"
                    value={cnpjPosto}
                    onChange={(e) => setCnpjPosto(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Quem Solicita (Responsável)</label>
                  <input
                    type="text"
                    value={quemSolicita}
                    onChange={(e) => setQuemSolicita(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 my-4 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Destinatário & Beneficiário</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={relacionadoFuncionario}
                      onChange={(e) => setRelacionadoFuncionario(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-bold text-slate-500">Relacionado a Funcionário Físico</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Selecione o Funcionário</label>
                    <div className="flex gap-2 mt-1.5">
                      <select
                        value={paraQuemSolicita}
                        onChange={(e) => handleEmployeeSelect(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                      >
                        <option value="">-- Selecione o Funcionário --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.nomeCompleto}>
                            {u.nomeCompleto} ({u.cargo})
                          </option>
                        ))}
                        <option value="Equipe Geral de Pista">Equipe Geral de Pista</option>
                        <option value="Equipe Administrativa">Equipe Administrativa</option>
                        <option value="Outro">Outro (Inserir manual)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nome Completo / Destinatário Manual</label>
                    <input
                      type="text"
                      value={paraQuemSolicita}
                      onChange={(e) => handleEmployeeSelect(e.target.value)}
                      placeholder="Nome do destinatário"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Conditional Employee specs (Uniform & Boots sizing) */}
                {relacionadoFuncionario && (
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/60 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300">
                    {tipo === "Fardamento" && (
                      <div>
                        <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block mb-1.5">Tamanho da Farda</label>
                        <select
                          value={tamanhoFarda}
                          onChange={(e) => setTamanhoFarda(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="PP">PP - Muito Pequeno</option>
                          <option value="P">P - Pequeno</option>
                          <option value="M">M - Médio</option>
                          <option value="G">G - Grande</option>
                          <option value="GG">GG - Extra Grande</option>
                          <option value="XG">XG - Plus Size</option>
                          <option value="XXG">XXG - Super Plus Size</option>
                        </select>
                      </div>
                    )}

                    {tipo === "Bota" && (
                      <div>
                        <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block mb-1.5">Numeração da Bota (EPI)</label>
                        <select
                          value={numeracaoBota}
                          onChange={(e) => setNumeracaoBota(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                        >
                          {Array.from({ length: 13 }, (_, i) => String(34 + i)).map((num) => (
                            <option key={num} value={num}>
                              {num} - Padrão Segurança
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <p className="text-[10px] text-indigo-400 font-bold leading-relaxed flex items-start gap-1.5">
                        <Info className="h-4 w-4 shrink-0 text-indigo-500" />
                        Estes tamanhos serão vinculados à escala e à ficha de EPIs do funcionário selecionado ({funcionarioNome || paraQuemSolicita || "nenhum"}).
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Especificação do Item / Detalhes</label>
                  <input
                    type="text"
                    value={itemDescricao}
                    onChange={(e) => setItemDescricao(e.target.value)}
                    placeholder="Ex: Camiseta polo preta com logo bordado, ou Calçado de Segurança bico de aço..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Motivação / Observações (Opcional)</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Troca por desgaste natural, admissão de novo colaborador..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium mt-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition flex items-center gap-2 shadow-lg shadow-slate-200"
                >
                  <PlusCircle className="h-4 w-4" />
                  Enviar Solicitação & Registrar
                </button>
              </div>
            </form>
          </div>

          {/* Quick info panel */}
          <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
              <Info className="text-indigo-400 h-5 w-5" />
              Informações Importantes
            </h3>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex gap-3">
                <Shirt className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white uppercase text-[10px] tracking-wider">Fardamento Escala</p>
                  <p className="mt-1 leading-relaxed text-slate-400">Todo funcionário do posto de combustível deve portar fardamento completo oficial limpo, contendo faixas refletivas de segurança obrigatórias pelas normas ANP.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Wrench className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white uppercase text-[10px] tracking-wider">Botas & Calçados (EPI)</p>
                  <p className="mt-1 leading-relaxed text-slate-400">É estritamente proibido o tráfego nas pistas de abastecimento sem calçado de segurança fechado adequado, com biqueira de proteção para queda de materiais.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <FileText className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white uppercase text-[10px] tracking-wider">Comprovante Digital (.PNG)</p>
                  <p className="mt-1 leading-relaxed text-slate-400">Ao final do preenchimento, o sistema disponibilizará um comprovante digital gerado com data e hora exatas da solicitação para fins de auditoria interna.</p>
                </div>
              </div>
            </div>

            <div className="bg-indigo-950 border border-indigo-900 p-4 rounded-2xl flex flex-col gap-2">
              <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">Dica Operacional</span>
              <p className="text-[11px] text-indigo-200 leading-relaxed">Você pode imprimir o comprovante em imagem gerado para que o frentista assine no momento da entrega do uniforme ou material.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "estatisticas" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">👕 Fardamentos</p>
              <p className="text-3xl font-black text-indigo-600 font-display mt-2">
                {requests.filter(r => r.tipo === "Fardamento").length}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Solicitações Registradas</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🥾 Botas de EPI</p>
              <p className="text-3xl font-black text-sky-600 font-display mt-2">
                {requests.filter(r => r.tipo === "Bota").length}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Solicitações Registradas</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">📁 Escritório</p>
              <p className="text-3xl font-black text-amber-600 font-display mt-2">
                {requests.filter(r => r.tipo === "Material de Escritório").length}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Solicitações Registradas</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🛠️ Equipamentos</p>
              <p className="text-3xl font-black text-rose-600 font-display mt-2">
                {requests.filter(r => r.tipo === "Equipamento de Manutenção").length}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">Solicitações Registradas</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-4 border-b border-slate-100 pb-3">Distribuição das Últimas Solicitações</h3>
            <div className="space-y-4">
              {requests.slice(0, 5).map((req, index) => {
                const now = new Date();
                const progressWidth = Math.max(10, Math.min(100, 100 - (index * 20)));
                return (
                  <div key={req.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700 uppercase">
                      <span>{req.tipo} - Protocolo #{req.id.substring(4)}</span>
                      <span className="text-slate-400 font-mono font-normal">{req.dataHora}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-50 border border-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-indigo-600 rounded-full`} 
                        style={{ width: `${progressWidth}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* COMPROVANTE MODAL DETAIL */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider">Comprovante de Solicitação</h3>
              </div>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-xl transition"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Voucher Body Visual */}
            <div className="p-6 space-y-6">
              
              {/* Receipt Style card */}
              <div className="border border-indigo-100 rounded-2xl p-5 bg-indigo-50/20 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Package className="h-32 w-32" />
                </div>

                <div className="flex justify-between items-start border-b border-indigo-100/50 pb-3">
                  <div>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase">
                      Protocolo #{selectedRequest.id.substring(4)}
                    </span>
                    <h4 className="text-base font-black text-slate-800 mt-1 uppercase font-display">{selectedRequest.tipo}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Data & Hora</span>
                    <span className="text-xs font-mono font-bold text-slate-700">{selectedRequest.dataHora}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6 text-xs">
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Nome do Posto</p>
                    <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {selectedRequest.nomePosto}
                    </p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">CNPJ do Posto</p>
                    <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedRequest.cnpjPosto}</p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Quem Solicitou</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedRequest.quemSolicita}</p>
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Para Quem / Destinatário</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedRequest.paraQuemSolicita}</p>
                  </div>

                  {selectedRequest.relacionadoFuncionario && (
                    <div className="sm:col-span-2 bg-white/70 p-3 rounded-xl border border-indigo-100/50 grid grid-cols-2 gap-4">
                      {selectedRequest.tamanhoFarda && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Tamanho do Fardamento</p>
                          <p className="font-black text-indigo-700 text-sm mt-0.5">{selectedRequest.tamanhoFarda}</p>
                        </div>
                      )}

                      {selectedRequest.numeracaoBota && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Numeração da Bota (EPI)</p>
                          <p className="font-black text-indigo-700 text-sm mt-0.5">{selectedRequest.numeracaoBota}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Material Solicitado & Qtd</p>
                    <p className="font-bold text-slate-800 mt-1 bg-white p-2.5 rounded-xl border border-slate-100 font-mono text-xs">
                      <span className="text-indigo-600 font-extrabold mr-1.5">[{selectedRequest.quantidade}x]</span>
                      {selectedRequest.itemDescricao}
                    </p>
                  </div>

                  {selectedRequest.observacoes && (
                    <div className="sm:col-span-2">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Observações / Justificativa</p>
                      <p className="text-slate-600 mt-1 italic text-[11px] leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        "{selectedRequest.observacoes}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-indigo-100/50 pt-3 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estado da Entrega</span>
                  <span className={`inline-block text-[10px] font-black uppercase border rounded-full px-3 py-0.5 ${
                    selectedRequest.status === "Aprovado" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    selectedRequest.status === "Entregue" ? "bg-indigo-50 text-indigo-600 border-indigo-200" :
                    selectedRequest.status === "Cancelado" ? "bg-rose-50 text-rose-600 border-rose-200" :
                    "bg-amber-50 text-amber-600 border-amber-200"
                  }`}>
                    {selectedRequest.status}
                  </span>
                </div>
              </div>

              {/* Action options */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleDownloadVoucherImage(selectedRequest)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  Gerar e Baixar Imagem (.PNG)
                </button>
                
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest transition"
                >
                  Fechar Janela
                </button>
              </div>

              {/* Info advice stamp */}
              <p className="text-[10px] text-slate-400 leading-normal text-center bg-slate-50 p-3 rounded-2xl">
                O arquivo gerado em formato .PNG contém carimbos de validação do sistema com o exato dia e hora da requisição, ideal para prestação de contas.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
