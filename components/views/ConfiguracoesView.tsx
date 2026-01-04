
import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Store, Save, Loader2, MapPin, Phone, 
    Globe, Camera, Image as ImageIcon, Instagram, 
    Layout, CreditCard, Clock, Calendar, AlertCircle,
    ArrowLeft, Hash, Navigation, Mail, Smartphone
} from 'lucide-react';
import Card from '../shared/Card';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import SettingsHub from '../settings/SettingsHub';
import PaymentSettings from '../settings/PaymentSettings';
import UnderConstruction from '../settings/UnderConstruction';

// --- Subcomponente: BusinessSettings (O Perfil do Negócio) ---
const BusinessSettings = ({ onBack }: { onBack: () => void }) => {
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [formData, setFormData] = useState({
        studio_name: '',
        whatsapp: '',
        email: '',
        address_street: '',
        address_number: '',
        bairro: '',
        instagram_handle: ''
    });

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase.from('studio_settings').select('*').limit(1).maybeSingle();
            if (data) setFormData({
                studio_name: data.studio_name || '',
                whatsapp: data.whatsapp || '',
                email: data.email || '',
                address_street: data.address_street || '',
                address_number: data.address_number || '',
                bairro: data.bairro || '',
                instagram_handle: data.instagram_handle || ''
            });
        };
        fetch();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('studio_settings').upsert({
            ...formData,
            updated_at: new Date()
        }, { onConflict: 'id' });
        
        setIsSaving(false);
        if (!error) {
            setToast({ message: "Dados atualizados!", type: 'success' });
            setTimeout(onBack, 1000);
        } else {
            setToast({ message: "Erro ao salvar.", type: 'error' });
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-32 text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Identidade do Estúdio</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Informações públicas e de contato</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Dados Básicos">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Estúdio</label>
                            <input 
                                value={formData.studio_name}
                                onChange={e => setFormData({...formData, studio_name: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-orange-100"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Instagram (@)</label>
                            <div className="relative">
                                <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    value={formData.instagram_handle}
                                    onChange={e => setFormData({...formData, instagram_handle: e.target.value})}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                    placeholder="@seu.estudio"
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Contato">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">WhatsApp de Lembretes</label>
                            <div className="relative">
                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    value={formData.whatsapp}
                                    onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail Administrativo</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                <Card title="Localização" className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Logradouro (Rua/Av)</label>
                            <div className="relative">
                                <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                    value={formData.address_street}
                                    onChange={e => setFormData({...formData, address_street: e.target.value})}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Número</label>
                            <input 
                                value={formData.address_number}
                                onChange={e => setFormData({...formData, address_number: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none"
                            />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-end z-50">
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-12 py-4 bg-orange-500 text-white font-black rounded-2xl shadow-xl shadow-orange-100 flex items-center gap-2 hover:bg-orange-600 transition-all"
                >
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Salvar Perfil
                </button>
            </div>
        </div>
    );
};

const ConfiguracoesView: React.FC = () => {
    const [subView, setSubView] = useState<'hub' | 'profile' | 'payments' | 'theme' | 'resources' | 'discounts' | 'blocks'>('hub');
    
    // Função para renderizar o conteúdo dinâmico
    const renderSubView = () => {
        switch (subView) {
            case 'hub':
                return (
                    <SettingsHub 
                        onNavigate={(v: any) => setSubView(v)} 
                        onTopLevelNavigate={(view: any) => {
                            // Este hub também gerencia atalhos para a navegação principal da sidebar (via hash ou estado global)
                            if (view === 'dashboard') window.location.hash = '#/';
                            else alert(`Navegando para o módulo: ${view}`);
                        }}
                    />
                );
            case 'profile':
                return <BusinessSettings onBack={() => setSubView('hub')} />;
            case 'payments':
                return <PaymentSettings onBack={() => setSubView('hub')} />;
            case 'theme':
                return <UnderConstruction title="Tema do Sistema" onBack={() => setSubView('hub')} />;
            case 'resources':
                return <UnderConstruction title="Controle de Recursos" onBack={() => setSubView('hub')} />;
            case 'discounts':
                return <UnderConstruction title="Cupons e Descontos" onBack={() => setSubView('hub')} />;
            case 'blocks':
                return <UnderConstruction title="Bloqueios e Indisponibilidades" onBack={() => setSubView('hub')} />;
            default:
                return <SettingsHub onNavigate={(v: any) => setSubView(v)} onTopLevelNavigate={() => {}} />;
        }
    };

    return (
        <div className="h-full bg-slate-50 flex flex-col font-sans overflow-hidden">
            <header className="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0 z-20 shadow-sm text-left">
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3 leading-none">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Settings size={24} />
                    </div>
                    {subView === 'hub' ? 'Configurações' : 'Ajustes Técnicos'}
                </h1>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2 ml-12 leading-none">
                    {subView === 'hub' ? 'Gestão da sua marca e regras do negócio.' : `Menu / ${subView}`}
                </p>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    {renderSubView()}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;
