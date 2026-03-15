
import React, { useState, useEffect } from 'react';
import { Palette, Save, Loader2, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import Toast, { ToastType } from '../shared/Toast';

const PRESET_COLORS = [
    { name: 'Laranja Belare', value: '#f97316' },
    { name: 'Rosa Soft', value: '#ec4899' },
    { name: 'Roxo Elegance', value: '#8b5cf6' },
    { name: 'Azul Moderno', value: '#3b82f6' },
    { name: 'Verde Fresh', value: '#10b981' },
    { name: 'Slate Profissional', value: '#475569' },
    { name: 'Vinho Premium', value: '#991b1b' },
    { name: 'Dourado Luxo', value: '#b45309' },
];

const ThemeSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { activeStudioId } = useStudio();
    const [selectedColor, setSelectedColor] = useState('#f97316');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        if (!activeStudioId) return;

        const fetchTheme = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('studio_settings')
                    .select('theme_color')
                    .eq('studio_id', activeStudioId)
                    .maybeSingle();

                if (error) throw error;
                if (data?.theme_color) {
                    setSelectedColor(data.theme_color);
                }
            } catch (err: any) {
                console.error("Erro ao carregar tema:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTheme();
    }, [activeStudioId]);

    const handleSave = async () => {
        if (!activeStudioId) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('studio_settings')
                .upsert({ 
                    studio_id: activeStudioId, 
                    theme_color: selectedColor,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'studio_id' });

            if (error) throw error;

            // Aplicar a cor imediatamente via CSS Variable
            document.documentElement.style.setProperty('--primary-color', selectedColor);
            
            setToast({ message: "Tema atualizado com sucesso!", type: 'success' });
            setTimeout(onBack, 1000);
        } catch (err: any) {
            setToast({ message: "Erro ao salvar tema: " + err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-4 text-orange-500" size={40} />
                <p className="text-xs font-black uppercase tracking-widest">Carregando paleta...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-500 text-left pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex items-center gap-4 mb-8">
                <button 
                    onClick={onBack} 
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-orange-600 transition-all shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">Tema do Sistema</h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Personalize a cor principal do seu estúdio</p>
                </div>
            </header>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden p-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
                        <Palette size={20} />
                    </div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight">Cores Predefinidas</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {PRESET_COLORS.map((color) => (
                        <button
                            key={color.value}
                            onClick={() => setSelectedColor(color.value)}
                            className={`group relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                                selectedColor === color.value 
                                ? 'border-slate-800 bg-slate-50' 
                                : 'border-slate-100 hover:border-slate-200 bg-white'
                            }`}
                        >
                            <div 
                                className="w-12 h-12 rounded-full shadow-inner flex items-center justify-center"
                                style={{ backgroundColor: color.value }}
                            >
                                {selectedColor === color.value && <Check size={20} className="text-white drop-shadow-md" />}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-tighter text-center ${
                                selectedColor === color.value ? 'text-slate-800' : 'text-slate-400'
                            }`}>
                                {color.name}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="mt-12 p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Visualização em tempo real</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button 
                            className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg transition-all"
                            style={{ backgroundColor: selectedColor }}
                        >
                            Botão Principal
                        </button>
                        <div 
                            className="w-32 h-10 rounded-xl flex items-center justify-center text-white font-black text-[10px] uppercase tracking-widest shadow-md"
                            style={{ backgroundColor: selectedColor }}
                        >
                            Menu Ativo
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white to-transparent flex justify-center pointer-events-none z-50">
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="pointer-events-auto min-w-[240px] px-12 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-[24px] shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {isSaving ? 'Sincronizando...' : 'Aplicar Novo Tema'}
                </button>
            </div>
        </div>
    );
};

export default ThemeSettings;
