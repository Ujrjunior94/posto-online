import React, { useRef, useState, useEffect } from "react";
import { Eraser, CheckCircle2, PenTool, RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  label?: string;
}

export default function SignaturePad({ onSignatureChange, label = "Assinatura Digital do Operador" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high resolution / crisp line drawing
    ctx.strokeStyle = "#0f172a"; // dark navy ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent scrolling when drawing on touch devices
    if ("touches" in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ("touches" in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      onSignatureChange(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <PenTool className="h-3.5 w-3.5 text-emerald-600" />
          {label}
        </label>
        {hasSignature && (
          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Assinado
          </span>
        )}
      </div>

      <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50 overflow-hidden transition group">
        <canvas
          ref={canvasRef}
          width={360}
          height={110}
          className="w-full h-[110px] touch-none cursor-crosshair bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!hasSignature && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 gap-1 opacity-70 group-hover:opacity-100 transition">
            <PenTool className="h-5 w-5 stroke-[1.5]" />
            <span className="text-[11px] font-medium">Assine aqui usando o mouse ou dedo/toque</span>
          </div>
        )}

        {hasSignature && (
          <button
            type="button"
            onClick={clearCanvas}
            className="absolute top-2 right-2 p-1.5 bg-slate-800/80 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer z-10"
            title="Limpar e reassinar"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-[10px]">Refazer</span>
          </button>
        )}
      </div>
      <p className="text-[9.5px] text-slate-400 font-medium">
        A assinatura digital valida legalmente a leitura do encerrante do bico.
      </p>
    </div>
  );
}
