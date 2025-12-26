import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Store, Save, Loader2, MapPin, Phone, 
    Globe, Camera, Image as ImageIcon, Bell, Scissors, Clock, Wallet, Info, Plus
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';
import { supabase } from '../../services/supabaseClient';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
];

const ConfiguracoesView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('studio');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Referências para Inputs de Arquivo
    const coverInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Estado dos Dados do Estúdio
    const [studioData, setStudioData] = useState<any>({
        id: null,
        studio_name: '',
        address: '',
        phone: '',
        general_notice: '',
        cover_image_url: null,
        logo_image_url: null,
        work_schedule: {}
    });

    // Estados temporários para arquivos pendentes de upload
    const [pendingCover, setPendingCover] = useState<File | null>(null);
    const [pendingLogo, setPendingLogo] = useState<File | null>(null);
    const [previews, setPreviews] = useState({ cover: '', logo: '' });

    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('studio_settings').select('*').maybeSingle();
            if (data) {
                setStudioData(data);
                setPreviews({ cover: data.cover_image_url || '', logo: data.logo_image_url || '' });
            }
        } catch (e) {
            showToast("Erro ao carregar dados", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // 1. Função de Upload Genérica
    const uploadAsset = async (file: File, type: 'cover' | 'logo') => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${type}_${Date.now()}.${fileExt}`;
        const filePath = `${studioData.id || 'new'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('branding')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('branding')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    // 2. Orquestrador de Salvamento (Main Logic)
    const handleSaveStudio = async () => {
        setIsSaving(true);
        try {
            let finalCoverUrl = studioData.cover_image_url;
            let finalLogoUrl = studioData.logo_image_url;

            // Upload de imagens se houver arquivos novos selecionados
            if (pendingCover) finalCoverUrl = await uploadAsset(pendingCover, 'cover');
            if (pendingLogo) finalLogoUrl = await uploadAsset(pendingLogo, 'logo');

            const payload = {
                studio_name: studioData.studio_name,
                address: studioData.address,
                phone: studioData.phone,
                general_notice: studioData.general_notice,
                work_schedule: studioData.work_schedule,
                cover_image_url: finalCoverUrl,
                logo_image_url: finalLogoUrl
            };

            const { error } = studioData.id 
                ? await supabase.from('studio_settings').update(payload).eq('id', studioData.id)
                : await supabase.from('studio_settings').insert([payload]);

            if (error) throw error;

            showToast("Alterações publicadas com sucesso!");
            setPendingCover(null);
            setPendingLogo(null);
            fetchData();
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'logo') => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (type === 'cover') {
            setPendingCover(file);
            setPreviews(prev => ({ ...prev, cover: URL.createObjectURL(file) }));
        } else {
            setPendingLogo(file);
            setPreviews(prev => ({ ...prev, logo: URL.createObjectURL(file) }));
        }
    };

    if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0 z-10">
                <div className="p-6 border-b border-slate-100 h-20 flex items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">Configurações</h2>
                </div>
                <nav className="p-4 space-y-1">
                    <button onClick={() => setActiveTab('studio')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold ${activeTab === 'studio' ? 'bg-orange-50 text-orange-600' : 'text-slate-500'}`}>
                        <Store size={18} /> Estúdio
                    </button>
                    {/* Outras abas... */}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    <section className="space-y-6 animate-in fade-in duration-300">
                        <Card title="Identidade da Marca" icon={<ImageIcon className="w-5 h-5" />}>
                            <div className="space-y-6">
                                {/* Upload de Logo */}
                                <div className="flex items-center gap-6">
                                    <div className="relative w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group">
                                        {previews.logo ? (
                                            <img src={previews.logo} className="w-full h-full object-cover" alt="Logo" />
                                        ) : (
                                            <Camera className="text-slate-300" size={32} />
                                        )}
                                        <button 
                                            onClick={() => logoInputRef.current?.click()}
                                            className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold"
                                        >
                                            {/* FIXED: Plus icon is now imported correctly */}
                                            <Plus size={16} /> Alterar Logo
                                        </button>
                                        <input type="file" ref={logoInputRef} className="hidden" onChange={e => handleFileChange(e, 'logo')} accept="image/*" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-700">Logo do Estúdio</h4>
                                        <p className="text-xs text-slate-400">Aparecerá no avatar da página de agendamento.</p>
                                    </div>
                                </div>

                                {/* Upload de Capa */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Banner da Página Pública</label>
                                    <div className="relative w-full h-40 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden group">
                                        {previews.cover ? (
                                            <img src={previews.cover} className="w-full h-full object-cover" alt="Capa" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                                <ImageIcon size={40} />
                                                <span className="text-xs font-bold mt-2">Nenhum banner configurado</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button onClick={() => coverInputRef.current?.click()} className="bg-white text-slate-800 px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
                                                <Camera size={16} /> Escolher Imagem
                                            </button>
                                        </div>
                                        <input type="file" ref={coverInputRef} className="hidden" onChange={e => handleFileChange(e, 'cover')} accept="image/*" />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card title="Dados Gerais" icon={<Store className="w-5 h-5" />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                                    <input value={studioData.studio_name} onChange={e => setStudioData({...studioData, studio_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                                    <input value={studioData.phone} onChange={e => setStudioData({...studioData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500" />
                                </div>
                            </div>
                        </Card>
                    </section>

                    <div className="flex justify-end pt-4">
                        <button 
                            onClick={handleSaveStudio}
                            disabled={isSaving}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-orange-100 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            Salvar e Publicar Alterações
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ConfiguracoesView;