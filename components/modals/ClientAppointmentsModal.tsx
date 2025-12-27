
import React, { useState, useEffect } from 'react';
import { 
    X, Phone, Calendar, Clock, Scissors, AlertCircle, 
    CheckCircle2, ChevronRight, ArrowLeft, Loader2, Trash2 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { format, differenceInHours, isAfter, parseISO } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

interface ClientAppointmentsModalProps {
    onClose: () => void;
}

const ClientAppointmentsModal: React.FC<ClientAppointmentsModalProps> = ({ onClose }) => {
    const [step, setStep] = useState<'identify' | 'list'>('identify');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [policyHours, setPolicyHours] = useState(2); // Default 2h
    const [activeTab, setActiveTab] = useState<'next' | 'history'>('next');

    // Carrega a política de cancelamento do estúdio
    useEffect(() => {
        const fetchPolicy = async () => {
            const { data } = await supabase.from('studio_settings').select('cancellation_policy_hours').maybeSingle();
            if (data?.cancellation_policy_hours) setPolicyHours(data.cancellation_policy_hours);
        };
        fetchPolicy();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10) return;

        setLoading(true);
        try {
            // Busca agendamentos vinculados ao whatsapp (ajustado para a estrutura do seu banco)
            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('client_whatsapp', phone.replace(/\D/g, '')) // Limpa máscara se houver
                .order('date', { ascending: true });

            if (error) throw error;
            setAppointments(data || []);
            setStep('list');
        } catch (e) {
            alert("Erro ao buscar agendamentos. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelAppointment = async (app: any) => {
        const now = new Date();
        const appDate = parseISO(app.date);
        const hoursDiff = differenceInHours(appDate, now);

        if (hoursDiff < policyHours) {
            alert(`Cancelamento não permitido. A política do estúdio exige no mínimo ${policyHours}h de antecedência.`);
            return;
        }

        const reason = prompt("Por favor, informe o motivo do cancelamento:");
        if (reason === null) return; // Usuário cancelou o prompt

        setLoading(true);
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ 
                    status: 'cancelado',
                    cancellation_reason: reason,
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', app.id);

            if (error) throw error;

            // Atualiza lista local
            setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'cancelado' } : a));
            alert("Agendamento cancelado com sucesso.");
        } catch (e) {
            alert("Erro ao processar cancelamento.");
        } finally {
            setLoading(false);
        }
    };

    const filteredList = appointments.filter(app => {
        const isPast = !isAfter(parseISO(app.date), new Date());
        return activeTab === 'next' ? !isPast && app.status !== 'cancelado' : isPast || app.status === 'cancelado';
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                <header className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        {step === 'list' && (
                            <button onClick={() => setStep('identify')} className="p-2 bg-white rounded-xl text-slate-400 hover:text-orange-500 shadow-sm transition-all">
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div>
                            <h3 className="font-black text-slate-800">Meus Agendamentos</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consulta e Cancelamento</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24}/></button>
                </header>

                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {step === 'identify' ? (
                        <div className="py-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600">
                                <Phone size={32} />
                            </div>
                            <div className="max-w-xs mx-auto">
                                <h4 className="text-lg font-black text-slate-800">Identifique-se</h4>
                                <p className="text-sm text-slate-500 mt-1">Informe seu WhatsApp para localizar seus horários marcados.</p>
                            </div>
                            <form onSubmit={handleSearch} className="space-y-4 max-w-xs mx-auto">
                                <input 
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="(00) 00000-0000"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-center font-black text-lg text-slate-700 outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 transition-all"
                                />
                                <button 
                                    disabled={loading || phone.length < 10}
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : "Consultar Agenda"}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* TABS */}
                            <div className="flex p-1 bg-slate-100 rounded-2xl">
                                <button 
                                    onClick={() => setActiveTab('next')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'next' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Próximos
                                </button>
                                <button 
                                    onClick={() => setActiveTab('history')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Histórico
                                </button>
                            </div>

                            {/* LISTA */}
                            <div className="space-y-3">
                                {filteredList.length === 0 ? (
                                    <div className="py-20 text-center text-slate-400 italic text-sm">
                                        Nenhum agendamento encontrado nesta categoria.
                                    </div>
                                ) : (
                                    filteredList.map(app => (
                                        <div key={app.id} className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all flex gap-4 items-center">
                                            {/* Data Badge */}
                                            <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100">
                                                <span className="text-[10px] font-black text-slate-400 uppercase leading-none">{format(parseISO(app.date), 'MMM', { locale: pt })}</span>
                                                <span className="text-xl font-black text-slate-800 leading-none">{format(parseISO(app.date), 'dd')}</span>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-800 text-sm truncate">{app.service_name}</h4>
                                                <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase mt-0.5">
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {format(parseISO(app.date), 'HH:mm')}</span>
                                                    <span className="flex items-center gap-1"><Scissors size={10} /> {app.professional_name}</span>
                                                </div>
                                            </div>

                                            {/* Status / Ação */}
                                            <div className="flex-shrink-0">
                                                {activeTab === 'next' ? (
                                                    <button 
                                                        onClick={() => handleCancelAppointment(app)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                                        title="Cancelar Horário"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                ) : (
                                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter ${
                                                        app.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                        {app.status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                <p className="text-[10px] text-orange-700 font-bold leading-relaxed">
                                    <AlertCircle size={10} className="inline mr-1" />
                                    Política de Cancelamento: Alterações são permitidas até {policyHours} horas antes do início do serviço.
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ClientAppointmentsModal;
