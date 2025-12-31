
import React, { useState, useMemo } from 'react';
import { 
    Search, MoreVertical, Paperclip, Send, Smile, Check, CheckCheck, 
    MessageSquare, Bell, Calendar, Heart, Star, Clock, Zap, 
    Link as LinkIcon, Smartphone, Wifi, WifiOff, LogOut, ChevronLeft, 
    ArrowLeft, CheckCircle2, User, Camera, Shield, Signal, Battery,
    // FIX: Added missing QrCode and RefreshCw imports from lucide-react.
    QrCode, RefreshCw
} from 'lucide-react';
import { mockConversations } from '../../data/mockData';
import { ChatConversation, ChatMessage } from '../../types';
import { format, addHours, addDays } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

// --- Componente de Simulador de Smartphone ---
const PhonePreview = ({ type, time, active }: { type: string, time: string, active: boolean }) => {
    const getMessageText = () => {
        const clientName = "*Maria Silva*";
        const studioName = "*Bela Studio*";
        
        switch (type) {
            case 'confirmation':
                return `Olá, ${clientName}! 👋 Aqui é do ${studioName}. Passando para confirmar seu agendamento de amanhã às 14:00. Podemos confirmar?`;
            case 'reminder':
                return `Oi, ${clientName}! 🌸 Só lembrando que seu horário conosco é daqui a ${time} ${Number(time) > 1 ? 'horas' : 'hora'}. Até logo!`;
            case 'feedback':
                return `Oi, ${clientName}! ✨ Adoramos te atender hoje. Poderia nos contar o que achou do serviço? Leva apenas 30 segundos: [link-da-pesquisa]`;
            case 'birthday':
                return `Parabéns, ${clientName}! 🎉 O ${studioName} te deseja um dia maravilhoso. Como presente, você tem 15% de desconto em qualquer serviço este mês! 🎁`;
            default:
                return "Selecione uma automação para visualizar.";
        }
    };

    return (
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            {/* Chassi do Celular */}
            <div className="relative w-[280px] h-[560px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20"></div>
                
                {/* Status Bar */}
                <div className="h-10 bg-white flex items-end justify-between px-6 pb-1 text-[10px] font-black text-slate-800">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                        <Signal size={10} />
                        <Wifi size={10} />
                        <Battery size={10} />
                    </div>
                </div>

                {/* WhatsApp Header Mockup */}
                <div className="bg-[#075e54] text-white p-3 pt-4 flex items-center gap-2 shadow-md">
                    <ArrowLeft size={16} />
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-white/20">
                        <img src="https://i.pravatar.cc/100?u=studio" className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">Bela Studio Prime</p>
                        <p className="text-[8px] opacity-80">online</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                    </div>
                </div>

                {/* Chat Background */}
                <div className="absolute inset-0 top-[88px] bg-[#e5ddd5] z-0 opacity-100" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '200px' }}></div>

                {/* Messages Container */}
                <div className="relative z-10 p-4 space-y-4 flex flex-col pt-6">
                    <div className="self-center bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm mb-2">Hoje</div>
                    
                    {!active ? (
                        <div className="self-center bg-white/80 backdrop-blur-sm p-4 rounded-2xl text-center border border-slate-200/50">
                            <Zap size={20} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase tracking-tighter">Ative esta automação<br/>para simular o envio</p>
                        </div>
                    ) : (
                        <div className="bg-[#dcf8c6] p-3 rounded-2xl rounded-tr-none shadow-sm relative animate-in slide-in-from-right-4 duration-300 ml-auto max-w-[90%]">
                            <p className="text-[11px] text-slate-800 leading-relaxed">
                                {getMessageText()}
                            </p>
                            <div className="flex justify-end items-center gap-1 mt-1">
                                <span className="text-[8px] text-slate-400 font-bold">09:41</span>
                                <CheckCheck size={10} className="text-blue-500" />
                            </div>
                            {/* Tail */}
                            <div className="absolute -right-1.5 top-0 w-4 h-4 bg-[#dcf8c6]" style={{ clipPath: 'polygon(0 0, 0% 100%, 100% 0)' }}></div>
                        </div>
                    )}
                </div>

                {/* Footer Bar Mockup */}
                <div className="absolute bottom-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md flex items-center px-4 gap-2 border-t border-slate-200">
                    <div className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 font-bold text-xs">+</div>
                    <div className="flex-1 bg-slate-100 h-8 rounded-full border border-slate-200"></div>
                    <Camera size={18} className="text-slate-400" />
                    <User size={18} className="text-slate-400" />
                </div>
            </div>
            <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-200/50 px-4 py-2 rounded-full">Simulador em Tempo Real</p>
        </div>
    );
};

