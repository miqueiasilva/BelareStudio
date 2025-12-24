
import React, { useState, useEffect } from 'react';
// FIX: Added 'Zap' to the imports from 'lucide-react' to resolve the 'Cannot find name Zap' error on line 107.
import { X, User, Scissors, Calendar, Clock, DollarSign, Info, Loader2, Save, Zap } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { LegacyAppointment, Client, LegacyService, LegacyProfessional } from '../../types';
import { format, addMinutes } from 'date-fns';

interface NewAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<LegacyService[]>([]);
    const [professionals, setProfessionals] = useState<LegacyProfessional[]>([]);
    
    const [formData, setFormData] = useState({
        clientId: '',
        clientName: '',
        serviceId: '',
        professionalId: '',
        date: '',
        time: '',
        value: 0,
        status: 'agendado',
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
            if (initialData) {
                setFormData(prev => ({
                    ...prev,
                    professionalId: initialData.professional?.id || '',
                    date: initialData.start ? format(initialData.start, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                    time: initialData.start ? format(initialData.start, 'HH:mm') : '09:00',
                    status: initialData.status || 'agendado',
                    clientId: initialData.client?.id || '',
                    clientName: initialData.client?.nome || '',
                    serviceId: initialData.service?.id || '',
                    value: initialData.service?.price || 0
                }));
            }
        }
    }, [isOpen, initialData]);

    const loadInitialData = async () => {
        const [cRes, sRes, pRes] = await Promise.all([
            supabase.from('clients').select('*').order('nome'),
            supabase.from('services').select('*').order('nome'),
            supabase.from('professionals').select('*').eq('active', true).order('name')
        ]);
        setClients(cRes.data || []);
        setServices((sRes.data || []).map(s => ({ id: s.id, name: s.nome, price: s.preco, duration: s.duracao_min } as any)));
        setProfessionals(pRes.data || []);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const selectedService = services.find(s => s.id === Number(formData.serviceId));
            const selectedProf = professionals.find(p => p.id === Number(formData.professionalId));
            const selectedClient = clients.find(c => c.id === Number(formData.clientId));

            const [hours, minutes] = formData.time.split(':').map(Number);
            const startDateTime = new Date(formData.date);
            startDateTime.setHours(hours, minutes, 0, 0);

            const payload = {
                client_id: formData.clientId ? Number(formData.clientId) : null,
                client_name: selectedClient ? selectedClient.nome : formData.clientName,
                service_name: selectedService ? selectedService.name : 'Serviço Personalizado',
                professional_name: selectedProf ? selectedProf.name : 'Não definido',
                resource_id: Number(formData.professionalId),
                date: startDateTime.toISOString(),
                value: formData.value,
                status: formData.status,
                notes: formData.notes,
                origem: 'interno'
            };

            const { error } = await supabase.from('appointments').insert([payload]);
            if (error) throw error;

            onSuccess();
            onClose();
        } catch (error: any) {
            alert("Erro ao salvar agendamento: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={20} className="text-orange-500" />
                        Novo Agendamento
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X size={24} /></button>
                </header>

                <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto max-h-[80vh] scrollbar-hide">
                    <div className="space-y-4">
                        {/* Cliente */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente</label>
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                                    value={formData.clientId}
                                    onChange={e => setFormData({...formData, clientId: e.target.value, clientName: ''})}
                                >
                                    <option value="">Selecione um cliente cadastrado...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                                <input 
                                    placeholder="Nome (se novo)"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
                                    value={formData.clientName}
                                    onChange={e => setFormData({...formData, clientName: e.target.value, clientId: ''})}
                                />
                            </div>
                        </div>

                        {/* Profissional e Serviço */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profissional</label>
                                <select 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                                    value={formData.professionalId}
                                    onChange={e => setFormData({...formData, professionalId: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviço</label>
                                <select 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                                    value={formData.serviceId}
                                    onChange={e => {
                                        const s = services.find(s => s.id === Number(e.target.value));
                                        setFormData({...formData, serviceId: e.target.value, value: s?.price || 0});
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Data e Hora */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                                <input 
                                    type="date"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none"
                                    value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora</label>
                                <input 
                                    type="time"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none"
                                    value={formData.time}
                                    onChange={e => setFormData({...formData, time: e.target.value})}
                                />
                            </div>
                        </div>

                        {/* Valor e Status */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                                <input 
                                    type="number"
                                    className="w-full bg-white border-2 border-orange-100 rounded-2xl px-4 py-3 outline-none text-orange-600 font-black text-lg"
                                    value={formData.value}
                                    onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Inicial</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none"
                                    value={formData.status}
                                    onChange={e => setFormData({...formData, status: e.target.value})}
                                >
                                    <option value="agendado">Agendado</option>
                                    <option value="confirmado">Confirmado</option>
                                    <option value="bloqueado">Bloqueado</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações</label>
                            <textarea 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none h-24 resize-none"
                                placeholder="Algum detalhe importante?"
                                value={formData.notes}
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[24px] font-black shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> FINALIZAR AGENDAMENTO</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewAppointmentModal;
