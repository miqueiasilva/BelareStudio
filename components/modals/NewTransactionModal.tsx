import React, { useState } from 'react';
import { X, DollarSign, Calendar, Tag, Plus } from 'lucide-react';
import { FinancialTransaction, TransactionType, TransactionCategory, PaymentMethod } from '../../types';

interface NewTransactionModalProps {
  onClose: () => void;
  onSave: (transaction: FinancialTransaction | any[]) => void;
  type: TransactionType;
}

const NewTransactionModal: React.FC<NewTransactionModalProps> = ({ onClose, onSave, type }) => {
  const [formData, setFormData] = useState<Partial<FinancialTransaction>>({
    type: type,
    date: new Date().toISOString().split('T')[0],
    status: 'pago',
    payment_method: 'pix',
    category: ''
  });

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [launchType, setLaunchType] = useState<'unico' | 'parcelado' | 'recorrente'>('unico');
  const [interval, setInterval] = useState<'semanal' | 'quinzenal' | 'mensal' | 'anual'>('mensal');
  const [quantity, setQuantity] = useState(2);

  const receitaCategories = ['Venda de Serviços', 'Venda de Produtos', 'Aporte / Investimento', 'Outros'];
  const despesaCategories = [
    'Aluguel', 'Energia / Luz', 'Água', 'Internet / Telefone', 
    'Produtos / Estoque', 'Comissão Profissional', 'Marketing', 
    'Manutenção', 'Impostos', 'Salários / Pró-labore', 'Outros'
  ];

  const activeCategories = type === 'receita' ? receitaCategories : despesaCategories;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleCategoryMode = () => {
    setIsCustomCategory(!isCustomCategory);
    setFormData(prev => ({ ...prev, category: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.description || !formData.amount || !formData.category) {
          alert('Preencha os campos obrigatórios (Descrição, Valor e Categoria)');
          return;
      }
      
      const baseTransaction = {
          description: formData.description!,
          amount: Number(formData.amount),
          type: formData.type!,
          category: formData.category!,
          payment_method: formData.payment_method as PaymentMethod,
          status: 'pago' as const
      };

      if (launchType !== 'unico') {
          const transactions: any[] = [];
          const startDate = new Date(formData.date || new Date().toISOString().split('T')[0]);
          
          for (let i = 1; i <= quantity; i++) {
              const nextDate = new Date(startDate);
              let daysToAdd = 0;
              if (interval === 'semanal') daysToAdd = 7 * (i - 1);
              else if (interval === 'quinzenal') daysToAdd = 15 * (i - 1);
              else if (interval === 'mensal') daysToAdd = 30 * (i - 1);
              else if (interval === 'anual') daysToAdd = 365 * (i - 1);
              
              nextDate.setDate(startDate.getDate() + daysToAdd);
              
              const isParcelado = launchType === 'parcelado';
              const suffix = isParcelado ? `(Parcela ${i}/${quantity})` : `(Recorrência ${i}/${quantity})`;
              
              transactions.push({
                  ...baseTransaction,
                  amount: isParcelado ? Number(formData.amount) / quantity : Number(formData.amount),
                  description: `${baseTransaction.description} ${suffix}`,
                  date: nextDate,
                  installments: isParcelado ? quantity : undefined
              });
          }
          onSave(transactions);
      } else {
          onSave({
              ...baseTransaction,
              date: new Date(formData.date || new Date().toISOString().split('T')[0]),
          } as FinancialTransaction);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <header className={`p-4 flex justify-between items-center ${type === 'receita' ? 'bg-green-500' : 'bg-rose-500'} text-white`}>
                <h3 className="text-lg font-bold flex items-center gap-2">
                    {type === 'receita' ? <DollarSign className="w-5 h-5"/> : <Tag className="w-5 h-5"/>}
                    Nova {type === 'receita' ? 'Receita' : 'Despesa'}
                </h3>
                <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                    <X size={20}/>
                </button>
            </header>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição do Lançamento</label>
                    <input 
                        name="description" 
                        type="text" 
                        autoFocus
                        placeholder={type === 'receita' ? "Ex: Venda de Kit Cílios" : "Ex: Conta de Energia - Ref Outubro"} 
                        className="w-full border-b border-slate-200 py-2.5 focus:outline-none focus:border-slate-400 font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-300 transition-colors"
                        onChange={handleChange}
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                        <div className="relative">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 font-bold">R$</span>
                            <input 
                                name="amount" 
                                type="number" 
                                step="0.01"
                                placeholder="0,00" 
                                className="w-full border-b border-slate-200 pl-7 py-2.5 focus:outline-none focus:border-slate-400 font-black text-xl text-slate-800 placeholder:text-slate-200 transition-colors"
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                        <div className="flex items-center gap-2 border-b border-slate-200 py-2.5">
                            <Calendar className="w-4 h-4 text-slate-400"/>
                            <input 
                                name="date" 
                                type="date" 
                                defaultValue={formData.date}
                                className="w-full focus:outline-none bg-transparent text-sm font-bold text-slate-600"
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                    <div className="flex items-end gap-3 group">
                        <div className="flex-1">
                            {isCustomCategory ? (
                                <div className="animate-in slide-in-from-left-2 duration-200">
                                    <input 
                                        name="category"
                                        type="text"
                                        autoFocus
                                        placeholder="Digite o nome da nova categoria..."
                                        className="w-full border-b border-slate-200 py-2.5 focus:outline-none focus:border-orange-400 font-bold text-orange-600 placeholder:text-slate-300 placeholder:font-medium transition-all"
                                        onChange={handleChange}
                                    />
                                </div>
                            ) : (
                                <select 
                                    name="category" 
                                    className="w-full border-b border-slate-200 py-2.5 focus:outline-none focus:border-slate-400 bg-transparent text-sm font-bold text-slate-600 cursor-pointer appearance-none transition-colors"
                                    onChange={handleChange}
                                    value={formData.category}
                                >
                                    <option value="" disabled>Selecione uma categoria...</option>
                                    {activeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            )}
                        </div>
                        <button 
                            type="button"
                            onClick={toggleCategoryMode}
                            className={`p-2.5 rounded-xl transition-all shadow-sm ${
                                isCustomCategory 
                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                                : 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white'
                            }`}
                            title={isCustomCategory ? "Voltar para lista" : "Cadastrar nova categoria"}
                        >
                            {isCustomCategory ? <X size={18} /> : <Plus size={18} />}
                        </button>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                    <select 
                        name="payment_method" 
                        className="w-full border-b border-slate-200 py-2.5 focus:outline-none focus:border-slate-400 bg-transparent text-sm font-bold text-slate-600 cursor-pointer transition-colors"
                        onChange={handleChange}
                        value={formData.payment_method}
                    >
                        <option value="pix">Pix</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="cartao_debito">Cartão de Débito</option>
                        <option value="dinheiro">Dinheiro em Espécie</option>
                        <option value="transferencia">Transferência Bancária</option>
                        <option value="boleto">Boleto</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Lançamento</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {(['unico', 'parcelado', 'recorrente'] as const).map((lType) => (
                            <button
                                key={lType}
                                type="button"
                                onClick={() => setLaunchType(lType)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    launchType === lType 
                                    ? 'bg-white text-slate-800 shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {lType === 'unico' ? 'Único' : lType === 'parcelado' ? 'Parcelado' : 'Recorrente'}
                            </button>
                        ))}
                    </div>
                </div>

                {launchType !== 'unico' && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Intervalo</label>
                            <select 
                                value={interval}
                                onChange={(e) => setInterval(e.target.value as any)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-orange-400"
                            >
                                <option value="semanal">Semanal (7 dias)</option>
                                <option value="quinzenal">Quinzenal (15 dias)</option>
                                <option value="mensal">Mensal (30 dias)</option>
                                <option value="anual">Anual (365 dias)</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                            <input 
                                type="number" 
                                min="2" 
                                max="52" 
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 outline-none focus:border-orange-400"
                            />
                        </div>
                    </div>
                )}

                <div className="pt-4">
                    <button 
                        type="submit" 
                        className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                            type === 'receita' 
                            ? 'bg-green-600 hover:bg-green-700 shadow-green-100' 
                            : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                        }`}
                    >
                        Confirmar Lançamento
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default NewTransactionModal;