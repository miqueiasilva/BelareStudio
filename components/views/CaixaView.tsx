
import React, { useState, useMemo } from 'react';
import { 
    Archive, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, 
    DollarSign, AlertTriangle, Calculator, Calendar, History,
    X
} from 'lucide-react';
import Card from '../shared/Card';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import Toast, { ToastType } from '../shared/Toast';

// --- Types ---

type CashStatus = 'fechado' | 'aberto';
type MovementType = 'abertura' | 'venda' | 'suprimento' | 'sangria' | 'fechamento';

interface CashMovement {
    id: number;
    type: MovementType;
    description: string;
    amount: number;
    time: Date;
    user: string;
}

interface CashSession {
    id: number;
    date: Date;
    status: CashStatus;
    openingBalance: number;
    closingBalance?: number;
    calculatedBalance?: number;
    difference?: number;
    movements: CashMovement[];
}

// --- Mock Data ---
const initialSession: CashSession = {
    id: 101,
    date: new Date(),
    status: 'fechado', // Start closed to show opening flow
    openingBalance: 0,
    movements: []
};

// --- Helper Components ---

const StatCard = ({ title, value, icon: Icon, colorClass, textColor }: any) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
            <p className={`text-xl font-bold mt-1 ${textColor}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClass}`}>
            <Icon className="w-5 h-5 text-white" />
        </div>
    </div>
);

// --- Modal Component for Operations ---
interface OperationModalProps {
    type: 'abrir' | 'suprimento' | 'sangria' | 'fechar';
    onClose: () => void;
    onConfirm: (amount: number, description: string) => void;
    currentBalance?: number;
}

