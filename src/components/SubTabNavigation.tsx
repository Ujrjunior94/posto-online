import React from "react";
import { Bot } from "lucide-react";

export interface SubTabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

interface SubTabNavigationProps<T extends string = string> {
  tabs: SubTabOption<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  title?: string;
  titleIcon?: React.ReactNode;
  subtitle?: string;
  rightElement?: React.ReactNode;
  className?: string;
}

export function SubTabNavigation<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  title,
  titleIcon,
  subtitle,
  rightElement,
  className = "",
}: SubTabNavigationProps<T>) {
  return (
    <div className={`bg-[#16191f] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 ${className}`}>
      {(title || subtitle) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-lg font-black text-white flex items-center gap-2.5 font-display tracking-tight">
              {titleIcon && (
                <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 shrink-0">
                  {titleIcon}
                </span>
              )}
              <span>{title}</span>
            </h2>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Sub-tabs pill bar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#121417] p-1.5 rounded-xl border border-slate-800/90 shadow-inner">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer select-none ${
                  isActive
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-[1.02]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {tab.icon && (
                  <span className={`h-4 w-4 flex items-center justify-center shrink-0 ${isActive ? "text-slate-950" : "text-amber-400"}`}>
                    {tab.icon}
                  </span>
                )}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && (
                  <span
                    className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-slate-950 text-amber-300" : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {rightElement && <div className="flex items-center gap-2">{rightElement}</div>}

        <button
          type="button"
          onClick={() => {
            const event = new CustomEvent("OPEN_GERENTE_MARCOS");
            window.dispatchEvent(event);
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 border border-amber-500/30 text-amber-300 font-black text-xs rounded-xl transition cursor-pointer shadow-xs active:scale-95"
          title="Falar com o Gerente Virtual Marcos"
        >
          <Bot className="h-4 w-4 text-amber-400 animate-pulse" />
          <span>Gerente AI</span>
        </button>
      </div>
    </div>
  );
}

export default SubTabNavigation;
