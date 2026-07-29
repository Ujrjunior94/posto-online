/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import SubTabNavigation from "./SubTabNavigation";
import { AppState, LubricantDelivery, LubricantProduct } from "../types";
import BarcodeScannerModal from "./BarcodeScannerModal";
import { LubricantBarcodeItem } from "../data/lubricantBarcodes";
import { 
  Droplets, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  FileText, 
  Package, 
  ShoppingCart,
  CheckSquare,
  Square,
  ArrowRight,
  X,
  ScanLine,
  Camera,
  Sparkles
} from "lucide-react";

interface LubricantDeliveriesProps {
  appState: AppState;
  onUpdateLubricants: (deliveries: LubricantDelivery[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  userRole: string;
  onClearData?: () => void;
}

export default function LubricantDeliveries({ 
  appState, 
  onUpdateLubricants, 
  onAddAuditLog,
  userRole,
  onClearData
}: LubricantDeliveriesProps) {
  const { lubricantDeliveries = [] } = appState;
  const isReadOnly = userRole === "Frentista";

  const [showAddForm, setShowAddForm] = useState(false);
  const [dataRecebimento, setDataRecebimento] = useState(() => new Date().toISOString().split("T")[0]);
  const [numeroNota, setNumeroNota] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [observacoes, setObservacoes] = useState("");
  
  // Products being added to a new delivery
  const [newProducts, setNewProducts] = useState<Omit<LubricantProduct, "id" | "conferido">[]>([]);
  const [prodNome, setProdNome] = useState("");
  const [prodQtd, setProdQtd] = useState<number>(1);
  const [prodUnidade, setProdUnidade] = useState<LubricantProduct["unidade"]>("Frasco");

  // Barcode Scanner Camera State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedNotification, setScannedNotification] = useState<string | null>(null);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleBarcodeDetected = (barcode: string, matchedProduct?: LubricantBarcodeItem | null) => {
    if (matchedProduct) {
      setProdNome(matchedProduct.nome);
      setProdUnidade(matchedProduct.unidadePadrao);
      setScannedNotification(`Código ${barcode} reconhecido: ${matchedProduct.nome}`);
    } else {
      const fallbackName = `Lubrificante (Cód. ${barcode})`;
      setProdNome(fallbackName);
      setScannedNotification(`Código de barras ${barcode} lido! Nome preenchido para conferência.`);
    }

    setTimeout(() => {
      setScannedNotification(null);
    }, 5000);
  };

  const handleAddProductToList = () => {
    if (!prodNome) return;
    setNewProducts([...newProducts, { nome: prodNome, quantidade: prodQtd, unidade: prodUnidade }]);
    setProdNome("");
    setProdQtd(1);
  };

  const handleRemoveProductFromList = (index: number) => {
    setNewProducts(newProducts.filter((_, i) => i !== index));
  };

  const handleCreateDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProducts.length === 0) {
      setError("Adicione ao menos um produto à nota.");
      return;
    }

    const newDelivery: LubricantDelivery = {
      id: "lub_" + Date.now(),
      dataRecebimento,
      numeroNota,
      fornecedor,
      valorTotal,
      produtos: newProducts.map((p, idx) => ({ ...p, id: `p_${idx}_${Date.now()}`, conferido: false })),
      statusConferencia: "Pendente",
      observacoes,
      stationCnpj: appState.users[0]?.cnpjPosto || ""
    };

    const updatedDeliveries = [...lubricantDeliveries, newDelivery];
    onUpdateLubricants(updatedDeliveries);
    onAddAuditLog("CREATE", "Logística", `Registrou nota de lubrificantes Nº ${numeroNota} do fornecedor ${fornecedor}. Valor: R$ ${valorTotal.toFixed(2)}`, "Regular");

