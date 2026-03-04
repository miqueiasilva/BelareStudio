
import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, User, AlignLeft, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { format, addMinutes, parse } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { useConfirm } from '../../utils/useConfirm';
import { LegacyProfessional, LegacyAppointment } from '../../types';
import toast from 'react-hot-toast';

interface BlockTimeModalProps {
  professional?: LegacyProfessional;
  startTime?: Date;
  appointment?: LegacyAppointment; // For editing
  onClose: () => void;
  onSave: () => void;
}

const BlockTimeModal: React.FC<BlockTimeModalProps> = ({ 
  professional, 
  startTime, 
  appointment,
  onClose, 
  onSave 
}) => {
  const { activeStudioId } = useStudio();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    professional_id: appointment?.professional?.id || professional?.id || '',
    professional_name: appointment?.professional?.name || professional?.name || '',
    date: format(appointment?.start || startTime || new Date(), 'yyyy-MM-dd'),
    startTime: format(appointment?.start || startTime || new Date(), 'HH:mm'),
    endTime: format(appointment?.end || addMinutes(appointment?.start || startTime || new Date(), 60), 'HH:mm'),
    notes: appointment?.notas || '',
    repeat: false
  });

  const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!activeStudioId) return;
      setLoadingProfessionals(true);
      try {
        const { data, error: sbError } = await supabase
          .from('team_members')
          .select('id, name, photo_url')
          .eq('studio_id', activeStudioId)
          .eq('active', true)
          .order('name');

        if (sbError) throw sbError;
        if (data) {
          setProfessionals(data.map((p: any) => ({
            id: p.id,
            name: p.name,
            avatarUrl: p.photo_url
          })));
        }
      } catch (e: any) {
        console.error("Erro ao carregar profissionais:", e.message);
      } finally {
        setLoadingProfessionals(false);
      }
    };

    fetchProfessionals();
  }, [activeStudioId]);

  const handleSave = async () => {
    if (!activeStudioId) return;
    setError(null);

    if (!formData.professional_id) return setError('Selecione um colaborador.');
    if (!formData.startTime || !formData.endTime) return setError('Defina os horários.');

    const start = new Date(`${formData.date}T${formData.startTime}:00`);
    const end = new Date(`${formData.date}T${formData.endTime}:00`);

    if (end <= start) return setError('O horário de término deve ser após o início.');

    setIsSaving(true);
    try {
      const payload = {
        studio_id: activeStudioId,
        professional_id: String(formData.professional_id),
        professional_name: formData.professional_name,
        client_name: 'Bloqueio de Horário',
        service_name: 'Indisponível',
        date: start.toISOString(),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        duration: (end.getTime() - start.getTime()) / 60000,
        status: 'bloqueado',
        type: 'block',
        notes: formData.notes,
        service_color: '#f87171' // Rose 400
      };

      if (appointment?.id) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', appointment.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('appointments')
          .insert([payload]);
        if (insertError) throw insertError;
      }

      toast.success('Bloqueio salvo com sucesso!');
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar bloqueio:", err);
      setError(err.message || 'Erro ao salvar bloqueio.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment?.id) return;

    const isConfirmed = await confirm({
      title: 'Excluir Bloqueio',
      message: 'Tem certeza que deseja remover este bloqueio de horário?',
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment.id);

      if (deleteError) throw deleteError;

      toast.success('Bloqueio removido!');
      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erro ao excluir bloqueio:", err);
      setError(err.message || 'Erro ao excluir bloqueio.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
              {appointment?.id ? 'Editar Bloqueio' : 'Bloqueio de Horário'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </header>

        <main className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-bold animate-in slide-in-from-top-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <User size={12} /> Colaborador
            </label>
            <select 
              value={formData.professional_id}
              onChange={(e) => {
                const prof = professionals.find(p => String(p.id) === e.target.value);
                setFormData(prev => ({ 
                  ...prev, 
                  professional_id: e.target.value,
                  professional_name: prof?.name || ''
                }));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-400 outline-none transition-all appearance-none"
            >
              <option value="">Selecione um colaborador</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <Calendar size={12} /> Data
            </label>
            <input 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-400 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <Clock size={12} /> Início
              </label>
              <input 
                type="time" 
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-400 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                <Clock size={12} /> Término
              </label>
              <input 
                type="time" 
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-400 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
              <AlignLeft size={12} /> Descrição / Motivo
            </label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex: Almoço, Reunião, Folga..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-rose-100 focus:border-rose-400 outline-none transition-all resize-none h-24"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Repetir Bloqueio</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Repetir este horário semanalmente</span>
            </div>
            <button 
              onClick={() => setFormData(prev => ({ ...prev, repeat: !prev.repeat }))}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.repeat ? 'bg-rose-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.repeat ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </main>

        <footer className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 shadow-xl shadow-slate-200 transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Salvar Bloqueio'}
            </button>
          </div>

          {appointment?.id && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-3 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Excluir Bloqueio
            </button>
          )}
        </footer>
      </div>
      <ConfirmDialogComponent />
    </div>
  );
};

export default BlockTimeModal;