const OperationModal: React.FC<OperationModalProps> = ({ type, onClose, onConfirm, currentBalance = 0 }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const config = {
        abrir: { title: 'Abrir Caixa', color: 'bg-green-600', btnText: 'Iniciar Turno', label: 'Fundo de Troco (R$)' },
        suprimento: { title: 'Nova Entrada (Suprimento)', color: 'bg-blue-600', btnText: 'Adicionar Dinheiro', label: 'Valor (R$)' },
        sangria: { title: 'Nova Saída (Sangria)', color: 'bg-red-600', btnText: 'Retirar Dinheiro', label: 'Valor (R$)' },
        fechar: { title: 'Fechar Caixa', color: 'bg-slate-800', btnText: 'Finalizar Caixa', label: 'Valor Conferido em Gaveta (R$)' },
    };

    const activeConfig = config[type];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount) return;
        onConfirm(Number(amount), description);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <header className={`p-4 ${activeConfig.color} text-white flex justify-between items-center`}>
                    <h3 className="font-bold text-lg">{activeConfig.title}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 opacity-80 hover:opacity-100" /></button>
                </header>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {type === 'fechar' && (
                        <div className="p-3 bg-slate-100 rounded-lg text-center mb-4">
                            <p className="text-xs text-slate-500 uppercase font-bold">Saldo Esperado em Sistema</p>
                            <p className="text-2xl font-bold text-slate-800">R$ {currentBalance.toFixed(2)}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{activeConfig.label}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                            <input 
                                autoFocus
                                type="number" 
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 outline-none font-bold text-lg text-slate-700"
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    {(type === 'suprimento' || type === 'sangria') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo / Descrição</label>
                            <input 
                                type="text" 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 outline-none"
                                placeholder="Ex: Pagamento de Fornecedor, Troco..."
                            />
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={!amount}
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${activeConfig.color}`}
                    >
                        {activeConfig.btnText}
                    </button>
                </form>
            </div>
        </div>
    );
}

const CaixaView: React.FC = () => {
    const [session, setSession] = useState<CashSession>(initialSession);
    const [modalType, setModalType] = useState<'abrir' | 'suprimento' | 'sangria' | 'fechar' | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // --- Calculations ---
    const stats = useMemo(() => {
        const vendas = session.movements.filter(m => m.type === 'venda').reduce((acc, m) => acc + m.amount, 0);
        const suprimentos = session.movements.filter(m => m.type === 'suprimento').reduce((acc, m) => acc + m.amount, 0);
        const sangrias = session.movements.filter(m => m.type === 'sangria').reduce((acc, m) => acc + m.amount, 0);
        const currentBalance = session.openingBalance + vendas + suprimentos - sangrias;

        return { vendas, suprimentos, sangrias, currentBalance };
    }, [session]);

    // --- Handlers ---
    const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

    const handleOperation = (amount: number, description: string) => {
        if (!modalType) return;

        if (modalType === 'abrir') {
            setSession(prev => ({
                ...prev,
                status: 'aberto',
                openingBalance: amount,
                movements: [{ id: Date.now(), type: 'abertura', amount, description: 'Fundo de Troco', time: new Date(), user: 'Jaciene' }]
            }));
            showToast('Caixa aberto com sucesso!');
        } else if (modalType === 'fechar') {
            const diff = amount - stats.currentBalance;
            setSession(prev => ({
                ...prev,
                status: 'fechado',
                closingBalance: amount,
                calculatedBalance: stats.currentBalance,
                difference: diff,
                movements: [...prev.movements, { id: Date.now(), type: 'fechamento', amount, description: `Fechamento (Dif: ${diff.toFixed(2)})`, time: new Date(), user: 'Jaciene' }]
            }));
            showToast(`Caixa fechado. Diferença: R$ ${diff.toFixed(2)}`, diff !== 0 ? 'info' : 'success');
        } else {
            // Suprimento or Sangria
            const newMovement: CashMovement = {
                id: Date.now(),
                type: modalType,
                amount,
                description: description || (modalType === 'suprimento' ? 'Entrada manual' : 'Saída manual'),
                time: new Date(),
                user: 'Jaciene'
            };
            setSession(prev => ({
                ...prev,
                movements: [newMovement, ...prev.movements]
            }));
            showToast(`${modalType === 'suprimento' ? 'Suprimento' : 'Sangria'} registrado!`);
        }
        setModalType(null);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Archive className="text-purple-500" />
                        Controle de Caixa
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <Calendar size={14}/>
                        <span>{format(new Date(), "dd 'de' MMMM, yyyy", { locale: pt })}</span>
                        <span className="text-slate-300">•</span>
                        <span className={`font-bold ${session.status === 'aberto' ? 'text-green-600' : 'text-red-500'}`}>
                            {session.status === 'aberto' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    {session.status === 'fechado' ? (
                        <button 
                            onClick={() => setModalType('abrir')}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-200 flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Unlock size={18} /> Abrir Caixa
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setModalType('suprimento')} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition">
                                <ArrowUpCircle size={18} /> Suprimento
                            </button>
                            <button onClick={() => setModalType('sangria')} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition">
                                <ArrowDownCircle size={18} /> Sangria
                            </button>
                            <button onClick={() => setModalType('fechar')} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition ml-2">
                                <Lock size={18} /> Fechar
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard 
                        title="Saldo Atual (Gaveta)" 
                        value={`R$ ${stats.currentBalance.toFixed(2)}`} 
                        icon={Calculator} 
                        colorClass="bg-slate-700" 
                        textColor="text-slate-800"
                    />
                    <StatCard 
                        title="Vendas do Turno" 
                        value={`+ R$ ${stats.vendas.toFixed(2)}`} 
                        icon={DollarSign} 
                        colorClass="bg-green-500" 
                        textColor="text-green-600"
                    />
                    <StatCard 
                        title="Entradas / Suprimentos" 
                        value={`+ R$ ${stats.suprimentos.toFixed(2)}`} 
                        icon={ArrowUpCircle} 
                        colorClass="bg-blue-500" 
                        textColor="text-blue-600"
                    />
                    <StatCard 
                        title="Saídas / Sangrias" 
                        value={`- R$ ${stats.sangrias.toFixed(2)}`} 
                        icon={ArrowDownCircle} 
                        colorClass="bg-red-500" 
                        textColor="text-red-600"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[400px]">
                    {/* Movements List */}
                    <Card title="Movimentações do Dia" icon={<History size={20}/>} className="lg:col-span-2 flex flex-col">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs sticky top-0">
                                    <tr>
                                        <th className="p-3">Horário</th>
                                        <th className="p-3">Tipo</th>
                                        <th className="p-3">Descrição</th>
                                        <th className="p-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {session.movements.map((m) => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-slate-500 font-mono">{format(m.time, 'HH:mm')}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                    m.type === 'venda' || m.type === 'abertura' || m.type === 'suprimento' ? 'bg-green-100 text-green-700' : 
                                                    m.type === 'sangria' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {m.type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-700">{m.description}</td>
                                            <td className={`p-3 text-right font-bold ${
                                                m.type === 'sangria' ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                                {m.type === 'sangria' ? '- ' : '+ '}
                                                R$ {m.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    {session.movements.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                                Nenhuma movimentação registrada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Summary / Calculator */}
                    <Card title="Resumo do Fechamento" icon={<Calculator size={20}/>}>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Abertura</span>
                                    <span className="font-medium">R$ {session.openingBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Total Entradas</span>
                                    <span className="font-medium text-green-600">+ R$ {(stats.vendas + stats.suprimentos).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Total Saídas</span>
                                    <span className="font-medium text-red-600">- R$ {stats.sangrias.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-bold">
                                    <span className="text-slate-700">Saldo Calculado</span>
                                    <span className="text-slate-900">R$ {stats.currentBalance.toFixed(2)}</span>
                                </div>
                            </div>

                            {session.status === 'fechado' && session.difference !== undefined && (
                                <div className={`p-4 rounded-xl border ${session.difference === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <p className="text-xs font-bold uppercase mb-1 text-slate-500">Resultado do último fechamento</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">Diferença</span>
                                        <span className={`font-bold ${session.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            R$ {session.difference.toFixed(2)}
                                        </span>
                                    </div>
                                    {session.difference !== 0 && (
                                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                                            <AlertTriangle size={12}/> Valor em gaveta não bateu com sistema.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {modalType && (
                <OperationModal 
                    type={modalType} 
                    currentBalance={stats.currentBalance}
                    onClose={() => setModalType(null)} 
                    onConfirm={handleOperation} 
                />
            )}
        </div>
    );
};

export default CaixaView;