    setSuccess("Nota de lubrificantes registrada com sucesso!");
    setTimeout(() => {
      setSuccess("");
      setShowAddForm(false);
      resetForm();
    }, 3000);
  };

  const toggleProductConferido = (deliveryId: string, productId: string) => {
    const updated = lubricantDeliveries.map(d => {
      if (d.id === deliveryId) {
        const updatedProducts = (d.produtos || []).map(p => 
          p.id === productId ? { ...p, conferido: !p.conferido } : p
        );
        
        // Calculate status
        const conferidosCount = updatedProducts.filter(p => p.conferido).length;
        let status: LubricantDelivery["statusConferencia"] = "Pendente";
        if (conferidosCount === updatedProducts.length) status = "Concluída";
        else if (conferidosCount > 0) status = "Parcial";

        return { ...d, produtos: updatedProducts, statusConferencia: status };
      }
      return d;
    });

    onUpdateLubricants(updated);
    
    // Audit if status changed to Concluída
    const dev = updated.find(d => d.id === deliveryId);
    if (dev?.statusConferencia === "Concluída") {
      onAddAuditLog("UPDATE", "Logística", `Conferência da nota ${dev.numeroNota} concluída com sucesso.`, "Regular");
    }
  };

  const handleDeleteDelivery = (id: string) => {
    if (confirm("Deseja realmente excluir este registro de nota de lubrificantes?")) {
      const filtered = lubricantDeliveries.filter(d => d.id !== id);
      onUpdateLubricants(filtered);
      onAddAuditLog("DELETE", "Logística", `Excluiu nota de lubrificantes ID ${id}`, "Regular");
    }
  };

  const resetForm = () => {
    setNumeroNota("");
    setFornecedor("");
    setValorTotal(0);
    setObservacoes("");
    setNewProducts([]);
    setDataRecebimento(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Entrada de Lubrificantes"
        titleIcon={<Droplets className="h-5 w-5" />}
        subtitle="Registro de notas fiscais, controle de recebimento e conferência física de produtos"
        activeTab="notas"
        onChange={() => {}}
        tabs={[
          {
            id: "notas",
            label: "Notas de Entrega",
            icon: <Droplets className="h-4 w-4" />,
            badge: lubricantDeliveries.length,
          }
        ]}
        rightElement={
          !isReadOnly ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onClearData) {
                    onClearData();
                  } else if (confirm("Deseja apagar todos os registros de notas de lubrificantes?")) {
                    onUpdateLubricants([]);
                  }
                }}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Limpar entregas de lubrificantes"
              >
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Limpar Lubrificantes</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition font-bold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span>{showAddForm ? "Cancelar" : "Nova Nota"}</span>
              </button>
            </div>
          ) : null
        }
      />

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-sm rounded-xl flex items-center gap-2 animate-fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in slide-in-from-top duration-300">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-indigo-600" />
            Registrar Recebimento de Produtos
          </h3>

          <form onSubmit={handleCreateDelivery} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Data de Recebimento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Nº da Nota Fiscal</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={numeroNota}
                    onChange={(e) => setNumeroNota(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="000.000.000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Fornecedor</label>
                <input
                  type="text"
                  required
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Nome do Fornecedor"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={valorTotal}
                  onChange={(e) => setValorTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                  <Package className="h-4 w-4 text-indigo-600" />
                  Produtos da Nota
                </h4>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer border border-emerald-400/30 active:scale-95 shrink-0"
                >
                  <Camera className="h-3.5 w-3.5 text-emerald-200" />
                  <ScanLine className="h-3.5 w-3.5 text-white animate-pulse" />
                  <span>Escanear com Câmera (Código de Barras)</span>
                </button>
              </div>

              {scannedNotification && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2 font-bold animate-in fade-in duration-200">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{scannedNotification}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-6 relative">
                  <input
                    type="text"
                    value={prodNome}
                    onChange={(e) => setProdNome(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder="Nome do produto (Ex: Óleo 5W30 1L ou Bipe com Câmera)"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-emerald-600 transition p-0.5 rounded cursor-pointer"
                    title="Escanear Código de Barras"
                  >
                    <ScanLine className="h-4 w-4" />
                  </button>
                </div>
                <div className="md:col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={prodQtd}
                    onChange={(e) => setProdQtd(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                    placeholder="Qtd"
                  />
                </div>
                <div className="md:col-span-3">
                  <select
                    value={prodUnidade}
                    onChange={(e) => setProdUnidade(e.target.value as LubricantProduct["unidade"])}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="Frasco">Frasco</option>
                    <option value="Balde">Balde</option>
                    <option value="Tambor">Tambor</option>
                    <option value="Caixa">Caixa</option>
                  </select>
                </div>
                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddProductToList}
                    className="w-full h-full bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {newProducts.length > 0 && (
                <div className="space-y-2 pt-2">
                  {newProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-200">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {p.quantidade}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{p.nome}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">{p.unidade}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleRemoveProductFromList(idx)}
                        className="text-slate-300 hover:text-rose-500 transition p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                placeholder="Ex: Nota entregue por motorista da distribuidora X..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              Registrar Nota Fiscal
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {lubricantDeliveries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <Droplets className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-slate-800 font-bold mb-1">Nenhuma nota registrada</h3>
            <p className="text-slate-500 text-xs">Comece adicionando uma nova nota fiscal de lubrificantes.</p>
          </div>
        ) : (
          lubricantDeliveries.slice().reverse().map(delivery => (
            <div key={delivery.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="bg-white h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Nota Fiscal: {delivery.numeroNota}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                        <Calendar className="h-3 w-3" /> {delivery.dataRecebimento.split("-").reverse().join("/")}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider border-l border-slate-300 pl-3">
                        {delivery.fornecedor}
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                        R$ {delivery.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                    delivery.statusConferencia === "Concluída" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                      : delivery.statusConferencia === "Parcial"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}>
                    {delivery.statusConferencia}
                  </span>
                  {!isReadOnly && (
                    <button 
                      onClick={() => handleDeleteDelivery(delivery.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(delivery.produtos || []).map(product => (
                  <button
                    key={product.id}
                    disabled={isReadOnly}
                    onClick={() => toggleProductConferido(delivery.id, product.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition group cursor-pointer ${
                      product.conferido 
                        ? "bg-emerald-50/50 border-emerald-100 shadow-sm" 
                        : "bg-white border-slate-100 hover:border-indigo-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${
                        product.conferido ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500"
                      }`}>
                        {product.conferido ? <CheckCircle className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold transition ${product.conferido ? "text-emerald-800 line-through opacity-70" : "text-slate-700"}`}>
                          {product.nome}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">
                          {product.quantidade} {product.unidade}(s)
                        </p>
                      </div>
                    </div>
                    {product.conferido ? (
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-200 group-hover:text-indigo-200" />
                    )}
                  </button>
                ))}
              </div>

              {delivery.observacoes && (
                <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-500 italic">
                  <strong>Obs:</strong> {delivery.observacoes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onBarcodeDetected={handleBarcodeDetected}
        appStateDeliveries={lubricantDeliveries}
      />
    </div>
  );
}
