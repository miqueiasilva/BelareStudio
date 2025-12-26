import React, { useState } from 'react';
import { 
    Globe, Settings, MessageSquare, BarChart2, ExternalLink, 
    Copy, CheckCircle, Share2, Save, Eye, Star, MessageCircle 
} from 'lucide-react';
import Card from '../shared/Card';
import ToggleSwitch from '../shared/ToggleSwitch';
import { mockOnlineConfig, mockReviews, mockAnalytics } from '../../data/mockData';
import { Review } from '../../types';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';

// Helper for Tabs - Ajustado para melhor área de toque e transição
const TabButton = ({ id, label, active, onClick, icon: Icon }: any) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-5 py-4 border-b-2 transition-all font-bold text-sm whitespace-nowrap min-h-[48px] ${
            active 
            ? 'border-orange-500 text-orange-600 bg-orange-50/50' 
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
        }`}
    >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {label}
    </button>
);

const AgendaOnlineView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'geral' | 'regras' | 'avaliacoes' | 'analytics'>('geral');
    const [config, setConfig] = useState(mockOnlineConfig);
    const [reviews, setReviews] = useState(mockReviews);
    const [replyText, setReplyText] = useState<{ [key: number]: string }>({});

    const handleCopyLink = () => {
        const baseUrl = window.location.href.split('#')[0];
        navigator.clipboard.writeText(`${baseUrl}#/public-preview`);
        alert('Link copiado!');
    };

    const openPreview = () => {
        window.location.hash = '/public-preview';
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header: Empilha em mobile, linha em desktop */}
            <header className="bg-white border-b border-slate-200 px-4 py-4 sm:px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Globe className="text-blue-500 w-5 h-5 sm:w-6 sm:h-6" />
                        Agenda Online
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium">Link público para seus clientes.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                     <button onClick={openPreview} className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-2 text-sm transition-all active:scale-95">
                        <Eye size={18} />
                        Visualizar
                    </button>
                    <button className="flex-1 sm:flex-none justify-center px-4 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-100 flex items-center gap-2 text-sm transition-all active:scale-95">
                        <Save size={18} />
                        Salvar
                    </button>
                </div>
            </header>

            {/* Tabs Roláveis: Crucial para Mobile UX */}
            <div className="bg-white border-b border-slate-200 flex overflow-x-auto scrollbar-hide flex-shrink-0 touch-pan-x">
                <div className="flex px-2">
                    <TabButton id="geral" label="Geral" icon={Settings} active={activeTab === 'geral'} onClick={setActiveTab} />
                    <TabButton id="regras" label="Regras" icon={CheckCircle} active={activeTab === 'regras'} onClick={setActiveTab} />
                    <TabButton id="avaliacoes" label="Avaliações" icon={Star} active={activeTab === 'avaliacoes'} onClick={setActiveTab} />
                    <TabButton id="analytics" label="Desempenho" icon={BarChart2} active={activeTab === 'analytics'} onClick={setActiveTab} />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                
                {/* TAB: GERAL */}
                {activeTab === 'geral' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-6xl mx-auto">
                        <Card title="Status do Link">
                            <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="pr-4">
                                    <p className="font-bold text-slate-800 text-sm">Agendamentos Online</p>
                                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Permitir que clientes agendem via link.</p>
                                </div>
                                <ToggleSwitch on={config.isActive} onClick={() => setConfig({...config, isActive: !config.isActive})} />
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu Link Público</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    {/* Link Input com Elipse e Padding ajustado */}
                                    <div className="flex-1 flex items-center px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm overflow-hidden select-all">
                                        <span className="truncate font-medium">
                                            {window.location.host}/bela/{config.slug}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 h-[48px]">
                                        <button onClick={handleCopyLink} className="flex-1 sm:flex-none p-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors shadow-sm" title="Copiar">
                                            <Copy size={20} />
                                        </button>
                                        <button className="flex-1 sm:flex-none p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg shadow-green-100" title="WhatsApp">
                                            <Share2 size={20} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 ml-1">
                                    <ExternalLink size={12} className="text-orange-400" />
                                    Este é o endereço que você deve colocar na Bio do Instagram.
                                </p>
                            </div>
                        </Card>

                        <Card title="Identidade Visual">
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nome do Estúdio</label>
                                    <input 
                                        value={config.studioName} 
                                        onChange={(e) => setConfig({...config, studioName: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Descrição</label>
                                    <textarea 
                                        value={config.description} 
                                        onChange={(e) => setConfig({...config, description: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-100 focus:border-orange-400 outline-none h-24 resize-none transition-all text-sm font-medium text-slate-600"
                                    />
                                </div>
                             </div>
                        </Card>
                    </div>
                )}

                {/* Resto das abas seguem lógica similar de grid e padding... */}
                {activeTab === 'regras' && (
                    <div className="max-w-3xl mx-auto py-8 text-center text-slate-400 italic">
                        Configurações de horários e intervalos.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgendaOnlineView;