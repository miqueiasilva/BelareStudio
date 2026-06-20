import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    Plus, Scissors, Clock, Edit2, Trash2, 
    Loader2, Search, List, LayoutGrid,
    Tag, Filter, ChevronDown
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useStudio } from '../../contexts/StudioContext';
import { Service } from '../../types';
import { useConfirm } from '../../utils/useConfirm';
import toast from 'react-hot-toast';
import Toast, { ToastType } from '../shared/Toast';
import ServiceModal from '../modals/ServiceModal';
import CategoryManagerModal from '../modals/CategoryManagerModal';

type ViewMode = 'list' | 'kanban';

const ServicosView: React.FC = () => {
    const { activeStudioId } = useStudio();
    const { confirm, ConfirmDialogComponent } = useConfirm();
    const [services, setServices] = useState<Service[]>([]);
    const [dbCategories, setDbCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const isMounted = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Busca Categorias do Banco (Fonte de Verdade Única)
    const fetchCategories = useCallback(async () => {
        if (!activeStudioId) return;
        try {
            const { data, error } = await supabase
                .from('service_categories')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('name');
            if (error) throw error;
            setDbCategories(data || []);
        } catch (e) {
            console.error("Erro ao carregar categorias:", e);
        }
    }, [activeStudioId]);

    const fetchServices = useCallback(async () => {
        if (!isMounted.current || !activeStudioId) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setLoading(true);

        try {
            const { data, error: sbError } = await supabase
                .from('services')
                .select('*')
                .eq('studio_id', activeStudioId)
                .order('nome')
                .abortSignal(abortControllerRef.current.signal);

            if (sbError) throw sbError;
            if (isMounted.current) setServices(data || []);
        } catch (error: any) {
            const isAbortError = error.name === 'AbortError' || error.message?.includes('aborted');
            if (isMounted.current && !isAbortError) {
                console.error(error.message || "Erro inesperado.");
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [activeStudioId]);

    useEffect(() => {
        isMounted.current = true;
        fetchServices();
        fetchCategories();

        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [activeStudioId, fetchCategories, fetchServices]);

    const filteredServices = useMemo(() => {
        if (!Array.isArray(services)) return [];
        return services.filter(s => {
            const name = (s?.nome || '').toLowerCase();
            const term = (searchTerm || '').toLowerCase();
            const matchesSearch = name.includes(term);
            
            const categoryName = (s as any)?.categoria || 'Sem Categoria';
            const matchesCat = filterCategory === 'all' || categoryName === filterCategory;
            return matchesSearch && matchesCat;
        });
    }, [services, searchTerm, filterCategory]);

    const groupedServices = useMemo(() => {
        const groups: Record<string, Service[]> = {};
        
        // Inicializa grupos com as categorias REAIS do banco
        dbCategories?.forEach(cat => { 
            if (cat?.name) groups[cat.name] = []; 
        });
        
        if (!groups['Sem Categoria']) groups['Sem Categoria'] = [];

        filteredServices?.forEach(s => {
            const cat = (s as any)?.categoria || 'Sem Categoria';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        return groups;
    }, [filteredServices, dbCategories]);

    const handleSave = async (payload: any) => {
        if (!activeStudioId) return;
        try {
            const dataToSave = { ...payload, studio_id: activeStudioId };
            const isEdit = !!payload.id;
            const { error } = isEdit 
                ? await supabase.from('services').update(dataToSave).eq('id', payload.id)
                : await supabase.from('services').insert([dataToSave]);
            
            if (error) throw error;
            
            setToast({ message: isEdit ? 'Serviço atualizado!' : 'Novo serviço cadastrado!', type: 'success' });
            fetchServices();
            setIsModalOpen(false);
        } catch (error: any) { 
            setToast({ message: error.message, type: 'error' }); 
        }
    };

    const handleDelete = async (id: number) => {
        const isConfirmed = await confirm({
            title: 'Excluir Serviço',
            message: 'Deseja realmente excluir este serviço?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            type: 'danger'
        });

        if (isConfirmed) {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (!error) { 
                fetchServices(); 
                toast.success('Serviço removido.'); 
            } else {
                toast.error('Erro ao remover serviço.');
            }
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans overflow-hidden text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 z-20 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
                        <Scissors size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Catálogo de Serviços</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestão Técnica</p>
                    </div>
                </div>

                <div className="flex flex-row items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 flex-shrink-0">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Visualizar em Lista"
                        >
                            <List size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('kanban')}
                            className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${viewMode === 'kanban' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Visualizar em Kanban"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-grow md:flex-grow-0 justify-end">
                        <button 
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="flex-1 md:flex-initial bg-white border border-slate-200 text-slate-600 px-3 py-2.5 rounded-xl font-black text-[11px] hover:bg-slate-50 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-sm active:bg-slate-100"
                        >
                            <Tag size={15} /> <span>Categorias</span>
                        </button>

                        <button 
                            onClick={() => { setEditingService(null); setIsModalOpen(true); }} 
                            className="flex-1 md:flex-initial bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-black text-[11px] shadow-lg shadow-orange-100 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5"
                        >
                            <Plus size={16} /> <span>Novo Serviço</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-20 flex flex-col md:flex-row gap-3 md:gap-4 flex-shrink-0">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar serviço..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-50 focus:border-orange-400 focus:bg-white outline-none font-bold text-slate-700 text-sm transition-all shadow-sm" 
                    />
                </div>
                <div className="relative md:min-w-[220px]">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500">
                        <Filter size={16} />
                    </div>
                    <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl appearance-none outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-400 font-black text-[11px] uppercase tracking-wider text-slate-600 cursor-pointer transition-all shadow-sm"
                    >
                        <option value="all">Todas as Categorias</option>
                        {dbCategories?.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                </div>
            </div>

            <main className="flex-1 overflow-auto p-6 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando Catálogo...</p>
                    </div>
                ) : filteredServices?.length === 0 ? (
                    <div className="py-32 text-center flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mb-6 text-slate-300">
                            <Scissors size={40} />
                        </div>
                        <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter">Nenhum serviço encontrado</h3>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="max-w-6xl mx-auto w-full">
                        {/* Desktop View: Table */}
                        <div className="hidden md:block bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="p-6">Procedimento</th>
                                        <th className="p-6">Categoria</th>
                                        <th className="p-6 text-center">Duração</th>
                                        <th className="p-6 text-right">Preço</th>
                                        <th className="p-6 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredServices?.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: s.cor_hex || '#f97316' }}></div>
                                                    <p className="font-black text-slate-800 group-hover:text-orange-600 transition-colors">{s.nome}</p>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                                    {(s as any).categoria || 'Sem Categoria'}
                                                </span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className="text-xs font-black text-slate-500 flex items-center justify-center gap-1.5"><Clock size={14} className="text-slate-300" /> {s.duracao_min} min</span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <span className="font-black text-slate-800 text-lg">R$ {Number(s.preco).toFixed(2)}</span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => { setEditingService(s); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all" title="Editar"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Excluir"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View: High-Quality Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredServices?.map(s => (
                                <div 
                                    key={s.id} 
                                    className="bg-white p-4 rounded-[28px] border border-slate-200 shadow-sm active:bg-slate-50/70 transition-all relative overflow-hidden flex items-stretch justify-between gap-3"
                                >
                                    {/* Left color bar indicator */}
                                    <div 
                                        className="w-1.5 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: s.cor_hex || '#f97316' }}
                                    ></div>
                                    
                                    {/* Content info */}
                                    <div className="flex-1 min-w-0 pl-1 pr-1 flex flex-col justify-between py-0.5 text-left">
                                        <div>
                                            <h4 className="font-black text-slate-800 text-sm leading-snug tracking-tight mb-2 break-words">
                                                {s.nome}
                                            </h4>
                                            
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex-shrink-0">
                                                    {(s as any).categoria || 'Sem Categoria'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                    <Clock size={11} className="text-slate-300 animate-pulse" /> {s.duracao_min} min
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-3">
                                            <span className="font-extrabold text-slate-800 text-lg leading-none">
                                                R$ {Number(s.preco).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action buttons (spacious, finger-friendly targets) */}
                                    <div className="flex flex-col justify-center items-center gap-2 flex-shrink-0 pl-1">
                                        <button 
                                            onClick={() => { setEditingService(s); setIsModalOpen(true); }} 
                                            className="p-3 bg-slate-50 border border-slate-200 text-slate-500 active:bg-orange-50 active:border-orange-200 active:text-orange-600 rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                            title="Editar serviço"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(s.id)} 
                                            className="p-3 bg-rose-50/50 border border-rose-100 text-rose-400 active:bg-rose-100 active:text-rose-600 rounded-2xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                                            title="Remover serviço"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-4 md:gap-6 pb-10 min-h-full items-start overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar select-none">
                        {Object.entries(groupedServices)?.map(([category, items]) => (
                            <div key={category} className="flex-shrink-0 w-[280px] sm:w-80 flex flex-col snap-start">
                                <header className="flex items-center justify-between mb-3 px-2">
                                    <h3 className="font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] flex items-center gap-1.5">
                                        <Tag size={13} className="text-orange-500" />
                                        <span className="truncate max-w-[180px]">{category}</span>
                                        {/* FIX: Explicitly casting 'items' to Service[] to fix the 'unknown' type error */}
                                        <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-lg ml-0.5 font-black">{(items as Service[])?.length || 0}</span>
                                    </h3>
                                </header>
                                <div className="space-y-3.5 pr-2">
                                    {/* FIX: Explicitly casting 'items' to Service[] to fix the 'unknown' type error */}
                                    {(items as Service[])?.map(s => (
                                        <div key={s.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group relative overflow-hidden cursor-pointer text-left" onClick={() => { setEditingService(s); setIsModalOpen(true); }}>
                                            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: s.cor_hex || '#f97316' }}></div>
                                            <h4 className="font-black text-slate-800 leading-tight group-hover:text-orange-600 transition-colors mb-4 text-sm">{s.nome}</h4>
                                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1"><Clock size={12} /> {s.duracao_min} MIN</span>
                                                <span className="text-base font-black text-slate-800">R$ {Number(s.preco).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isModalOpen && (
                <ServiceModal 
                    service={editingService} 
                    dbCategories={dbCategories}
                    onClose={() => { setIsModalOpen(false); setEditingService(null); }} 
                    onSave={handleSave} 
                    onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
                />
            )}

            {isCategoryModalOpen && (
                <CategoryManagerModal 
                    onClose={() => setIsCategoryModalOpen(false)} 
                    onUpdate={() => { fetchCategories(); fetchServices(); }}
                />
            )}
            <ConfirmDialogComponent />
        </div>
    );
};

export default ServicosView;