// --- Subcomponente de Card de Automação ---
const AutomationCard = ({ 
    icon: Icon, title, description, active, onToggle, 
    timeValue, onTimeChange, hasTimeSelect = false, onPreview, isSelected 
}: any) => (
    <div 
        onClick={onPreview}
        className={`p-5 rounded-[32px] border-2 transition-all duration-300 cursor-pointer ${
            isSelected 
            ? 'bg-white border-orange-500 shadow-xl shadow-orange-100 translate-x-1' 
            : active 
                ? 'bg-white border-slate-100 hover:border-orange-200 shadow-sm' 
                : 'bg-slate-50 border-slate-100 opacity-60'
        }`}
    >
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl flex-shrink-0 transition-all ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-slate-200 text-slate-400'}`}>
                    <Icon size={20} />
                </div>
                <div className="space-y-1">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                        {title}
                        {hasTimeSelect && active && (
                            <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                                <select 
                                    value={timeValue}
                                    onChange={(e) => onTimeChange(e.target.value)}
                                    className="appearance-none bg-orange-50 border border-orange-100 text-orange-600 px-2 py-0.5 pr-6 rounded-lg text-[10px] font-black uppercase tracking-tighter focus:ring-2 focus:ring-orange-200 outline-none cursor-pointer hover:bg-orange-100 transition-colors"
                                >
                                    <option value="1">1h</option>
                                    <option value="2">2h</option>
                                    <option value="4">4h</option>
                                    <option value="24">24h</option>
                                    <option value="48">48h</option>
                                </select>
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none">
                                    <ChevronDown size={10} strokeWidth={3} />
                                </div>
                            </div>
                        )}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{description}</p>
                </div>
            </div>
            <div className="flex-shrink-0 pt-1" onClick={e => e.stopPropagation()}>
                <ToggleSwitch on={active} onClick={onToggle} />
            </div>
        </div>
    </div>
);

