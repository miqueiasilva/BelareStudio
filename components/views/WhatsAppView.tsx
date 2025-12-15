
import React, { useState, useEffect } from 'react';
import { 
    Search, MoreVertical, Paperclip, Send, Smile, Check, CheckCheck, 
    MessageSquare, Settings, Bell, Calendar, Gift, Zap, Link as LinkIcon,
    Smartphone, QrCode, RefreshCw, LogOut, Wifi, WifiOff, BatteryCharging
} from 'lucide-react';
import { mockConversations } from '../../data/mockData';
import { ChatConversation, ChatMessage } from '../../types';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
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

    // Simulate scanning the QR code by clicking on it
    const simulateScan = () => {
        setConnectionStatus('connecting');
        setTimeout(() => {
            setConnectionStatus('connected');
            showToast('Dispositivo conectado com sucesso!');
        }, 2000);
    };

    const handleDisconnect = () => {
        if(window.confirm("Deseja desconectar o WhatsApp do BelaApp? As automações pararão de funcionar.")){
            setConnectionStatus('disconnected');
            showToast('Dispositivo desconectado.', 'info');
        }
    };

    // --- Render ---

    return (
        <div className="flex h-full bg-slate-100 overflow-hidden relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Sidebar (Left) */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
                {/* Sidebar Header */}
                <div className="h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-white">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <h2 className="font-bold text-slate-700">WhatsApp</h2>
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
                        {/* Search */}
                        <div className="p-3 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar conversa..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                                />
                            </div>
                        </div>

                        {/* Conversation List */}
                        <div className="flex-1 overflow-y-auto">
                            {conversations
                                .filter(c => c.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => setSelectedChatId(chat.id)}
                                    className={`w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition border-b border-slate-50 ${selectedChatId === chat.id ? 'bg-green-50 hover:bg-green-50' : ''}`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500 font-bold text-lg overflow-hidden">
                                        {chat.clientAvatar ? <img src={chat.clientAvatar} alt="" /> : chat.clientName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-semibold text-slate-800 truncate">{chat.clientName}</h3>
                                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                                                {format(new Date(chat.lastMessageTime), 'HH:mm')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
                                    </div>
                                    {chat.unreadCount > 0 && (
                                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
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
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <h3 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4"/> JaciBot Ativo
                            </h3>
                            <p className="text-xs text-orange-700">
                                O JaciBot está monitorando sua agenda e enviará mensagens automaticamente conforme configurado.
                            </p>
                        </div>
                        <div className="text-sm text-slate-500">
                            Selecione uma categoria de automação ao lado para configurar.
                        </div>
                    </div>
                )}

                {activeTab === 'connection' && (
                    <div className="p-4 space-y-4">
                        <div className={`p-4 rounded-xl border ${connectionStatus === 'connected' ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                {connectionStatus === 'connected' ? <Wifi className="text-green-600 w-5 h-5" /> : <WifiOff className="text-slate-400 w-5 h-5" />}
                                <h3 className={`font-bold text-sm ${connectionStatus === 'connected' ? 'text-green-800' : 'text-slate-600'}`}>
                                    {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-500">
                                {connectionStatus === 'connected' 
                                    ? 'O sistema está sincronizado com seu WhatsApp.' 
                                    : 'Conecte seu aparelho para enviar mensagens automáticas.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5] relative">
                
                {/* --- CHATS VIEW --- */}
                {activeTab === 'chats' && (
                    selectedChatId && activeChat ? (
                        <>
                            {/* Chat Header */}
                            <header className="h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                        {activeChat.clientName.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{activeChat.clientName}</h3>
                                        <p className="text-xs text-slate-500">
                                            {activeChat.tags?.join(', ') || 'Cliente'}
                                        </p>
                                    </div>
                                </div>
                                <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </header>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}>
                                {activeChat.messages.map((msg) => (
                                    <div 
                                        key={msg.id} 
                                        className={`flex ${msg.sender === 'user' || msg.sender === 'system' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${
                                            msg.sender === 'user' ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 
                                            msg.sender === 'system' ? 'bg-yellow-50 text-slate-600 border border-yellow-100 text-xs text-center italic w-full max-w-[90%] self-center' :
                                            'bg-white text-slate-800 rounded-tl-none'
                                        }`}>
                                            {msg.sender === 'system' && <span className="block font-bold mb-1 not-italic">🤖 JaciBot:</span>}
                                            <p className="text-sm leading-relaxed">{msg.text}</p>
                                            <div className="flex justify-end items-center gap-1 mt-1">
                                                <span className="text-[10px] text-slate-400">
                                                    {format(new Date(msg.timestamp), 'HH:mm')}
                                                </span>
                                                {msg.sender === 'user' && (
                                                    <span className={msg.status === 'read' ? 'text-blue-500' : 'text-slate-400'}>
                                                        {msg.status === 'read' ? <CheckCheck size={14}/> : <Check size={14}/>}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Area */}
                            <div className="bg-slate-50 p-3 flex items-end gap-2 border-t border-slate-200">
                                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full">
                                    <Smile className="w-6 h-6" />
                                </button>
                                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full">
                                    <Paperclip className="w-6 h-6" />
                                </button>
                                <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col">
                                    <textarea 
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                                        placeholder="Digite uma mensagem" 
                                        className="w-full p-3 max-h-32 bg-transparent focus:outline-none resize-none text-sm"
                                        rows={1}
                                    />
                                    {/* Quick Replies / Templates */}
                                    <div className="px-2 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                                        <button onClick={() => handleQuickReply("Olá! Gostaria de confirmar seu agendamento?")} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full whitespace-nowrap text-slate-600">
                                            Confirmar Agenda
                                        </button>
                                        <button onClick={() => handleQuickReply("Oi! Tudo bem? Já chegamos no seu horário.")} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full whitespace-nowrap text-slate-600">
                                            Atraso
                                        </button>
                                        <button onClick={() => handleQuickReply("Obrigada pela preferência! 🥰")} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full whitespace-nowrap text-slate-600">
                                            Agradecimento
                                        </button>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleSendMessage()}
                                    className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 shadow-md transition-transform active:scale-95"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                            <MessageSquare className="w-16 h-16 mb-4" />
                            <p>Selecione uma conversa para iniciar</p>
                        </div>
                    )
                )}

                {/* --- AUTOMATIONS VIEW --- */}
                {activeTab === 'automations' && (
                    <div className="h-full bg-slate-50 overflow-y-auto p-8">
                        <div className="max-w-3xl mx-auto space-y-8">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                                    <Zap className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Automações do JaciBot</h2>
                                    <p className="text-slate-500">Configure as mensagens automáticas que o sistema enviará para seus clientes.</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100">
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                        Agenda e Lembretes
                                    </h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    <div className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">Confirmação (24h antes)</p>
                                            <p className="text-sm text-slate-500 max-w-md">Envia uma mensagem pedindo confirmação do horário um dia antes.</p>
                                        </div>
                                        <ToggleSwitch on={automations.confirm24h} onClick={() => toggleAutomation('confirm24h')} />
                                    </div>
                                    <div className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">Lembrete (2h antes)</p>
                                            <p className="text-sm text-slate-500 max-w-md">Envia um lembrete rápido para o cliente não esquecer.</p>
                                        </div>
                                        <ToggleSwitch on={automations.remind2h} onClick={() => toggleAutomation('remind2h')} />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 border-b border-slate-100">
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        <Gift className="w-5 h-5 text-pink-500" />
                                        Relacionamento
                                    </h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    <div className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">Feliz Aniversário</p>
                                            <p className="text-sm text-slate-500 max-w-md">Envia uma mensagem de parabéns com um cupom de desconto.</p>
                                        </div>
                                        <ToggleSwitch on={automations.birthday} onClick={() => toggleAutomation('birthday')} />
                                    </div>
                                    <div className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">Feedback Pós-Atendimento</p>
                                            <p className="text-sm text-slate-500 max-w-md">Pergunta a nota do serviço 1h após a conclusão.</p>
                                        </div>
                                        <ToggleSwitch on={automations.feedback} onClick={() => toggleAutomation('feedback')} />
                                    </div>
                                     <div className="p-6 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-800">Recuperação de Inativos</p>
                                            <p className="text-sm text-slate-500 max-w-md">Envia uma oferta para clientes que não voltam há mais de 30 dias.</p>
                                        </div>
                                        <ToggleSwitch on={automations.recovery} onClick={() => toggleAutomation('recovery')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CONNECTION VIEW --- */}
                {activeTab === 'connection' && (
                    <div className="h-full bg-slate-50 overflow-y-auto flex flex-col items-center justify-center p-6">
                        
                        {connectionStatus === 'disconnected' && (
                            <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md w-full animate-in zoom-in-95">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <LinkIcon className="w-10 h-10 text-slate-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Conectar WhatsApp</h2>
                                <p className="text-slate-500 mb-8 leading-relaxed">
                                    Para ativar o JaciBot e enviar mensagens automáticas, você precisa escanear o QR Code com seu celular.
                                </p>
                                <button 
                                    onClick={startConnection}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <QrCode size={20} />
                                    Gerar QR Code
                                </button>
                            </div>
                        )}

                        {(connectionStatus === 'connecting' || connectionStatus === 'qr_ready') && (
                            <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full animate-in fade-in">
                                <h3 className="text-xl font-bold text-slate-800 mb-6">Escaneie o código</h3>
                                
                                <div className="bg-slate-900 p-4 rounded-xl inline-block mb-6 relative group cursor-pointer" onClick={simulateScan}>
                                    {connectionStatus === 'connecting' ? (
                                        <div className="w-64 h-64 flex items-center justify-center bg-white rounded-lg">
                                            <RefreshCw className="w-10 h-10 text-slate-300 animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {/* Mock QR Code Image */}
                                            <img 
                                                src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=BelaApp-Auth-Token-12345" 
                                                alt="Scan me" 
                                                className="w-64 h-64 rounded-lg mix-blend-screen"
                                            />
                                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm rounded-lg">
                                                Clique para simular leitura
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <ol className="text-left text-sm text-slate-600 space-y-3 bg-slate-50 p-4 rounded-xl">
                                    <li className="flex gap-2"><span className="font-bold text-green-600">1.</span> Abra o WhatsApp no seu celular</li>
                                    <li className="flex gap-2"><span className="font-bold text-green-600">2.</span> Toque em Menu (⋮) ou Configurações</li>
                                    <li className="flex gap-2"><span className="font-bold text-green-600">3.</span> Selecione <b>Aparelhos Conectados</b></li>
                                    <li className="flex gap-2"><span className="font-bold text-green-600">4.</span> Toque em <b>Conectar um aparelho</b></li>
                                </ol>
                            </div>
                        )}

                        {connectionStatus === 'connected' && (
                            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full animate-in zoom-in-95">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center border-4 border-green-50">
                                        <Smartphone className="w-8 h-8 text-green-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">Conectado</h2>
                                        <p className="text-green-600 font-medium text-sm flex items-center gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            Online agora
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="text-slate-500 text-sm">Sessão</span>
                                        <span className="font-mono text-slate-800 text-sm">BelaApp Web</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <span className="text-slate-500 text-sm flex items-center gap-2">
                                            <BatteryCharging className="w-4 h-4"/> Bateria
                                        </span>
                                        <span className="font-bold text-slate-800 text-sm">{batteryLevel}%</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleDisconnect}
                                    className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut size={18} />
                                    Desconectar
                                </button>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppView;