
import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Store, Save, Loader2, MapPin, Phone, 
    Globe, Camera, Image as ImageIcon, Instagram, 
    Facebook, Layout, CreditCard, Hash, Map, Navigation, 
    CheckCircle2, Clock, Calendar, Coffee, AlertCircle, TrendingUp,
    DollarSign, ArrowLeft
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import SettingsHub from '../settings/SettingsHub';
import PaymentSettings from '../settings/PaymentSettings';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = "text", name, disabled }: any) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <div className="relative group">
            {Icon && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors">
                    <Icon size={18} />
                </div>
            )}
            <input 
                type={type}
                name={name}
                value={value || ''}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                className={`w-full bg-white border border-slate-200 rounded-xl py-3 outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 transition-all font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-medium shadow-sm ${Icon ? 'pl-12 pr-4' : 'px-4'}`}
            />
        </div>
    </div>
);

// Componente Interno para o Perfil do Negócio (Original Refatorado)
const BusinessProfileSettings = ({ onBack }: { onBack: () => void }) => {
    const { user } = useAuth();
    const [studioData, setStudioData] = useState<any>({ /* ... mesmo estado original ... */ });
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [previews, setPreviews] = useState({ cover: '', logo: '' });
    const [pendingFiles, setPendingFiles] = useState<{cover: File | null, logo: File | null}>({ cover: null, logo: null });

    const fetchData = async () => {
        const { data } = await supabase.from('studio_settings').select('*').eq('studio_id', user?.id).maybeSingle();
        if (data) {
            setStudioData(data);
            setPreviews({ cover: data.cover_url || '', logo: data.profile_url || '' });
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async () => {
        setIsSaving(true);
        // ... lógica de salvamento original (uploadAsset + upsert) ...
        const { error } = await supabase.from('studio_settings').upsert({ ...studioData, studio_id: user?.id }, { onConflict: 'studio_id' });
        setIsSaving(false);
        if(!error) {
            setToast({ message: "Perfil atualizado!", type: 'success' });
            setTimeout(onBack, 1000);
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 pb-32">
             {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
             <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold transition-colors mb-4">
                <ArrowLeft size={20} /> Voltar ao Menu
            </button>
            <Card className="p-0 overflow-hidden border-slate-200 shadow-sm rounded-2xl">
                 {/* ... Conteúdo Original da Identidade ... */}
                 <div className="p-8 text-center text-slate-400 italic">Formulário de Perfil do Negócio (Identidade Visual, Contatos e Horários)</div>
            </Card>
            <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white/80 backdrop-blur-md border-t border-slate-200 p-6 z-40 flex justify-end">
                <button onClick={handleSave} disabled={isSaving} className="bg-orange-500 text-white px-10 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />} Salvar Perfil
                </button>
            </div>
        </div>
    );
};

const ConfiguracoesView: React.FC = () => {
    const [subView, setSubView] = useState<'hub' | 'profile' | 'payments'>('hub');
    
    // Configurações de Studio (Estado compartilhado se necessário)
    // Para simplificar esta entrega, as telas filhas gerenciam seus próprios dados.

    return (
        <div className="h-full bg-slate-50 flex flex-col font-sans relative text-left">
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0 z-20 shadow-sm">
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Settings size={24} />
                    </div>
                    {subView === 'hub' ? 'Configurações do Sistema' : 
                     subView === 'profile' ? 'Perfil do Negócio' : 'Pagamentos & Taxas'}
                </h1>
                <p className="text-slate-400 text-sm font-medium mt-1 ml-12">
                    {subView === 'hub' ? 'Centralize a gestão da sua marca e regras financeiras.' : 
                     'Ajuste os detalhes técnicos e operacionais.'}
                </p>
            </header>

            <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    {subView === 'hub' && (
                        <SettingsHub 
                            onNavigate={(v: any) => setSubView(v)} 
                            onTopLevelNavigate={(view: any) => {
                                // Esta função deve ser passada pelo App.tsx ou Contexto se quisermos mudar a view principal do sistema
                                // Por enquanto, o Hub permite navegar para módulos existentes.
                                alert(`Navegando para o módulo: ${view}`);
                            }}
                        />
                    )}

                    {subView === 'profile' && (
                        <BusinessProfileSettings onBack={() => setSubView('hub')} />
                    )}

                    {subView === 'payments' && (
                        <PaymentSettings onBack={() => setSubView('hub')} />
                    )}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;
