
import React from "react";
import { useStudio } from "../../contexts/StudioContext";
import { Store, ChevronDown } from "lucide-react";

export function StudioSwitcher() {
  const { studios, activeStudioId, setActiveStudioId } = useStudio();

  if (studios.length <= 1) return null;

  return (
    <div className="px-4 mb-4">
      <div className="relative group">
        <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 mb-1 block">Unidade Ativa</label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none">
            <Store size={14} />
          </div>
          <select
            value={activeStudioId ?? ""}
            onChange={(e) => setActiveStudioId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-8 text-xs font-black text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-orange-50 focus:border-orange-200 transition-all cursor-pointer"
          >
            {studios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? "Unidade s/ nome"}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}
