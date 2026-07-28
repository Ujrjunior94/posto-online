/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, Appointment } from "../types";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Tag,
  AlertCircle,
} from "lucide-react";

interface CalendarSchedulerProps {
  appState: AppState;
  cnpjPosto: string;
  onUpdateAppointments: (appointments: Appointment[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
}

const PLANNER_MONTHS = [
  { name: "Julho de 2026", days: 31, offset: 3, year: 2026, monthNum: 7 },
  { name: "Agosto de 2026", days: 31, offset: 6, year: 2026, monthNum: 8 },
  { name: "Setembro de 2026", days: 30, offset: 2, year: 2026, monthNum: 9 },
  { name: "Outubro de 2026", days: 31, offset: 4, year: 2026, monthNum: 10 },
];

export default function CalendarScheduler({
  appState,
  cnpjPosto,
  onUpdateAppointments,
  onAddAuditLog,
}: CalendarSchedulerProps) {
  const { appointments = [], shifts = [] } = appState;

  // Month Index
  const [monthIndex, setMonthIndex] = useState(0); // July 2026

  const activeMonth = PLANNER_MONTHS[monthIndex];
  const yearStr = String(activeMonth.year);
  const monthStr = String(activeMonth.monthNum).padStart(2, "0");

  // Selected Day State
  const [selectedDate, setSelectedDayDate] = useState(() => `${activeMonth.year}-${monthStr}-06`);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDate, setModalDate] = useState(() => `${activeMonth.year}-${monthStr}-06`);
  const [modalTime, setModalTime] = useState("10:00");
  const [modalDesc, setModalDesc] = useState("");

  const [error, setError] = useState("");

  const handlePrevMonth = () => {
    if (monthIndex > 0) {
      const prevIdx = monthIndex - 1;
      setMonthIndex(prevIdx);
      const m = PLANNER_MONTHS[prevIdx];
      setSelectedDayDate(`${m.year}-${String(m.monthNum).padStart(2, "0")}-01`);
    }
  };

  const handleNextMonth = () => {
    if (monthIndex < PLANNER_MONTHS.length - 1) {
      const nextIdx = monthIndex + 1;
      setMonthIndex(nextIdx);
      const m = PLANNER_MONTHS[nextIdx];
      setSelectedDayDate(`${m.year}-${String(m.monthNum).padStart(2, "0")}-01`);
    }
  };

  const handleOpenAddModal = () => {
    setModalTitle("");
    setModalDate(selectedDate);
    setModalTime("10:00");
    setModalDesc("");
    setError("");
    setIsModalOpen(true);
  };

  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!modalTitle.trim()) {
      setError("Insira o título do compromisso.");
      return;
    }

    const newApp: Appointment = {
      id: "app_" + Date.now(),
      title: modalTitle,
      date: modalDate,
      time: modalTime,
      description: modalDesc,
      stationCnpj: cnpjPosto,
    };

    onUpdateAppointments([...appointments, newApp]);
    onAddAuditLog(
      "CREATE",
      "Calendário",
      `Novo compromisso agendado: "${modalTitle}" em ${modalDate}`,
      "Regular"
    );