const ChevronDown = ({ size, strokeWidth, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth || 3} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

const WhatsAppView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'chats' | 'automations' | 'connection'>('chats');
    const [conversations, setConversations] = useState<ChatConversation[]>(mockConversations);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [activePreview, setActivePreview] = useState<'confirmation' | 'reminder' | 'feedback' | 'birthday'>('confirmation');

    const activeChat = conversations.find(c => c.id === selectedChatId);

    // --- State: Automações ---
    const [automations, setAutomations] = useState({
        confirmation: { active: true, time: "24" },
        reminder: { active: true, time: "2" },
        feedback: { active: true },
        birthday: { active: false }
    });

    const updateAutomation = (key: keyof typeof automations, field: 'active' | 'time', value: any) => {
        setAutomations(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
        if (field === 'active') {
            showToast(`Automação ${value ? 'ativada' : 'pausada'}.`, 'info');
        }
    };

    // --- Connection State ---
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'qr_ready' | 'connected'>('connected');

    // --- Handlers ---
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!messageInput.trim() || !selectedChatId) return;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: messageInput,
            timestamp: new Date(),
            status: 'sent'
        };

        setConversations(prev => prev.map(c => {
            if (c.id === selectedChatId) {
                return {
                    ...c,
                    messages: [...c.messages, newMessage],
                    lastMessage: newMessage.text,
                    lastMessageTime: newMessage.timestamp
                };
            }
            return c;
        }));

        setMessageInput('');
    };

    return (
        <div className="flex h-full bg-slate-100 overflow-hidden relative font-sans text-left">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* SIDEBAR (Lista de Contatos / Menu) */}
            <div className={`
                ${selectedChatId !== null ? 'hidden md:flex' : 'flex w-full md:w-80'} 
                bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-20
            `}>
                <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-sm shadow-green-100">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <h2 className="font-black text-slate-700 tracking-tight">WhatsApp</h2>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => setActiveTab('chats')} className={`p-2 rounded-lg transition-all ${activeTab === 'chats' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`}><MessageSquare size={18} /></button>
                        <button onClick={() => setActiveTab('automations')} className={`p-2 rounded-lg transition-all ${activeTab === 'automations' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`}><Zap size={18} /></button>
                        <button onClick={() => setActiveTab('connection')} className={`p-2 rounded-lg transition-all ${activeTab === 'connection' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`}><LinkIcon size={18} /></button>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                    {activeTab === 'chats' && (
                        <>
                            <div className="p-4 bg-white border-b border-slate-100 sticky top-0 z-10">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Pesquisar..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-green-100 border-transparent focus:border-green-200 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100 bg-white">
                                {conversations
                                    .filter(c => c.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(chat => (
                                    <button
                                        key={chat.id}
                                        onClick={() => setSelectedChatId(chat.id)}
                                        className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-all border-b border-transparent active:bg-green-50 ${selectedChatId === chat.id ? 'bg-green-50/50 border-l-4 border-l-green-500' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500 font-black overflow-hidden border-2 border-white shadow-sm">
                                            {chat.clientAvatar ? <img src={chat.clientAvatar} className="w-full h-full object-cover" alt="" /> : chat.clientName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <h3 className="font-bold text-slate-800 truncate text-sm">{chat.clientName}</h3>
                                                <span className="text-[9px] font-black text-slate-400 uppercase">
                                                    {format(new Date(chat.lastMessageTime), 'HH:mm')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate leading-tight">{chat.lastMessage}</p>
                                        </div>
                                        {chat.unreadCount > 0 && (
                                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-black flex-shrink-0">
                                                {chat.unreadCount}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    
                    {activeTab === 'automations' && (
                        <div className="p-4 space-y-4">
                            <header className="mb-4">
                                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Mensagens Automáticas</h2>
                                <p className="text-[10px] text-slate-500 mt-1 ml-1">Selecione uma regra para visualizar no simulador.</p>
                            </header>

                            <AutomationCard 
                                icon={Calendar}
                                title="Confirmação de Agenda"
                                description="Pergunta se o cliente comparecerá."
                                active={automations.confirmation.active}
                                isSelected={activePreview === 'confirmation'}
                                onPreview={() => setActivePreview('confirmation')}
                                onToggle={() => updateAutomation('confirmation', 'active', !automations.confirmation.active)}
                                hasTimeSelect
                                timeValue={automations.confirmation.time}
                                onTimeChange={(val: any) => updateAutomation('confirmation', 'time', val)}
                            />

                            <AutomationCard 
                                icon={Clock}
                                title="Lembrete Antecipado"
                                description="Aviso cordial de horário próximo."
                                active={automations.reminder.active}
                                isSelected={activePreview === 'reminder'}
                                onPreview={() => setActivePreview('reminder')}
                                onToggle={() => updateAutomation('reminder', 'active', !automations.reminder.active)}
                                hasTimeSelect
                                timeValue={automations.reminder.time}
                                onTimeChange={(val: any) => updateAutomation('reminder', 'time', val)}
                            />

                            <AutomationCard 
                                icon={Star}
                                title="Pesquisa de Satisfação"
                                description="Envia link após o serviço."
                                active={automations.feedback.active}
                                isSelected={activePreview === 'feedback'}
                                onPreview={() => setActivePreview('feedback')}
                                onToggle={() => updateAutomation('feedback', 'active', !automations.feedback.active)}
                            />

                            <AutomationCard 
                                icon={Heart}
                                title="Parabéns / Aniversário"
                                description="Mensagem com cupom de desconto."
                                active={automations.birthday.active}
                                isSelected={activePreview === 'birthday'}
                                onPreview={() => setActivePreview('birthday')}
                                onToggle={() => updateAutomation('birthday', 'active', !automations.birthday.active)}
                            />
                        </div>
                    )}

                    {activeTab === 'connection' && (
                        <div className="p-6 flex flex-col items-center justify-center h-full text-center">
                            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl mb-6 border-4 border-white ${connectionStatus === 'connected' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600 animate-pulse'}`}>
                                {connectionStatus === 'connected' ? <Wifi size={32} /> : <WifiOff size={32} />}
                            </div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Status da Conexão</h3>
                            <p className="text-xs text-slate-500 mt-2 max-w-[200px] leading-relaxed">
                                {connectionStatus === 'connected' 
                                    ? 'Sincronizado com Jaciene Félix.' 
                                    : 'Escaneie o código no Desktop para ativar.'}
                            </p>
                            
                            {connectionStatus === 'connected' && (
                                <div className="mt-8 w-full p-4 bg-white rounded-2xl border border-slate-100 text-left">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">Bateria do Celular</span>
                                        <span className="text-[9px] font-black text-green-600">85%</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 w-[85%]"></div>
                                    </div>
                                    <button onClick={() => setConnectionStatus('disconnected')} className="mt-6 w-full flex items-center justify-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 p-3 rounded-xl transition-all">
                                        <LogOut size={14} /> Desconectar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className={`
                flex-1 flex flex-col bg-slate-100 relative 
                ${selectedChatId === null && activeTab === 'chats' ? 'hidden md:flex' : 'flex w-full md:w-auto'}
            `}>
                
                {/* Visualização de Chats */}
                {activeTab === 'chats' && selectedChatId && activeChat && (
                    <div className="flex-1 flex flex-col bg-[#f0f2f5]">
                        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-10 shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <button onClick={() => setSelectedChatId(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-600 font-black border border-slate-100">
                                    {activeChat.clientAvatar ? <img src={activeChat.clientAvatar} className="w-full h-full object-cover rounded-full" alt="" /> : activeChat.clientName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 truncate text-sm">{activeChat.clientName}</h3>
                                    <p className="text-[10px] text-green-600 font-black uppercase tracking-widest leading-none mt-0.5 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Online agora
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><Search size={20} /></button>
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><MoreVertical size={20} /></button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay' }}>
                            {activeChat.messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' || msg.sender === 'system' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-sm relative ${
                                        msg.sender === 'user' ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none border-t border-green-100 shadow-[0_2px_4px_rgba(0,0,0,0.05)]' : 
                                        msg.sender === 'system' ? 'bg-white/80 backdrop-blur-sm text-slate-700 border border-slate-200 text-xs italic w-full max-w-full my-6 rounded-2xl shadow-sm text-center' :
                                        'bg-white text-slate-800 rounded-tl-none border-t border-white shadow-[0_2px_4px_rgba(0,0,0,0.05)]'
                                    }`}>
                                        {msg.sender === 'system' && (
                                            <div className="flex items-center justify-center gap-2 mb-2 border-b border-slate-100 pb-2">
                                                <Zap size={14} className="text-orange-500" />
                                                <span className="font-black uppercase tracking-widest text-[9px]">Automação BelaFlow</span>
                                            </div>
                                        )}
                                        <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                                        <div className="flex justify-end items-center gap-1 mt-1">
                                            <span className="text-[9px] font-bold text-slate-400 opacity-70">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                                            {msg.sender === 'user' && (
                                                <span className={msg.status === 'read' ? 'text-blue-500' : 'text-slate-400'}>
                                                    {msg.status === 'read' ? <CheckCheck size={14} strokeWidth={3}/> : <Check size={14} strokeWidth={3}/>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white p-3 md:p-4 flex items-end gap-2 border-t border-slate-200">
                            <div className="flex-1 bg-slate-100 rounded-[24px] border border-slate-200 flex flex-col overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-green-100 transition-all duration-300">
                                <textarea value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Mensagem..." className="w-full p-3 md:p-4 max-h-32 bg-transparent focus:outline-none resize-none text-sm font-bold text-slate-700" rows={1} />
                            </div>
                            <button onClick={() => handleSendMessage()} className="w-14 h-14 bg-green-600 text-white rounded-full hover:bg-green-700 shadow-lg flex items-center justify-center transition-all active:scale-90"><Send className="w-6 h-6 ml-1" /></button>
                        </div>
                    </div>
                )}

                {/* Visualização de Automações (Live Preview) */}
                {activeTab === 'automations' && (
                    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-8 bg-slate-50/50 overflow-y-auto">
                        <div className="flex flex-col items-center gap-6">
                            <div className="text-center mb-4">
                                <h2 className="text-2xl font-black text-slate-800">Simulador de Envio</h2>
                                <p className="text-sm text-slate-500 font-medium">Veja exatamente como o seu cliente recebe a mensagem.</p>
                            </div>
                            <PhonePreview 
                                type={activePreview} 
                                time={activePreview === 'confirmation' ? automations.confirmation.time : automations.reminder.time} 
                                active={activePreview === 'confirmation' ? automations.confirmation.active : activePreview === 'reminder' ? automations.reminder.active : activePreview === 'feedback' ? automations.feedback.active : automations.birthday.active}
                            />
                        </div>
                    </div>
                )}

                {/* State: Empty Chats */}
                {activeTab === 'chats' && !selectedChatId && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white/50 backdrop-blur-sm">
                        <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center shadow-2xl border border-slate-100 mb-6">
                            <MessageSquare className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight">Canal WhatsApp BelaFlow</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-xs mt-3 uppercase tracking-widest leading-relaxed">Suas conversas sincronizadas e automatizadas em um único lugar.</p>
                    </div>
                )}
                
                {/* State: Connection Placeholder */}
                {activeTab === 'connection' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white/50">
                        <div className="max-w-md w-full bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100 text-center">
                            <QrCode size={180} className="mx-auto text-slate-800 mb-8" />
                            <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Parear WhatsApp</h3>
                            <p className="text-sm text-slate-500 leading-relaxed mb-8">
                                1. Abra o WhatsApp no seu celular<br/>
                                2. Toque em <b>Aparelhos Conectados</b><br/>
                                3. Toque em <b>Conectar um Aparelho</b> e aponte para a tela
                            </p>
                            <button className="flex items-center justify-center gap-3 w-full bg-slate-100 p-4 rounded-2xl font-black text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-all group">
                                <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" /> Gerar Novo Código
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppView;
