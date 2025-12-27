
import React, { useState } from 'react';
import { LegacyAppointment, LegacyProfessional } from '../../types';
import { services as serviceMap } from '../../data/mockData';
import { X } from 'lucide-react';
import { format } from 'date-fns';

interface BlockTimeModalProps {
  professional: LegacyProfessional;
  startTime: Date;
  onClose: () => void;
  onSave: (appointment: LegacyAppointment) => void;
}

const BlockTimeModal: React.FC<BlockTimeModalProps> = ({ professional, startTime, onClose, onSave }) => {
  const [startTimeStr, setStartTimeStr] = useState(format(startTime, 'HH:mm'));
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!endTime || !startTimeStr) {
      alert('Por favor, defina um horário de início e término.');
      return;
    }
    
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const finalStartTime = new Date(startTime);
    finalStartTime.setHours(startHour, startMinute, 0, 0);

    const [endHour, endMinute] = endTime.split(':').map(Number);
    const finalEndTime = new Date(startTime);
    finalEndTime.setHours(endHour, endMinute, 0, 0);

    if (finalEndTime <= finalStartTime) {
      alert('O horário de término deve ser posterior ao de início.');
      return;
    }
    
    const duration = (finalEndTime.getTime() - finalStartTime.getTime()) / (1000 * 60);

    const blockAppointment: LegacyAppointment = {
      id: Date.now(),
      professional,
      service: { ...serviceMap.bloqueio, name: notes || "Horário Bloqueado", duration },
      start: finalStartTime,
      end: finalEndTime,
      status: 'bloqueado',
      notas: notes,
    };
    onSave(blockAppointment);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold">Bloquear Horário</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100"><X /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-600">Profissional</label>
            <p className="mt-1 p-2 border rounded-md bg-slate-100 text-slate-700">{professional.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-600">Início</label>
              <input type="time" value={startTimeStr} onChange={(e) => setStartTimeStr(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-slate-50" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600">Fim</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-slate-50" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600">Motivo (opcional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-slate-50" placeholder="Ex: Almoço, Reunião" />
          </div>
        </div>
        <div className="p-5 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-white border rounded-md hover:bg-slate-100">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white rounded-md hover:bg-rose-700">Bloquear Horário</button>
        </div>
      </div>
    </div>
  );
};

export default BlockTimeModal;
