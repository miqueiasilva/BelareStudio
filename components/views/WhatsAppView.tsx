
import React, { useState, useEffect } from 'react';
import { 
    Search, MoreVertical, Paperclip, Send, Smile, Check, CheckCheck, 
    MessageSquare, Settings, Bell, Calendar, Gift, Zap, Link as LinkIcon,
    Smartphone, QrCode, RefreshCw, LogOut, Wifi, WifiOff, BatteryCharging,
    ChevronLeft, ArrowLeft
} from 'lucide-react';
import { mockConversations } from '../../data/mockData';
import { ChatConversation, ChatMessage } from '../../types';
import { format } from 'date-fns';
import { ptBR as pt } from 'date-fns/locale/pt-BR';
import ToggleSwitch from '../shared/ToggleSwitch';
import Toast, { ToastType } from '../shared/Toast';

const WhatsAppView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'chats' | 'automations' | 'connection'>('chats');
    const [conversations, setConversations] = useState<ChatConversation[]>(mockConversations);
    const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
    const [messageInput, setMessageInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const activeChat = conversations.find(c => c.id === selectedChatId);

    // --- Automations State ---
    const [automations, setAutomations] = useState({
        confirm24h: true,
        remind2h: true,
        birthday: false,
        feedback: true,
        recovery: false
    });

    // --- Connection State (Simulation) ---
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'qr_ready' | 'connected'>('disconnected');
    const [batteryLevel, setBatteryLevel] = useState(85);

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

    const handleQuickReply = (text: string) => {
        setMessageInput(text);
    };

    const toggleAutomation = (key: keyof typeof automations) => {
        setAutomations(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- Connection Simulation Handlers ---
    const startConnection = () => {
        setConnectionStatus('connecting');
        setTimeout(() => {
            setConnectionStatus('qr_ready');
        }, 1500);
    };

    const simulateScan = () => {
        setConnectionStatus('connecting');
        setTimeout(() => {
            setConnectionStatus('connected');
            showToast('Dispositivo conectado com sucesso!');
        }, 2000);
    };

    const handleDisconnect = () => {
        if(window.confirm("Deseja desconectar o WhatsApp do BelaFlow? As automações pararão de funcionar.")){
            setConnectionStatus('disconnected');
            showToast('Dispositivo desconectado.', 'info');
        }
    };

    return (
        <div className="flex h-full bg-slate-100 overflow-hidden relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Sidebar (Master List) - Condicional no Mobile */}
            <div className={`
                ${selectedChatId !== null ? 'hidden md:flex' : 'flex w-full md:w-80'} 
                bg-white border-r border-slate-200 flex flex-col flex-shrink-0
            `}>
                {/* Sidebar Header */}
                <div className="h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-sm shadow-green-100">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <h2 className="font-black text-slate-700 tracking-tight">WhatsApp</h2>
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => setActiveTab('chats')} 
                            className={`p-2 rounded-lg transition ${activeTab === 'chats' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="Conversas"
                        >
                            <MessageSquare className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setActiveTab('automations')} 
                            className={`p-2 rounded-lg transition ${activeTab === 'automations' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="Automações JaciBot"
                        >
                            <Zap className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setActiveTab('connection')} 
                            className={`p-2 rounded-lg transition ${activeTab === 'connection' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="Conexão e Status"
                        >
                            <LinkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {activeTab === 'chats' && (
                    <>
                        <div className="p-4 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar conversa..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-100 border border-transparent focus:bg-white focus:border-green-200 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {conversations
                                .filter(c => c.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => setSelectedChatId(chat.id)}
                                    className={`w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition border-b border-slate-50 active:bg-green-50 ${selectedChatId === chat.id ? 'bg-green-50' : ''}`}
                                >
                                    <div className="w-14 h-14 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500 font-black text-xl overflow-hidden border-2 border-white shadow-sm">
                                        {chat.clientAvatar ? <img src={chat.clientAvatar} className="w-full h-full object-cover" alt="" /> : chat.clientName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-bold text-slate-800 truncate">{chat.clientName}</h3>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter flex-shrink-0">
                                                {format(new Date(chat.lastMessageTime), 'HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 truncate leading-tight">{chat.lastMessage}</p>
                                    </div>
                                    {chat.unreadCount > 0 && (
                                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-black flex-shrink-0 shadow-lg shadow-green-100">
                                            {chat.unreadCount}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                
                {activeTab === 'automations' && (
                    <div className="p-6 space-y-4">
                        <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 shadow-sm">
                            <h3 className="font-black text-orange-800 text-sm mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4"/> JaciBot Ativo
                            </h3>
                            <p className="text-xs text-orange-700 leading-relaxed font-medium">
                                O assistente inteligente monitora sua agenda e realiza as cobranças e lembretes automaticamente.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'connection' && (
                    <div className="p-6 space-y-4">
                        <div className={`p-5 rounded-2xl border transition-all ${connectionStatus === 'connected' ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                {connectionStatus === 'connected' ? <Wifi className="text-green-600 w-5 h-5" /> : <WifiOff className="text-slate-400 w-5 h-5" />}
                                <h3 className={`font-black text-sm uppercase tracking-wider ${connectionStatus === 'connected' ? 'text-green-800' : 'text-slate-600'}`}>
                                    {connectionStatus === 'connected' ? 'Dispositivo Pareado' : 'Sem Conexão'}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                {connectionStatus === 'connected' 
                                    ? 'Sincronização em tempo real ativa.' 
                                    : 'Escaneie o código para habilitar as automações.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Window (Detail View) - Condicional no Mobile */}
            <div className={`
                flex-1 flex flex-col bg-[#f0f2f5] relative 
                ${selectedChatId === null ? 'hidden md:flex' : 'flex w-full md:w-auto'}
            `}>
                
                {selectedChatId && activeChat ? (
                    <>
                        {/* Chat Header com Botão Voltar para Mobile */}
                        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-10 shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <button 
                                    onClick={() => setSelectedChatId(null)}
                                    className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-600 font-black border border-slate-100">
                                    {activeChat.clientAvatar ? <img src={activeChat.clientAvatar} className="w-full h-full object-cover rounded-full" alt="" /> : activeChat.clientName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 truncate">{activeChat.clientName}</h3>
                                    <p className="text-[10px] text-green-600 font-black uppercase tracking-widest leading-none mt-0.5">Online agora</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                                    <Search size={20} />
                                </button>
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </header>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay' }}>
                            {activeChat.messages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`flex ${msg.sender === 'user' || msg.sender === 'system' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-sm relative ${
                                        msg.sender === 'user' ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none border-t border-green-100' : 
                                        msg.sender === 'system' ? 'bg-yellow-50 text-slate-700 border border-yellow-200 text-xs text-center italic w-full max-w-full my-4 rounded-xl' :
                                        'bg-white text-slate-800 rounded-tl-none border-t border-white'
                                    }`}>
                                        {msg.sender === 'system' && (
                                            <div className="flex items-center justify-center gap-2 mb-2 border-b border-yellow-100 pb-2">
                                                <Zap size={14} className="text-orange-500" />
                                                <span className="font-black uppercase tracking-widest text-[9px]">JaciBot Automático</span>
                                            </div>
                                        )}
                                        <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                                        <div className="flex justify-end items-center gap-1 mt-1">
                                            <span className="text-[9px] font-bold text-slate-400 opacity-70">
                                                {format(new Date(msg.timestamp), 'HH:mm')}
                                            </span>
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

                        {/* Input Area */}
                        <div className="bg-slate-50 p-3 md:p-4 flex items-end gap-2 border-t border-slate-200">
                            <div className="hidden sm:flex items-center gap-1">
                                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-all"><Smile className="w-6 h-6" /></button>
                                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-all"><Paperclip className="w-6 h-6" /></button>
                            </div>
                            
                            <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-green-100 focus-within:border-green-400 transition-all">
                                <textarea 
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                                    placeholder="Digite uma mensagem..." 
                                    className="w-full p-3 md:p-4 max-h-32 bg-transparent focus:outline-none resize-none text-sm font-medium"
                                    rows={1}
                                />
                                {/* Quick Replies Otimizados para Toque */}
                                <div className="px-3 pb-3 flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x">
                                    <button onClick={() => handleQuickReply("Olá! Gostaria de confirmar seu agendamento?")} className="text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-green-100 hover:text-green-700 px-3 py-1.5 rounded-full whitespace-nowrap text-slate-500 transition-all border border-slate-200/50">
                                        Confirmar Agenda
                                    </button>
                                    <button onClick={() => handleQuickReply("Oi! Tudo bem? Já chegamos no seu horário.")} className="text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-amber-100 hover:text-amber-700 px-3 py-1.5 rounded-full whitespace-nowrap text-slate-500 transition-all border border-slate-200/50">
                                        Atraso
                                    </button>
                                    <button onClick={() => handleQuickReply("Obrigada pela preferência! 🥰")} className="text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-pink-100 hover:text-pink-700 px-3 py-1.5 rounded-full whitespace-nowrap text-slate-500 transition-all border border-slate-200/50">
                                        Agradecimento
                                    </button>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => handleSendMessage()}
                                className="p-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-90 flex-shrink-0"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white/50 backdrop-blur-sm">
                        <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center shadow-xl border border-slate-100 mb-6">
                            <MessageSquare className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-700 leading-tight">Canal WhatsApp BelaFlow</h3>
                        <p className="text-sm font-medium text-slate-400 max-w-xs mt-2">Escolha uma conversa para ler as mensagens e responder em tempo real.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppView;