    setIsModalOpen(false);
  };

  const handleDeleteAppointment = (id: string) => {
    if (confirm("Marcar este compromisso como concluído e removê-lo?")) {
      const app = appointments.find((a) => a.id === id);
      const filtered = appointments.filter((a) => a.id !== id);
      onUpdateAppointments(filtered);
      if (app) {
        onAddAuditLog(
          "DELETE",
          "Calendário",
          `Compromisso concluído/removido: "${app.title}"`,
          "Regular"
        );
      }
    }
  };

  // Build grid components
  const offsetCells = activeMonth.offset;
  const daysInMonth = activeMonth.days;

  const totalGridCells = Math.ceil((offsetCells + daysInMonth) / 7) * 7;

  // Day calculations
  const [selYear, selMonth, selDay] = selectedDate.split("-");
  const selectedDayNum = parseInt(selDay) || 1;

  // Filters appointments and shifts
  const dayAppointments = appointments.filter(
    (app) => (!app.stationCnpj || app.stationCnpj === cnpjPosto) && app.date === selectedDate
  );
  
  // Format day name matching Day 01, Day 02 inside shifts
  const formattedDayStr = "Dia " + String(selectedDayNum).padStart(2, "0");
  const dayShifts = shifts.filter(
    (sh) => (!sh.stationCnpj || sh.stationCnpj === cnpjPosto) && sh.dayOfWeek === formattedDayStr && sh.frentistaResponsavel !== "Evento Geral"
  );

  // Month labels array
  const weekdayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // All sorted appointments in month
  const monthAppointments = appointments
    .filter((app) => app.stationCnpj === cnpjPosto && app.date.startsWith(`${yearStr}-${monthStr}`))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-display">
            <CalendarIcon className="text-indigo-600 h-6 w-6" />
            Calendário Geral e Agendas de Compromissos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visão mensal consolidada de manutenções programadas, vistorias do INMETRO, inspeções e escalas
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Agendar Compromisso
        </button>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left: Monthly Calendar */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarIcon className="text-indigo-600 h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-800">{activeMonth.name}</h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                disabled={monthIndex === 0}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 flex items-center justify-center transition disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNextMonth}
                disabled={monthIndex === PLANNER_MONTHS.length - 1}
                className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 flex items-center justify-center transition disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 bg-slate-50 border border-slate-200/60 rounded-xl p-2 text-center text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
            {weekdayHeaders.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty Offset cells */}
            {Array.from({ length: offsetCells }).map((_, idx) => (
              <div key={`offset-${idx}`} className="bg-transparent h-16 sm:h-20 rounded-xl border border-transparent"></div>
            ))}

            {/* Active Month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayStrNum = String(dayNum).padStart(2, "0");
              const cellDate = `${yearStr}-${monthStr}-${dayStrNum}`;
              const isSelected = selectedDate === cellDate;

              const cellApps = appointments.filter(
                (app) => (!app.stationCnpj || app.stationCnpj === cnpjPosto) && app.date === cellDate
              );
              const cellShifts = shifts.filter(
                (sh) => (!sh.stationCnpj || sh.stationCnpj === cnpjPosto) && sh.dayOfWeek === "Dia " + dayStrNum && sh.frentistaResponsavel !== "Evento Geral"
              );

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDayDate(cellDate)}
                  className={`h-16 sm:h-20 p-1 sm:p-2 rounded-xl flex flex-col justify-between cursor-pointer transition ${
                    isSelected
                      ? "border-2 border-indigo-600 bg-indigo-50/15"
                      : "border border-slate-200 hover:border-indigo-400 bg-white"
                  }`}
                >
                  <div
                    className={`text-right text-[10px] font-black ${
                      isSelected ? "text-indigo-600" : "text-slate-500"
                    }`}
                  >
                    {dayNum}
                  </div>
                  <div className="space-y-0.5 overflow-hidden flex-1 flex flex-col justify-end mt-1">
                    {cellApps.length > 0 && (
                      <div className="px-1 py-0.2 text-[8px] font-black border border-amber-200 bg-amber-50 text-amber-800 rounded truncate w-full flex items-center gap-0.5">
                        <AlertCircle className="h-2 w-2 shrink-0" />
                        <span className="truncate">{cellApps[0].title}</span>
                      </div>
                    )}
                    {cellShifts.length > 0 && (
                      <div className="px-1 py-0.2 text-[8px] font-black border border-blue-200 bg-blue-50 text-blue-800 rounded truncate w-full flex items-center gap-0.5">
                        <UserCheck className="h-2 w-2 shrink-0" />
                        <span className="truncate">{cellShifts.length} Plantões</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ending Empty cells */}
            {Array.from({ length: totalGridCells - offsetCells - daysInMonth }).map((_, idx) => (
              <div key={`end-${idx}`} className="bg-transparent h-16 sm:h-20 rounded-xl border border-transparent"></div>
            ))}
          </div>
        </div>

        {/* Right Side Panel: Selection Agenda */}
        <div className="xl:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[380px]">
          <div className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Compromissos do Dia</p>
              <h4 className="text-base font-black text-slate-800 mt-0.5">
                {selectedDayNum} de {activeMonth.name.split(" de ")[0]}, {activeMonth.year}
              </h4>
            </div>

            {/* Day Appointments */}
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-500" />
                Vistorias e Vencimentos
              </p>
              {dayAppointments.length === 0 ? (
                <div className="text-center py-5 text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  Nenhum compromisso agendado.
                </div>
              ) : (
                <div className="space-y-2">
                  {dayAppointments.map((app) => (
                    <div
                      key={app.id}
                      className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 flex justify-between items-start gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          <span className="truncate">{app.title}</span>
                        </div>
                        <p className="text-[9.5px] text-slate-500 mt-0.5 leading-tight">{app.description}</p>
                        <span className="inline-block text-[8px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 rounded mt-1.5">
                          {app.time}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteAppointment(app.id)}
                        className="text-[9px] font-bold text-rose-600 hover:text-rose-800 shrink-0 cursor-pointer"
                      >
                        Concluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Day Shifts */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-indigo-500" />
                Escala de Trabalho ({formattedDayStr})
              </p>
              {dayShifts.length === 0 ? (
                <div className="text-center py-5 text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  Sem plantonistas agendados.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dayShifts.map((sh) => (
                    <div
                      key={sh.id}
                      className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-between"
                    >
                      <div className="truncate">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{sh.frentistaResponsavel}</p>
                        <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.1 font-bold mt-0.5 inline-block">
                          {sh.turno}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={handleOpenAddModal}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Agendar para este Dia
            </button>
          </div>
        </div>
      </div>

      {/* Roster of Upcoming Events */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-1.5">
          <CalendarCheck className="text-indigo-600 h-4 w-4" />
          Visão Geral de Compromissos Agendados para o Mês
        </h3>

        {monthAppointments.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">Nenhum compromisso lançado para este mês.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthAppointments.map((app) => (
              <div
                key={app.id}
                className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl p-2.5 text-center shrink-0 min-w-[45px]">
                    <p className="text-base font-black leading-none">{app.date.split("-")[2]}</p>
                    <p className="text-[8px] uppercase font-bold mt-1">{app.time}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-slate-800 truncate">{app.title}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-normal line-clamp-3">
                      {app.description || "Sem detalhes adicionais."}
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-200/50 pt-2.5 mt-3.5 flex justify-end">
                  <button
                    onClick={() => handleDeleteAppointment(app.id)}
                    className="text-[10px] font-black text-rose-600 hover:text-rose-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              Agendar Novo Compromisso
            </h3>

            <form onSubmit={handleSaveAppointment} className="space-y-4">
              {error && <p className="p-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold">{error}</p>}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Evento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Vistoria do INMETRO"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição / Notas</label>
                <textarea
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Detalhes ou contatos adicionais sobre a vistoria/inspeção..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Agendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
