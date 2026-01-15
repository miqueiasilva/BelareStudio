import React, { useState } from 'react';
import { X, Sparkles, BrainCircuit, CalendarCheck, FileBarChart } from 'lucide-react';
import * as geminiService from '../services/geminiService';

interface JaciBotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const JaciBotPanel: React.FC<JaciBotPanelProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleAction = async (action: 'suggest' | 'remind' | 'close') => {
    setLoading(action);
    setResult(null);
    try {
      if (action === 'suggest') {
        const slots = await geminiService.suggestSmartSlots(new Date());
        setResult({ title: 'Sugestão de Encaixes', data: slots });
      } else if (action === 'remind') {
         // In a real app, you'd trigger this for all pending appointments
        const response = await geminiService.enqueueReminder(1, 'lembrete');
        setResult({ title: 'Envio de Lembretes', data: [response.message] });
      } else if (action === 'close') {
        const response = await geminiService.autoCashClose(new Date());
        setResult({ title: 'Fechamento do Dia', data: [response.resumo, `Diferença: R$ ${response.diferenca.toFixed(2)}`] });
      }
    } catch (error) {
      console.error("Error with JaciBot action:", error);
      setResult({ title: 'Erro', data: ['Ocorreu um erro ao processar a solicitação.'] });
    } finally {
      setLoading(null);
    }
  };


  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[#705336]" />
            <h2 className="text-lg font-bold">Assistente JaciBot</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600">Use a inteligência artificial para otimizar suas tarefas diárias.</p>
            <button onClick={() => handleAction('suggest')} disabled={!!loading} className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50">
                <BrainCircuit className="w-5 h-5 text-slate-500" />
                <span className="font-semibold">Sugerir encaixes na agenda</span>
            </button>
            <button onClick={() => handleAction('remind')} disabled={!!loading} className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50">
                <CalendarCheck className="w-5 h-5 text-slate-500" />
                <span className="font-semibold">Enviar confirmações do dia</span>
            </button>
            <button onClick={() => handleAction('close')} disabled={!!loading} className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50">
                <FileBarChart className="w-5 h-5 text-slate-500" />
                <span className="font-semibold">Realizar fechamento do dia</span>
            </button>
        </div>

        <div className="flex-1 p-4 border-t bg-slate-50 overflow-y-auto">
            <h3 className="font-semibold mb-2">Resultados</h3>
            {loading && <p className="text-sm text-slate-500">Processando: {loading}...</p>}
            {result && (
                <div className="text-sm bg-white p-3 rounded-lg shadow-sm">
                    <h4 className="font-bold mb-2">{result.title}</h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                        {result.data.map((item: string, index: number) => <li key={index}>{item}</li>)}
                    </ul>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default JaciBotPanel;
