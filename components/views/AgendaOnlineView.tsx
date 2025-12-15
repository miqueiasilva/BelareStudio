
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
import { pt } from 'date-fns/locale';

// Helper for Tabs
const TabButton = ({ id, label, active, onClick, icon: Icon }: any) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors font-medium text-sm ${
            active ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
        }`}
    >
        <Icon className="w-4 h-4" />
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
        alert('Link copiado para a área de transferência!');
    };

    const handleReplySubmit = (reviewId: number) => {
        const text = replyText[reviewId];
        if (!text) return;
        
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply: text } : r));
        setReplyText(prev => ({ ...prev, [reviewId]: '' }));
        alert('Resposta enviada com sucesso!');
    };

    const openPreview = () => {
        // Navigate in the current tab via hash to avoid sandbox 404/blob errors
        window.location.hash = '/public-preview';
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Top Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Globe className="text-blue-500" />
                        Agenda Online
                    </h1>
                    <p className="text-slate-500 text-sm">Gerencie como seus clientes agendam pelo link público.</p>
                </div>
                <div className="flex gap-3">
                     <button onClick={openPreview} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Visualizar
                    </button>
                    <button className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 shadow-sm flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        Salvar Alterações
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-200 px-6 flex gap-2">
                <TabButton id="geral" label="Geral & Aparência" icon={Settings} active={activeTab === 'geral'} onClick={setActiveTab} />
                <TabButton id="regras" label="Regras de Agendamento" icon={CheckCircle} active={activeTab === 'regras'} onClick={setActiveTab} />
                <TabButton id="avaliacoes" label="Avaliações" icon={Star} active={activeTab === 'avaliacoes'} onClick={setActiveTab} />
                <TabButton id="analytics" label="Desempenho" icon={BarChart2} active={activeTab === 'analytics'} onClick={setActiveTab} />
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {/* TAB: GERAL */}
                {activeTab === 'geral' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
                        <Card title="Status da Agenda Online">
                            <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div>
                                    <p className="font-bold text-slate-800">Aceitar agendamentos online</p>
                                    <p className="text-sm text-slate-500">Se desativado, o link mostrará que o estúdio está fechado temporariamente.</p>
                                </div>
                                <ToggleSwitch on={config.isActive} onClick={() => setConfig({...config, isActive: !config.isActive})} />
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-slate-700">Seu Link Público</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 flex items-center px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-sm overflow-hidden">
                                        <span className="truncate">
                                            {window.location.host}/.../{config.slug}
                                        </span>
                                    </div>
                                    <button onClick={handleCopyLink} className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600" title="Copiar">
                                        <Copy className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-sm" title="Compartilhar WhatsApp">
                                        <Share2 className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />
                                    Este link é a porta de entrada para seus clientes.
                                </p>
                            </div>
                        </Card>

                        <Card title="Identidade Visual">
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Estúdio</label>
                                    <input 
                                        value={config.studioName} 
                                        onChange={(e) => setConfig({...config, studioName: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Descrição Curta</label>
                                    <textarea 
                                        value={config.description} 
                                        onChange={(e) => setConfig({...config, description: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                                    />
                                </div>
                                <div className="flex items-center gap-4">
                                    <img src={config.logoUrl} alt="Logo" className="w-16 h-16 rounded-full border border-slate-200" />
                                    <button className="text-sm text-blue-600 font-semibold hover:underline">Alterar Logo</button>
                                </div>
                             </div>
                        </Card>
                    </div>
                )}

                {/* TAB: REGRAS */}
                {activeTab === 'regras' && (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
                        <Card title="Intervalos e Horários">
                             <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Intervalo entre agendamentos (Grade)</label>
                                    <div className="flex gap-2">
                                        {[15, 20, 30, 60].map(min => (
                                            <button
                                                key={min}
                                                onClick={() => setConfig({...config, timeIntervalMinutes: min as any})}
                                                className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                                                    config.timeIntervalMinutes === min 
                                                    ? 'bg-orange-500 text-white border-orange-600' 
                                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                {min} min
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Isso define como os horários aparecem para o cliente (ex: 09:00, 09:30...).</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Antecedência Mínima (horas)</label>
                                        <input 
                                            type="number" 
                                            value={config.minAdvanceHours}
                                            onChange={(e) => setConfig({...config, minAdvanceHours: Number(e.target.value)})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Agenda Aberta até (dias)</label>
                                        <input 
                                            type="number" 
                                            value={config.maxFutureDays}
                                            onChange={(e) => setConfig({...config, maxFutureDays: Number(e.target.value)})}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                    </div>
                                </div>
                             </div>
                        </Card>

                        <Card title="Política de Cancelamento">
                            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 mb-4">
                                <div className="flex gap-3">
                                    <MessageSquare className="text-orange-500 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-orange-800 text-sm">Mensagem Automática</h4>
                                        <p className="text-xs text-orange-700 mt-1">
                                            O JaciBot enviará um lembrete 24h antes informando sobre a taxa de cancelamento caso o cliente desista fora do prazo.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Limite para cancelamento grátis (horas antes)</label>
                                <select 
                                    value={config.cancellationPolicyHours}
                                    onChange={(e) => setConfig({...config, cancellationPolicyHours: Number(e.target.value)})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                >
                                    <option value={2}>2 horas</option>
                                    <option value={4}>4 horas</option>
                                    <option value={12}>12 horas</option>
                                    <option value={24}>24 horas</option>
                                    <option value={48}>48 horas</option>
                                </select>
                            </div>
                        </Card>
                     </div>
                )}

                {/* TAB: AVALIAÇÕES */}
                {activeTab === 'avaliacoes' && (
                     <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-700">Últimas Avaliações</h3>
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border shadow-sm">
                                <span className="text-sm font-bold">4.8</span>
                                <div className="flex text-amber-400"><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current"/><Star className="w-4 h-4 fill-current opacity-50"/></div>
                                <span className="text-xs text-slate-400">(32 avaliações)</span>
                            </div>
                        </div>

                        {reviews.map(review => (
                            <div key={review.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-bold text-slate-800">{review.clientName}</p>
                                        <p className="text-xs text-slate-500">{format(review.date, "dd 'de' MMMM, yyyy", {locale: pt})} • {review.serviceName}</p>
                                    </div>
                                    <div className="flex text-amber-400">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-slate-200'}`} />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-slate-600 text-sm mb-4">"{review.comment}"</p>
                                
                                {review.reply ? (
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                                        <p className="font-bold text-slate-700 text-xs mb-1">Sua resposta:</p>
                                        <p className="text-slate-600">{review.reply}</p>
                                    </div>
                                ) : (
                                    <div className="mt-4">
                                        <textarea 
                                            placeholder="Escreva uma resposta pública..."
                                            value={replyText[review.id] || ''}
                                            onChange={(e) => setReplyText({...replyText, [review.id]: e.target.value})}
                                            className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                                        />
                                        <button 
                                            onClick={() => handleReplySubmit(review.id)}
                                            className="text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"
                                        >
                                            Responder
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                     </div>
                )}

                {/* TAB: ANALYTICS */}
                {activeTab === 'analytics' && (
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             <div className="bg-white p-4 rounded-xl border shadow-sm">
                                 <p className="text-slate-500 text-xs uppercase font-bold">Visualizações (Perfil)</p>
                                 <p className="text-2xl font-bold text-slate-800">{mockAnalytics.pageViews.profile}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border shadow-sm">
                                 <p className="text-slate-500 text-xs uppercase font-bold">Iniciaram Agendamento</p>
                                 <p className="text-2xl font-bold text-slate-800">{mockAnalytics.conversion.started}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border shadow-sm">
                                 <p className="text-slate-500 text-xs uppercase font-bold">Concluídos</p>
                                 <p className="text-2xl font-bold text-green-600">{mockAnalytics.conversion.completed}</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border shadow-sm">
                                 <p className="text-slate-500 text-xs uppercase font-bold">Taxa de Conversão</p>
                                 <p className="text-2xl font-bold text-blue-600">
                                     {((mockAnalytics.conversion.completed / mockAnalytics.conversion.started) * 100).toFixed(1)}%
                                 </p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card title="Funil de Agendamento">
                                <div className="space-y-4 mt-2">
                                    <div className="relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <span className="text-xs font-semibold inline-block uppercase text-slate-600">Acessaram o Perfil</span>
                                            <span className="text-xs font-semibold inline-block text-slate-600">100%</span>
                                        </div>
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-200">
                                            <div style={{ width: "100%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-slate-400"></div>
                                        </div>
                                    </div>
                                     <div className="relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <span className="text-xs font-semibold inline-block uppercase text-slate-600">Clicaram em Agendar</span>
                                            <span className="text-xs font-semibold inline-block text-slate-600">14.4%</span>
                                        </div>
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-200">
                                            <div style={{ width: "14.4%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                                        </div>
                                    </div>
                                     <div className="relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <span className="text-xs font-semibold inline-block uppercase text-slate-600">Finalizaram</span>
                                            <span className="text-xs font-semibold inline-block text-slate-600">5.2%</span>
                                        </div>
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-200">
                                            <div style={{ width: "5.2%" }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"></div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Cliques no WhatsApp">
                                <div className="flex flex-col items-center justify-center h-48">
                                    <MessageCircle className="w-16 h-16 text-green-500 mb-4" />
                                    <p className="text-4xl font-bold text-slate-800">{mockAnalytics.conversion.whatsappClicks}</p>
                                    <p className="text-slate-500 text-sm mt-2">Clientes iniciaram conversa direta</p>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AgendaOnlineView;