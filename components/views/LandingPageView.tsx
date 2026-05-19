import React from 'react';
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  Smartphone, 
  ShieldCheck, 
  Zap,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  MessageSquare,
  BarChart3,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePWA } from '../../hooks/usePWA';

interface LandingPageViewProps {
  onLogin: () => void;
}

const LandingPageView: React.FC<LandingPageViewProps> = ({ onLogin }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { isInstallable, promptInstall } = usePWA();

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (success) return;
    }
    
    // Fallback: Smooth scroll to #instalar section
    const element = document.getElementById('instalar');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.hash = 'instalar';
    }
  };

  const features = [
    {
      title: "Recupere 37% das Faltas",
      description: "Lembretes automáticos via WhatsApp que confirmam o horário e reduzem o 'bolo' no seu faturamento.",
      icon: MessageSquare,
      color: "text-emerald-500",
      bg: "bg-emerald-50"
    },
    {
      title: "DRE em Tempo Real",
      description: "Saiba exatamente quanto sobrou de lucro hoje. Sem surpresas no fim do mês ou planilhas confusas.",
      icon: BarChart3,
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      title: "Marketing por IA",
      description: "A Jaci (nossa IA) analisa quem parou de ir e cria campanhas automáticas para trazer elas de volta.",
      icon: Sparkles,
      color: "text-purple-500",
      bg: "bg-purple-50"
    },
    {
      title: "Agenda 24h Disponível",
      description: "Pare de atender WhatsApp à meia-noite. Seu link de agendamento trabalha enquanto você descansa.",
      icon: Calendar,
      color: "text-orange-500",
      bg: "bg-orange-50"
    }
  ];

  const plans = [
    {
      name: "Starter",
      sub: "Para profissionais autônomos",
      price: "R$ 49,90",
      period: "/mês",
      description: "Tudo o que você precisa para sair do papel e da agenda física.",
      features: [
        "Agenda Online Personalizada",
        "Até 50 agendamentos/mês",
        "Controle de Caixa Básico",
        "Suporte via e-mail"
      ],
      cta: "Começar Agora",
      highlight: false
    },
    {
      name: "Growth",
      sub: "Para estúdios que querem escalar",
      price: "R$ 89,90",
      period: "/mês",
      description: "O segredo dos estúdios que crescem rápido e com organização.",
      features: [
        "Agendamentos Ilimitados",
        "Lembretes Automáticos WhatsApp",
        "Gestão de Comissões e Equipe",
        "DRE e Relatórios Financeiros",
        "Consultoria de Implantação"
      ],
      cta: "Testar Grátis 7 Dias",
      highlight: true
    },
    {
      name: "Professional",
      sub: "Para operações de alto padrão",
      price: "R$ 149,90",
      period: "/mês",
      description: "A potência máxima em inteligência e automação para o seu negócio.",
      features: [
        "Tudo do plano Growth",
        "IA Ilimitada (Marketing e Análise)",
        "Gestão Multi-unidades",
        "API para Integrações",
        "Gerente de Conta Exclusivo"
      ],
      cta: "Falar com Consultor",
      highlight: false
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">B</div>
            <span className="text-xl font-black tracking-tighter text-slate-900">BelareStudio</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500">
            <button onClick={handleInstallClick} className="text-[#b5895a] hover:opacity-80 transition-opacity font-extrabold flex items-center gap-1.5 cursor-pointer">
              <Smartphone size={16} /> Instalar App
            </button>
            <button onClick={onLogin} className="text-slate-900 hover:opacity-70 transition-opacity">Entrar</button>
            <button onClick={onLogin} className="bg-slate-900 text-white px-6 py-3 rounded-xl hover:shadow-xl transition-all active:scale-95 shadow-lg shadow-slate-900/10">Testar Grátis</button>
          </div>

          <button className="md:hidden p-2 text-slate-900" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 p-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
            <button onClick={() => { onLogin(); setIsMenuOpen(false); }} className="w-full text-left text-lg font-bold">Entrar</button>
            <button onClick={() => { handleInstallClick(); setIsMenuOpen(false); }} className="w-full text-left text-lg font-bold text-[#b5895a]">Instalar Aplicativo</button>
            <button onClick={() => { onLogin(); setIsMenuOpen(false); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl underline underline-offset-4 decoration-orange-500">Começar Teste Grátis</button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 overflow-hidden bg-gradient-to-b from-white to-slate-50/50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-orange-100">
              <Zap size={14} fill="currentColor" /> Gestão que gera lucro real
            </div>
            <h1 className="text-6xl md:text-7xl font-black leading-[0.9] tracking-tighter text-slate-900">
              Seu estúdio perde dinheiro todos os dias <br/> <span className="text-orange-500">sem você perceber.</span>
            </h1>
            <p className="text-xl text-slate-500 max-w-lg leading-relaxed font-medium">
              O BelareStudio organiza sua agenda, automatiza cobranças, reduces faltas e mostra quanto seu estúdio realmente lucra enquanto você atende.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={onLogin} className="bg-slate-900 text-white px-10 py-6 rounded-3xl text-xl font-black shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:shadow-slate-300 transition-all active:scale-95 flex items-center justify-center gap-3">
                Começar Teste Grátis <ArrowRight size={20} />
              </button>
              <button onClick={handleInstallClick} className="bg-[#b5895a] hover:bg-[#a47a4d] text-white px-10 py-6 rounded-3xl text-xl font-black shadow-[0_20px_50px_rgba(181,137,90,0.2)] transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer">
                <Smartphone size={20} /> Instalar no Celular
              </button>
            </div>
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm">
                    <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="User" />
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold text-slate-400">
                Junte-se a <span className="text-slate-900 underline decoration-emerald-400">+500 estúdios</span> de alto padrão.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 bg-slate-900 rounded-[60px] p-6 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-8 border-slate-800 rotate-1">
              <div className="bg-white h-full w-full rounded-[40px] overflow-hidden p-6 flex flex-col gap-6">
                 {/* Preview "Real" do Dashboard */}
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Lucro Hoje</p>
                        <p className="text-2xl font-black text-emerald-600 tracking-tighter">R$ 1.842,50</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                        <TrendingUp size={24} />
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Próximos Verificados</p>
                    {[1,2].map(i => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100"></div>
                                <div>
                                    <p className="text-xs font-black">Cliente VIP</p>
                                    <p className="text-[10px] text-slate-400">Agendado via Link Online</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Confirmado</span>
                        </div>
                    ))}
                 </div>

                 <div className="bg-slate-900 text-white p-5 rounded-[32px] space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={48} /></div>
                    <p className="text-[10px] font-black uppercase text-orange-400">Insight da Jaci (IA)</p>
                    <p className="text-xs font-medium leading-relaxed">"Detectamos 3 clientes inativos há 45 dias. Deseja enviar uma oferta de retorno?"</p>
                    <button className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">Ativar Campanha</button>
                 </div>
              </div>
            </div>
            
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] aspect-square bg-gradient-to-tr from-orange-100 via-white to-blue-100 rounded-full blur-[100px] opacity-40"></div>
          </motion.div>
        </div>
      </main>

      {/* Pain Section */}
      <section className="py-32 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-500 rounded-full blur-[150px]"></div>
        </div>
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center relative z-10">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.9]">Seu estúdio ainda <br/> <span className="text-rose-500">vive assim?</span></h2>
            <div className="grid gap-6">
              {[
                { pain: "Agenda cheia... mas dinheiro sumindo no fim do mês.", icon: X },
                { pain: "Clientes esquecendo horários e deixando buracos na agenda.", icon: X },
                { pain: "Você respondendo WhatsApp até meia-noite pra marcar serviço.", icon: X },
                { pain: "Sem saber quanto realmente sobrou de lucro no fim do dia.", icon: X },
                { pain: "Comissões da equipe virando motivo de confusão.", icon: X }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <item.icon size={16} strokeWidth={4} />
                  </div>
                  <p className="text-lg font-bold text-slate-300">{item.pain}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-[60px] p-12 text-slate-900 border border-white/20 shadow-2xl space-y-8">
            <p className="text-3xl font-black tracking-tighter leading-tight">
              "Eu achava que gerenciava bem, até usar o Belare. Descobri que <span className="text-orange-500 underline decoration-orange-200">perdia R$ 2.400 por mês</span> só em faltas e má gestão de tempo."
            </p>
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                   <img src="https://i.pravatar.cc/100?img=32" alt="Relato" />
                </div>
                <div>
                   <p className="text-base font-black">Roberta Almeida</p>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Studio Roberta Beauty</p>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section - Real Evidence */}
      <section className="py-32 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.4em]">Evidência Real</h2>
            <p className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">O software que você <br className="hidden md:block" /> vai amar usar todo dia.</p>
            <p className="text-slate-500 font-medium">Interface intuitiva, pensada para quem tem pressa e exige precisão. Sem menus confusos ou excesso de cliques.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-[48px] p-8 md:p-12 border border-slate-100 shadow-xl space-y-8 group overflow-hidden">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase tracking-widest">
                        <DollarSign size={14} /> Financeiro Inteligente
                    </div>
                    <h3 className="text-3xl font-black tracking-tight">O lucro nas suas mãos.</h3>
                </div>
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 transition-transform group-hover:scale-[1.02]">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase">Faturamento Mensal</p>
                            <p className="text-3xl font-black text-slate-900">R$ 54.320,00</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-500 uppercase">Meta Alcanada</p>
                            <p className="text-xl font-black text-emerald-600">92%</p>
                        </div>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-[92%] transition-all duration-1000"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Custos Fixos</p>
                            <p className="text-sm font-black">R$ 12.400</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Lucro Líquido</p>
                            <p className="text-sm font-black text-emerald-600">R$ 41.920</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 rounded-[48px] p-8 md:p-12 border border-slate-800 shadow-xl space-y-8 group overflow-hidden text-white">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-orange-400 font-black text-xs uppercase tracking-widest">
                        <Calendar size={14} /> Agenda Multi-canal
                    </div>
                    <h3 className="text-3xl font-black tracking-tight">Adeus furos na agenda.</h3>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 transition-transform group-hover:scale-[1.02]">
                    <div className="space-y-4">
                        {[
                            { name: "Ana Paula", time: "14:30", svc: "Design de Sobrancelha", status: "Confirmado" },
                            { name: "Jessica S.", time: "16:00", svc: "Micropigmentação", status: "Confirmado" },
                            { name: "Carla R.", time: "18:00", svc: "Corte + Hidratação", status: "Aguardando" }
                        ].map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-black text-xs">{a.time}</div>
                                    <div>
                                        <p className="text-sm font-black">{a.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{a.svc}</p>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${a.status === 'Confirmado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                    {a.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions / Features */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="text-center space-y-4">
            <h2 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.4em]">A Solução Indispensável</h2>
            <p className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">O cérebro que seu <br/> estúdio merece.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-slate-50 p-10 rounded-[48px] border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all group overflow-hidden relative">
                <div className={`${feature.bg} ${feature.color} w-16 h-16 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-sm`}>
                  <feature.icon size={32} />
                </div>
                <h3 className="text-xl font-black mb-4 text-slate-900 tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm font-medium">{feature.description}</p>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IA Section - THE GAME CHANGER */}
      <section className="py-32 px-6 bg-gradient-to-br from-slate-950 to-slate-900 text-white overflow-hidden relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8 animate-pulse-slow">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-500/30">
              <Sparkles size={14} fill="currentColor" /> Inteligência Real
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.9] tracking-tighter">Sua nova sócia <br/> se chama <span className="text-orange-500">Jaci.</span></h2>
            <div className="space-y-6">
                <p className="text-xl text-slate-400 font-medium leading-relaxed">
                  Não é apenas IA, é lucro automatizado. A Jaci trabalha 24h analisando seus dados para que você tome as melhores decisões.
                </p>
                <ul className="grid gap-4">
                    {[
                        "Recuperação automática de clientes inativos",
                        "Análise preditiva de faturamento mensal",
                        "Sugestões de marketing baseadas no seu público",
                        "Insights de produtividade da sua equipe"
                    ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-300 font-bold">
                            <CheckCircle2 size={18} className="text-orange-500" /> {item}
                        </li>
                    ))}
                </ul>
            </div>
          </div>
          <div className="relative">
            <div className="bg-white/5 backdrop-blur-3xl rounded-[60px] p-8 border border-white/10 shadow-2xl space-y-6">
                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                    <div className="w-14 h-14 bg-orange-500 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <Sparkles size={28} className="text-white" />
                    </div>
                    <div>
                        <p className="text-lg font-black tracking-tight">IA Belare Studio</p>
                        <p className="text-xs text-orange-400 font-black uppercase tracking-widest">Processando Atividade...</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Insight de Hoje</p>
                        <p className="text-sm font-medium leading-relaxed">"Sua taxa de ocupação na quarta-feira é 40% menor que o normal. Sugiro liberar um cupom 'Sweet Midweek' para clientes recorrentes."</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                            <p className="text-[10px] font-black text-emerald-500 uppercase">Faltas Evitadas</p>
                            <p className="text-xl font-black text-emerald-400">12 este mês</p>
                        </div>
                        <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                            <p className="text-[10px] font-black text-blue-500 uppercase">Clientes VIP</p>
                            <p className="text-xl font-black text-blue-400">42 Retidos</p>
                        </div>
                    </div>
                </div>
                <button className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20">Implementar Sugestão</button>
            </div>
            {/* Elementos flutuantes IA */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-orange-500 opacity-20 blur-3xl rounded-full"></div>
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500 opacity-20 blur-3xl rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Pricing - Emotional & Clear */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h2 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.4em]">Invista no seu Crescimento</h2>
            <p className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Planos para todos os momentos. <br/> <span className="text-slate-400">Pague pelo que você usa.</span></p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <div 
                key={i} 
                className={`
                  p-12 rounded-[56px] flex flex-col gap-10 transition-all duration-500
                  ${plan.highlight ? 'bg-slate-900 text-white scale-105 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] relative z-10 border-4 border-orange-500' : 'bg-white border border-slate-100 hover:border-slate-200'}
                `}
              >
                {plan.highlight && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                    Mais Recomendado
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-black mb-1">{plan.name}</h3>
                  <p className={`text-xs font-black uppercase tracking-widest ${plan.highlight ? 'text-orange-400' : 'text-slate-400'}`}>{plan.sub}</p>
                  <p className={`text-sm mt-4 leading-relaxed font-medium ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>{plan.description}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black tracking-tighter">{plan.price}</span>
                  <span className={`text-sm font-bold ${plan.highlight ? 'text-slate-500' : 'text-slate-400'}`}>{plan.period}</span>
                </div>
                <div className="space-y-4 flex-1">
                  {plan.features.map((feat, j) => (
                    <div key={j} className="flex items-start gap-4">
                      <CheckCircle2 size={18} className={plan.highlight ? 'text-orange-500' : 'text-emerald-500'} strokeWidth={3} />
                      <span className="text-sm font-bold opacity-90">{feat}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={onLogin}
                  className={`
                    w-full py-6 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl
                    ${plan.highlight ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20' : 'bg-slate-900 text-white hover:bg-slate-800'}
                  `}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manual PWA Install Instructions Section */}
      <section id="instalar" className="py-24 px-6 bg-white border-t border-slate-100 scroll-mt-20">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-[#b5895a] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-amber-100/50">
              <Smartphone size={14} /> Aplicativo Web Progressivo (PWA)
            </div>
            <h2 className="text-4xl font-black tracking-tighter">Como Instalar no seu Celular</h2>
            <p className="text-slate-500 max-w-lg mx-auto text-sm font-medium leading-relaxed">
              Tenha o BelareStudio sempre à mão, com carregamento ultrarrápido diretamente da sua tela de início.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 text-left">
            {/* iOS Tutorial Card */}
            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-sm">iOS</div>
                <h3 className="font-black text-slate-800 tracking-tight">iPhone e iPad</h3>
              </div>
              <ol className="space-y-4 text-slate-600 text-sm font-semibold">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-700 font-extrabold flex-shrink-0 mt-0.5">1</span>
                  <span>Abra este site no navegador <strong className="text-slate-900">Safari</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-700 font-extrabold flex-shrink-0 mt-0.5">2</span>
                  <span>Toque no botão de <strong className="text-slate-900">Compartilhar</strong> (ícone de quadrado com seta para cima no rodapé do Safari).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-700 font-extrabold flex-shrink-0 mt-0.5">3</span>
                  <span>Role a lista e selecione <strong className="text-slate-900">"Adicionar à Tela de Início"</strong>.</span>
                </li>
              </ol>
            </div>

            {/* Android / Desktop Tutorial Card */}
            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#b5895a] rounded-xl flex items-center justify-center text-white font-black text-sm">AND</div>
                <h3 className="font-black text-slate-800 tracking-tight">Android e Google Chrome</h3>
              </div>
              <ol className="space-y-4 text-slate-600 text-sm font-semibold">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-700 font-extrabold flex-shrink-0 mt-0.5">1</span>
                  <span>Toque nos três pontinhos no canto superior do <strong className="text-slate-900">Google Chrome</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-700 font-extrabold flex-shrink-0 mt-0.5">2</span>
                  <span>Procure e selecione <strong className="text-slate-900">"Instalar aplicativo"</strong> ou <strong className="text-slate-900">"Adicionar à tela inicial"</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-700 font-extrabold flex-shrink-0 mt-0.5">3</span>
                  <span>Confirme a instalação e selecione "Adicionar" para fixar o atalho no celular.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Pre-footer FAQ or Proof */}
      <section className="py-24 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-4xl mx-auto text-center space-y-12">
            <h2 className="text-4xl font-black tracking-tighter">Ainda com dúvida?</h2>
            <div className="grid gap-4 text-left">
                {[
                    { q: "Preciso de cartão de crédito para testar?", a: "Não. Você pode testar todas as funcionalidades por 7 dias sem compromisso e sem precisar cadastrar um cartão." },
                    { q: "O Belare funciona para barbearias e clínicas?", a: "Sim! O sistema é totalmente personalizável para qualquer negócio de beleza e estética." },
                    { q: "Consigo importar meus dados de outro sistema?", a: "Com certeza. Nosso time de suporte ajuda você a migrar sua base de clientes sem perder nada." }
                ].map((faq, i) => (
                    <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-2">
                        <p className="font-black text-slate-800 tracking-tight">{faq.q}</p>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">{faq.a}</p>
                    </div>
                ))}
            </div>
            <div className="pt-10">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Pronto para transformar seu estúdio?</p>
                <button onClick={onLogin} className="bg-slate-900 text-white px-12 py-6 rounded-[32px] text-xl font-black shadow-2xl hover:shadow-slate-300 transition-all active:scale-95">
                    Quero Testar Gratuitamente
                </button>
            </div>
        </div>
      </section>

      {/* Simplified Footer */}
      <footer className="bg-slate-950 text-white py-20 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 border-b border-white/5 pb-16">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-900 font-black text-lg">B</div>
              <span className="text-lg font-black tracking-tighter">BelareStudio</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
              Mais que um software, o cérebro que gerencia seu estúdio. Feito por especialistas para quem não aceita o caos.
            </p>
          </div>
          <div className="flex gap-16 md:justify-end">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Produto</h4>
              <ul className="space-y-4 text-xs font-bold text-slate-500">
                <li><a href="#" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Segurança</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Suporte</h4>
              <ul className="space-y-4 text-xs font-bold text-slate-500">
                <li><a href="#" className="hover:text-white transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <p>© 2026 BELARESTUDIO TECHNOLOGY - SÃO PAULO, BRASIL</p>
          <div className="flex gap-8">
             <a href="#" className="hover:text-white transition-colors">Instagram</a>
             <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPageView;
