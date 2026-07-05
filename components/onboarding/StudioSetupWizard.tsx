import React, { useState } from 'react';
import { 
  Plus, 
  MapPin, 
  Phone, 
  Scissors, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  CheckCircle2,
  Building2,
  Palmtree,
  Zap
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useStudio } from '../../contexts/StudioContext';
import { toast } from 'react-hot-toast';

const StudioSetupWizard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { refreshStudios } = useStudio();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'beleza',
    phone: '',
    address: ''
  });

  const categories = [
    { id: 'beleza', name: 'Salão de Beleza', icon: Scissors, color: 'text-pink-500', bg: 'bg-pink-50' },
    { id: 'barbearia', name: 'Barbearia', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'estetica', name: 'Clínica de Estética', icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'spa', name: 'Spa & Wellness', icon: Palmtree, color: 'text-emerald-500', bg: 'bg-emerald-50' }
  ];

  const handleCreateStudio = async () => {
    if (!formData.name) return toast.error("Dê um nome ao seu estúdio!");
    
    setLoading(true);
    try {
      // 1. Criar o Estúdio
      const { data: studio, error: sError } = await supabase
        .from('studios')
        .insert([{ 
          name: formData.name,
          category: formData.category,
          contact_phone: formData.phone,
          address: formData.address
        }])
        .select()
        .single();

      if (sError) throw sError;

      // 2. Criar a configuração inicial do estúdio
      await supabase.from('studio_settings').insert([{
        studio_id: studio.id,
        theme_color: '#f97316',
        business_hours: {
          'seg': { open: '09:00', close: '18:00', active: true },
          'ter': { open: '09:00', close: '18:00', active: true },
          'qua': { open: '09:00', close: '18:00', active: true },
          'qui': { open: '09:00', close: '18:00', active: true },
          'sex': { open: '09:00', close: '18:00', active: true },
          'sab': { open: '09:00', close: '18:00', active: true },
          'dom': { open: '09:00', close: '18:00', active: false }
        }
      }]);

      // 3. Vincular o usuário como Dono/Admin na team_members
      const { error: tmError } = await supabase
        .from('team_members')
        .insert([{
          studio_id: studio.id,
          name: user?.nome || user?.email?.split('@')[0],
          email: user?.email,
          access_level: 'admin',
          active: true,
          role: 'Proprietário'
        }]);

      if (tmError) throw tmError;

      // 4. Vincular na user_studios
      await supabase.from('user_studios').insert([{
        user_id: user?.id,
        studio_id: studio.id,
        role: 'admin'
      }]);

      toast.success("Estúdio criado com sucesso!");
      setStep(3); // Sucesso
      
      // Delay para o usuário ver o sucesso antes de atualizar
      setTimeout(() => {
        refreshStudios(true);
      }, 2000);

    } catch (error: any) {
      console.error("Erro ao criar estúdio:", error);
      toast.error("Ocorreu um erro ao criar seu estúdio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full bg-white rounded-[48px] shadow-2xl p-10 md:p-16 border border-slate-100 relative overflow-hidden">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-10">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${step === i ? 'w-8 bg-orange-500' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-black text-slate-800">Seja bem-vindo!</h1>
              <p className="text-slate-500 font-medium">Vamos começar configurando seu estúdio.</p>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome do seu Estúdio</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Ex: Bela Studio Prime"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-slate-800 font-bold focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
                    />
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tipo de Negócio</label>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setFormData({...formData, category: cat.id})}
                        className={`
                          p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3
                          ${formData.category === cat.id ? 'border-orange-500 bg-orange-50/50' : 'border-slate-50 bg-white hover:border-slate-200'}
                        `}
                      >
                        <div className={`w-10 h-10 rounded-xl ${cat.bg} ${cat.color} flex items-center justify-center`}>
                          <cat.icon size={20} />
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-tight ${formData.category === cat.id ? 'text-slate-900' : 'text-slate-400'}`}>
                          {cat.name}
                        </span>
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <div className="pt-4 flex flex-col gap-3">
               <button 
                 onClick={() => setStep(2)}
                 disabled={!formData.name}
                 className="w-full bg-slate-900 text-white font-black py-5 rounded-[24px] flex items-center justify-center gap-2 shadow-xl hover:shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
               >
                 Próximo Passo <ArrowRight size={20} />
               </button>
               <button onClick={signOut} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors mt-2">Sair da Conta</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-black text-slate-800 text-left">Quase lá...</h1>
              <p className="text-slate-500 font-medium text-left">Só mais alguns dados para seus clientes te encontrarem.</p>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">WhatsApp de Contato</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-slate-800 font-bold focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
                    />
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Endereço (Opcional)</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-500 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      placeholder="Rua, Número, Bairro"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-slate-800 font-bold focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
                    />
                  </div>
               </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-100 text-slate-600 font-black py-5 rounded-[24px]"
              >
                Voltar
              </button>
              <button 
                onClick={handleCreateStudio}
                disabled={loading}
                className="flex-[2] bg-orange-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : <>Criar Estúdio <CheckCircle2 size={20} /></>}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-10 space-y-8 animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[32px] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 border border-emerald-100">
              <CheckCircle2 size={48} strokeWidth={3} />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-800">Tudo pronto!</h2>
              <p className="text-slate-500 font-medium">Seu estúdio foi configurado. Redirecionando para o painel...</p>
            </div>
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
          </div>
        )}

        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Zap size={120} />
        </div>
      </div>
    </div>
  );
};

export default StudioSetupWizard;
