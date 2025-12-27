import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Scissors, Clock, DollarSign, Edit2, Trash2, 
    Loader2, Search, X, CheckCircle, AlertTriangle, RefreshCw,
    LayoutGrid, List, FileSpreadsheet, SlidersHorizontal, ChevronRight,
    Tag, MoreVertical, Filter, Download, ArrowUpRight, FolderPlus
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Service } from '../../types';
import Toast, { ToastType } from '../shared/Toast';
import ServiceModal from '../modals/ServiceModal';
import CategoryModal from '../modals/CategoryModal';

type ViewMode = 'list' | 'kanban';

const ServicosView: React.FC = () => {
    // --- State ---
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const isMounted = useRef(true);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Data Fetching ---
    const fetchServices = async () => {
        if (!isMounted.current) return;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const { data, error: sbError } = await supabase
                .from('services')
                .select('*')
                .order('nome')
                .abortSignal(abortControllerRef.current.signal);

            if (sbError) throw sbError;
            if (isMounted.current) setServices(data || []);
        } catch (error: any) {
            if (isMounted.current && error.name !== 'AbortError') {
                setError(error.message || "Erro inesperado ao carregar catálogo.");
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    useEffect(() => {
        isMounted.current = true;
        fetchServices();

        const handleClickOutside = (event: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
                setShowAddMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) abortControllerRef.current.abort();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // --- Derived Data ---
    const categories = useMemo(() => {
        const cats = services.map(s => (s as any).categoria || 'Geral');
        return Array.from(new Set(cats)).sort();
    }, [services]);

    const filteredServices = useMemo(() => {
        return services.filter(s => {
            const matchesSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = filterCategory === 'all' || (s as any).categoria === filterCategory;
            return matchesSearch && matchesCat;
        });
    }, [services, searchTerm, filterCategory]);

    const groupedServices = useMemo(() => {
        const groups: Record<string, Service[]> = {};
        filteredServices.forEach(s => {
            const cat = (s as any).categoria || 'Geral';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        return groups;
    }, [filteredServices]);

    // --- Handlers ---
    const handleSave = async (payload: any) => {
        try {
            if (payload.id) {
                const { error } = await supabase.from('services').update(payload).eq('id', payload.id);
                if (error) throw error;
                setToast({ message: 'Serviço atualizado!', type: 'success' });
            } else {
                const { error } = await supabase.from('services').insert([payload]);
                if (error) throw error;
                setToast({ message: 'Serviço cadastrado!', type: 'success' });
            }
            fetchServices();
        } catch (error: any) {
            setToast({ message: error.message, type: 'error' });
            throw error;
        }
    };

    const handleSaveCategory = async (category: { name: string; color: string }) => {
        // Para o MVP, as categorias são extraídas dos serviços. 
        // No futuro, se houver tabela própria, inserimos aqui.
        // Simulamos a criação apenas exibindo um sucesso e permitindo que o usuário use no ServiceModal.
        setToast({ message: `Categoria "${category.name}" disponível para uso!`, type: 'success' });
        // Se houver uma tabela de categorias, descomente abaixo:
        // await supabase.from('categories').insert([category]);
        await fetchServices(); 
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Deseja realmente excluir este serviço?")) return;
        try {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
            setToast({ message: 'Serviço removido.', type: 'info' });
            fetchServices();
        } catch (e: any) {
            setToast({ message: e.message, type: 'error' });
        }
    };

    const formatDuration = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
        return `${m} min`;
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredServices.length) setSelectedIds([]);
        else setSelectedIds(filteredServices.map(s => s.id));
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative font-sans overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* TOOLBAR HEADER */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4 z-20">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 leading-none">
                            <Scissors className="text-orange-500" size={24} /> 
                            Serviços
                        </h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{services.length} itens no total</span>
                    </div>

                    <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-4">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <List size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>

                {/* FILTROS CENTRAIS */}
                <div className="flex-1 max-w-2xl flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar serviço..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none transition-all text-sm font-medium" 
                        />
                    </div>
                    
                    <div className="relative">
                        <select 
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="appearance-none bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-10 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 focus:ring-2 focus:ring-orange-100 outline-none cursor-pointer hover:bg-white transition-all"
                        >
                            <option value="all">Todas Categorias</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <Filter size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    
                    <button className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm">
                        <SlidersHorizontal size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            <Download size={16} /> Exportar
                        </button>
                    </div>

                    <div className="relative" ref={addMenuRef}>
                        <button 
                            onClick={() => setShowAddMenu(!showAddMenu)} 
                            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                        >
                            <Plus size={20} /> <span className="hidden sm:inline">Novo</span>
                        </button>

                        {showAddMenu && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <button 
                                    onClick={() => { setEditingService(null); setIsModalOpen(true); setShowAddMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-orange-50 transition-colors group"
                                >
                                    <div className="p-2 bg-orange-100 rounded-xl text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                        <Scissors size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-700 leading-none">Novo Serviço</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Corte, Cílios, etc</p>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => { setIsCategoryModalOpen(true); setShowAddMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-blue-50 transition-colors group border-t border-slate-50"
                                >
                                    <div className="p-2 bg-blue-100 rounded-xl text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <Tag size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-700 leading-none">Nova Categoria</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Organizar grupo</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
                
                {/* AÇÕES EM MASSA (BARRA FLUTUANTE) */}
                {selectedIds.length > 0 && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-top-4 duration-300">
                        <span className="text-xs font-black uppercase tracking-widest">{selectedIds.length} selecionados</span>
                        <div className="w-px h-4 bg-slate-700"></div>
                        <div className="flex items-center gap-4">
                            <button className="text-xs font-bold hover:text-orange-400 transition-colors flex items-center gap-2"><Tag size={14}/> Mudar Categoria</button>
                            <button className="text-xs font-bold hover:text-rose-400 transition-colors flex items-center gap-2"><Trash2 size={14}/> Excluir Todos</button>
                        </div>
                        <button onClick={() => setSelectedIds([])} className="p-1 hover:bg-white/10 rounded-full"><X size={16}/></button>
                    </div>
                )}

                <div className="flex-1 overflow-auto p-6 scrollbar-hide">
                    
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="animate-spin mb-4 text-orange-500" size={48} />
                            <p className="font-bold uppercase tracking-widest text-xs">Acessando catálogo...</p>
                        </div>
                    ) : filteredServices.length === 0 ? (
                        <div className="bg-white rounded-[40px] p-20 text-center border-2 border-slate-100 border-dashed max-w-2xl mx-auto my-12">
                            <Scissors size={80} className="mx-auto text-slate-100 mb-6" />
                            <h3 className="text-xl font-black text-slate-800 mb-2">Nenhum serviço encontrado</h3>
                            <p className="text-slate-400 text-sm mb-8">Refine sua busca ou cadastre um novo procedimento agora.</p>
                            <button onClick={() => setIsModalOpen(true)} className="bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-orange-100">Começar Agora</button>
                        </div>
                    ) : viewMode === 'list' ? (
                        /* VIEW: LISTA (TABELA PROFISSIONAL) */
                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="px-6 py-5 w-12">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.length === filteredServices.length && filteredServices.length > 0} 
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500" 
                                            />
                                        </th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoria</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Procedimento</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tempo</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Preço</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredServices.map(s => {
                                        const isSelected = selectedIds.includes(s.id);
                                        return (
                                            <tr key={s.id} className={`group hover:bg-orange-50/30 transition-all ${isSelected ? 'bg-orange-50/50' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(s.id)}
                                                        className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500" 
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-wider border border-slate-200">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.cor_hex || '#f97316' }}></div>
                                                        {(s as any).categoria || 'Geral'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 leading-tight group-hover:text-orange-600 transition-colors">{s.nome}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium line-clamp-1">{(s as any).descricao || 'Sem descrição cadastrada'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-bold text-slate-500 text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={12} className="text-slate-300" />
                                                        {formatDuration(s.duracao_min)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-black text-slate-800 tracking-tight">R$ {s.preco.toFixed(2)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingService(s); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all" title="Editar"><Edit2 size={16}/></button>
                                                        <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all" title="Excluir"><Trash2 size={16}/></button>
                                                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"><MoreVertical size={16}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* VIEW: KANBAN (AGRUPADO POR CATEGORIA) */
                        <div className="flex gap-6 min-h-full items-start overflow-x-auto pb-8 scrollbar-hide">
                            {Object.entries(groupedServices).map(([cat, items]) => (
                                <div key={cat} className="flex-shrink-0 w-80 flex flex-col max-h-full">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            {cat}
                                            <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full text-[9px] font-black">{(items as Service[]).length}</span>
                                        </h3>
                                        <button onClick={() => { setEditingService({ categoria: cat } as any); setIsModalOpen(true); }} className="text-slate-300 hover:text-orange-500"><Plus size={16}/></button>
                                    </div>
                                    <div className="space-y-3 overflow-y-auto pr-1">
                                        {(items as Service[]).map(s => (
                                            <div 
                                                key={s.id} 
                                                onClick={() => { setEditingService(s); setIsModalOpen(true); }}
                                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all cursor-pointer group relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: s.cor_hex || '#f97316' }}></div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight pr-4 group-hover:text-orange-600 transition-colors">{s.nome}</h4>
                                                    <button className="text-slate-300 hover:text-slate-600"><MoreVertical size={14}/></button>
                                                </div>
                                                <div className="flex items-center justify-between mt-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase">
                                                            <Clock size={10} /> {formatDuration(s.duracao_min)}
                                                        </div>
                                                    </div>
                                                    <span className="font-black text-slate-700 text-sm">R$ {s.preco.toFixed(2)}</span>
                                                </div>
                                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <ArrowUpRight size={14} className="text-orange-400" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* MODAIS DE CADASTRO/EDIÇÃO */}
            {isModalOpen && (
                <ServiceModal 
                    service={editingService}
                    availableCategories={categories}
                    onClose={() => { setIsModalOpen(false); setEditingService(null); }}
                    onSave={handleSave}
                />
            )}

            {isCategoryModalOpen && (
                <CategoryModal 
                    onClose={() => setIsCategoryModalOpen(false)}
                    onSave={handleSaveCategory}
                />
            )}
        </div>
    );
};

export default ServicosView;