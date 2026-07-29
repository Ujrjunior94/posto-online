/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { 
  Camera, 
  X, 
  ScanLine, 
  Sparkles, 
  AlertCircle, 
  Zap, 
  CheckCircle2, 
  Keyboard, 
  Search,
  RotateCcw,
  Volume2,
  VolumeX
} from "lucide-react";
import { LUBRICANT_BARCODE_CATALOG, lookupLubricantByBarcode, LubricantBarcodeItem } from "../data/lubricantBarcodes";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string, matchedProduct?: LubricantBarcodeItem | null) => void;
  appStateDeliveries?: any[];
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onBarcodeDetected,
  appStateDeliveries
}: BarcodeScannerModalProps) {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [matchedItem, setMatchedItem] = useState<LubricantBarcodeItem | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "barcode-camera-viewport";

  // Play audio beep when barcode scanned
  const playBeepSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      // Audio context ignored if user gesture blocked
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn("Erro ao parar scanner:", err);
      }
      html5QrcodeRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    setScannerError(null);
    setScannedCode(null);
    setMatchedItem(null);

    // Stop existing instance if any
    await stopScanner();

    try {
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ];

      const html5Qrcode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: cameraFacing },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minDim * 0.85),
              height: Math.floor(minDim * 0.55),
            };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Barcode found!
          if (navigator.vibrate) {
            navigator.vibrate([80, 40, 80]);
          }
          playBeepSound();

          const match = lookupLubricantByBarcode(decodedText, appStateDeliveries);
          setScannedCode(decodedText);
          setMatchedItem(match);

          // Stop scanning and trigger completion
          stopScanner();

          setTimeout(() => {
            onBarcodeDetected(decodedText, match);
            onClose();
          }, 600);
        },
        (errorMessage) => {
          // Silent frame read error
        }
      );

      setIsScanning(true);

      // Check if torch flashlight is available
      try {
        const videoTrack = (html5Qrcode as any).element?.srcObject?.getVideoTracks?.()?.[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities?.();
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          }
        }
      } catch (e) {
        setHasTorch(false);
      }

    } catch (err: any) {
      console.error("Erro ao iniciar câmera de leitura de código de barras:", err);
      setIsScanning(false);
      if (err?.toString().includes("NotAllowedError") || err?.toString().includes("Permission")) {
        setScannerError("Permissão de câmera negada. Conceda acesso à câmera nas configurações do navegador para escanear.");
      } else {
        setScannerError("Não foi possível acessar a câmera. Digite o código de barras manualmente ou selecione um produto de teste abaixo.");
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Delay slightly to let modal DOM render container
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, cameraFacing]);

  const toggleTorch = async () => {
    if (html5QrcodeRef.current && hasTorch) {
      try {
        const nextState = !torchOn;
        await html5QrcodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn("Falha ao alternar lanterna:", err);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const match = lookupLubricantByBarcode(manualCode, appStateDeliveries);
    playBeepSound();
    onBarcodeDetected(manualCode.trim(), match);
    onClose();
  };

  const handleSelectSample = (sample: LubricantBarcodeItem) => {
    playBeepSound();
    onBarcodeDetected(sample.barcode, sample);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl max-w-lg w-full overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[92vh] text-white relative">
        
        {/* Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-950/50">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                Leitor de Código de Barras
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  Câmera
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Aponte para o código EAN / Código de Barras do Lubrificante
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title={soundEnabled ? "Desativar Beep" : "Ativar Beep"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
            </button>
            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Camera Viewfinder Box */}
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 min-h-[260px] flex items-center justify-center shadow-inner">
            <div id={scannerContainerId} className="w-full h-full min-h-[260px]" />

            {/* Target Laser Overlay */}
            {isScanning && !scannedCode && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="w-64 h-36 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_15px_rgba(52,211,153,0.3)] flex items-center justify-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                  
                  {/* Animated laser beam */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />
                </div>
                <p className="text-[11px] font-bold text-emerald-400/90 mt-3 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/30">
                  Posicione o código de barras no retângulo
                </p>
              </div>
            )}

            {/* Success Overlay when scanned */}
            {scannedCode && (
              <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-20 animate-in zoom-in-95 duration-200">
                <div className="h-12 w-12 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mb-2 shadow-lg animate-bounce">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h4 className="font-extrabold text-base text-white">Código Lido com Sucesso!</h4>
                <p className="text-xs font-mono text-emerald-300 font-extrabold mt-1 bg-slate-900/80 px-3 py-1 rounded-lg border border-emerald-500/40">
                  {scannedCode}
                </p>
                {matchedItem && (
                  <p className="text-xs text-white font-bold mt-2 bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-400/30">
                    📦 {matchedItem.nome}
                  </p>
                )}
              </div>
            )}

            {/* Controls Bar over Camera */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl text-xs font-bold backdrop-blur-md transition cursor-pointer flex items-center gap-1 ${
                    torchOn 
                      ? "bg-amber-500 text-slate-950" 
                      : "bg-slate-900/80 text-amber-300 border border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{torchOn ? "Lantern Off" : "Lanterna"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCameraFacing(prev => prev === "environment" ? "user" : "environment");
                }}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold backdrop-blur-md transition cursor-pointer flex items-center gap-1"
                title="Inverter Câmera"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Câmera</span>
              </button>
            </div>
          </div>

          {/* Scanner Error Fallback */}
          {scannerError && (
            <div className="p-3.5 bg-amber-950/50 border border-amber-800/80 text-amber-200 text-xs rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">{scannerError}</p>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Você pode digitar o código ou clicar em um dos lubrificantes sugeridos abaixo.
                </p>
              </div>
            </div>
          )}

          {/* Manual Barcode Input Form */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5 text-indigo-400" />
              Ou Digite/Bip com leitor USB/Bluetooth:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: 7891348000010"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Confirmar</span>
              </button>
            </div>
          </form>

          {/* Catalog Samples Shortcuts */}
          <div className="space-y-2 border-t border-slate-800/80 pt-3">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Atalhos Rápidos de Teste (Lubrificantes Cadastrados):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
              {LUBRICANT_BARCODE_CATALOG.slice(0, 8).map((sample) => (
                <button
                  key={sample.barcode}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition text-xs flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-slate-200 group-hover:text-emerald-300 truncate text-[11px]">
                      {sample.nome}
                    </p>
                    <p className="text-[9.5px] font-mono text-slate-500">
                      EAN: {sample.barcode}
                    </p>
                  </div>
                  <span className="text-[9px] font-extrabold bg-slate-800 group-hover:bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                    {sample.marca}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Camera className="h-3.5 w-3.5 text-slate-400" />
            Suporte EAN-13, EAN-8, Code-128 e QR
          </span>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
