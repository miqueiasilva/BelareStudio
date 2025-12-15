
import React, { useState } from 'react';
import Card from '../shared/Card';
import { Calendar, Clock, Scissors, User, Sparkles, CheckCircle, ArrowRight, Star } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const clientData = {
  name: "Juliana Paes",
  nextAppointment: {
    service: "Corte Feminino",
    professional: "Maria Silva",
    date: new Date(new Date().setDate(new Date().getDate() + 3)),
    time: "11:00"
  },
  history: [
    { service: "Manicure", professional: "Ana Costa", date: new Date(new Date().setDate(new Date().getDate() - 15)), rating: 5 },
    { service: "Corte e Escova", professional: "Maria Silva", date: new Date(new Date().setDate(new Date().getDate() - 45)), rating: 5 },
  ],
  promotions: [
    { title: "Combo Hidratação + Escova", description: "Cabelos renovados com 20% de desconto!", icon: <Sparkles className="w-6 h-6 text-white"/>, bg: 'bg-gradient-to-tr from-amber-400 to-yellow-500' },
    { title: "Pé e Mão toda Quarta!", description: "Faça pé e mão e ganhe a esmaltação especial.", icon: <Sparkles className="w-6 h-6 text-white"/>, bg: 'bg-gradient-to-tr from-pink-400 to-rose-500' },
  ]
};

const services = ["Corte Feminino", "Coloração", "Manicure", "Pedicure", "Escova Progressiva", "Barba Terapia"];
const professionals = ["Maria Silva", "João Pereira", "Ana Costa"];
const times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];


const BookingWizard: React.FC<{onClose: () => void}> = ({ onClose }) => {
    const [step, setStep] = useState(1);
    const [selection, setSelection] = useState({ service: '', professional: '', date: '', time: '' });

    const handleSelect = (field: keyof typeof selection, value: string) => {
        setSelection(prev => ({ ...prev, [field]: value }));
        if (step < 4) setStep(step + 1);
    };
    
    const StepIndicator = ({ num, label, active }: { num: number, label: string, active: boolean }) => (
        <div className={`flex items-center gap-2 ${active ? 'text-cyan-600' : 'text-slate-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${active ? 'bg-cyan-600 text-white' : 'bg-slate-200'}`}>
                {selection[Object.keys(selection)[num-1] as keyof typeof selection] ? <CheckCircle size={16}/> : num}
            </div>
            <span>{label}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card title="Novo Agendamento" className="w-full max-w-2xl">
                <div className="flex justify-around mb-6 pb-4 border-b">
                    <StepIndicator num={1} label="Serviço" active={step >= 1} />
                    <StepIndicator num={2} label="Profissional" active={step >= 2} />
                    <StepIndicator num={3} label="Horário" active={step >= 3} />
                    <StepIndicator num={4} label="Confirmar" active={step >= 4} />
                </div>

                {step === 1 && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{services.map(s => <button key={s} onClick={() => handleSelect('service', s)} className="p-4 bg-slate-100 hover:bg-cyan-100 rounded-lg text-center font-medium transition">{s}</button>)}</div>}
                {step === 2 && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{professionals.map(p => <button key={p} onClick={() => handleSelect('professional', p)} className="p-4 bg-slate-100 hover:bg-cyan-100 rounded-lg text-center font-medium transition">{p}</button>)}</div>}
                {step === 3 && <div className="grid grid-cols-3 md:grid-cols-4 gap-3">{times.map(t => <button key={t} onClick={() => handleSelect('time', t)} className="p-4 bg-slate-100 hover:bg-cyan-100 rounded-lg text-center font-medium transition">{t}</button>)}</div>}
                
                {step === 4 && (
                    <div className="text-center space-y-4">
                        <h4 className="text-xl font-bold">Confirme seu Agendamento</h4>
                        <p className="text-slate-600">Serviço: <span className="font-semibold">{selection.service}</span></p>
                        <p className="text-slate-600">Profissional: <span className="font-semibold">{selection.professional}</span></p>
                        <p className="text-slate-600">Horário: <span className="font-semibold">{selection.time}</span> de <span className="font-semibold">Amanhã</span></p>
                        <div className="flex gap-4 justify-center pt-4">
                            <button onClick={onClose} className="px-6 py-2 bg-slate-200 rounded-lg font-semibold">Cancelar</button>
                            <button onClick={onClose} className="px-6 py-2 bg-cyan-600 text-white rounded-lg font-semibold">Confirmar</button>
                        </div>
                    </div>
                )}
                 {step < 4 && <div className="flex justify-end mt-6"><button onClick={onClose} className="px-6 py-2 bg-slate-200 rounded-lg font-semibold">Fechar</button></div>}
            </Card>
        </div>
    );
};


const ClientPortal: React.FC = () => {
  const [isBooking, setIsBooking] = useState(false);

  return (
    <div className="space-y-6">
      {isBooking && <BookingWizard onClose={() => setIsBooking(false)} />}
      <h2 className="text-2xl font-bold">Bem-vinda de volta, {clientData.name}!</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="md:col-span-2 lg:col-span-1 bg-cyan-600 text-white shadow-lg">
          <p className="text-sm text-cyan-200">Seu próximo agendamento</p>
          <p className="text-2xl font-bold mt-2">{clientData.nextAppointment.service}</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-cyan-100"><Calendar size={16}/> <span>{format(clientData.nextAppointment.date, "EEEE, dd 'de' MMMM", { locale: pt })}</span></div>
            <div className="flex items-center gap-2 text-cyan-100"><Clock size={16}/> <span>{clientData.nextAppointment.time}</span></div>
            <div className="flex items-center gap-2 text-cyan-100"><Scissors size={16}/> <span>{clientData.nextAppointment.professional}</span></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold py-2 px-4 rounded-lg transition">Reagendar</button>
            <button className="flex-1 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold py-2 px-4 rounded-lg transition">Cancelar</button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
            <button onClick={() => setIsBooking(true)} className="w-full bg-white p-6 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center justify-between text-cyan-700">
                <div className="text-left">
                    <h3 className="text-xl font-bold">Agendar um novo serviço</h3>
                    <p className="text-slate-500">Rápido, fácil e online.</p>
                </div>
                <div className="p-3 bg-cyan-100 rounded-full">
                    <ArrowRight className="w-6 h-6"/>
                </div>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {clientData.promotions.map(promo => (
                    <div key={promo.title} className={`p-5 rounded-xl text-white flex items-start gap-4 ${promo.bg}`}>
                        <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">{promo.icon}</div>
                        <div>
                            <h4 className="font-bold">{promo.title}</h4>
                            <p className="text-sm opacity-90 mt-1">{promo.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>

      <Card title="Seu Histórico de Atendimentos">
        <div className="divide-y divide-slate-100">
          {clientData.history.map((item) => (
            <div key={`${item.service}-${item.date.toISOString()}`} className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3">
              <div>
                <p className="font-semibold">{item.service}</p>
                <p className="text-sm text-slate-500">com {item.professional} em {format(item.date, 'dd/MM/yyyy')}</p>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-sm text-slate-600">Sua avaliação:</span>
                <div className="flex items-center gap-1 text-amber-500 font-bold">
                    {item.rating} <Star size={16} className="fill-current text-amber-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ClientPortal;