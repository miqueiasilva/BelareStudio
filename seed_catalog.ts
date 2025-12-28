import { supabase } from './services/supabaseClient';

/**
 * Script de População (Seed) do Catálogo de Serviços - BelaFlow
 * 
 * Este script realiza um 'upsert' em lote para inserir novos serviços
 * ou atualizar preços/durações de serviços já existentes (baseado no nome).
 */

const servicesData = [
  // --- CATEGORIA: CÍLIOS & OLHAR ---
  { category: "Cílios & Olhar", name: "Extensão de Cílios Fio A Fio", duration: 150, price: 130.00 },
  { category: "Cílios & Olhar", name: "Fox Eyes", duration: 150, price: 140.00 },
  { category: "Cílios & Olhar", name: "Lash Lifting", duration: 120, price: 110.00 },
  { category: "Cílios & Olhar", name: "Manutenção Fio A Fio 15 Dias", duration: 150, price: 80.00 },
  { category: "Cílios & Olhar", name: "Manutenção Fio A Fio 21 Dias", duration: 150, price: 100.00 },
  { category: "Cílios & Olhar", name: "Manutenção Fox Eyes 15 Dias", duration: 150, price: 90.00 },
  { category: "Cílios & Olhar", name: "Manutenção Fox Eyes 21 Dias", duration: 150, price: 110.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Brasileiro 15 Dias", duration: 150, price: 85.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Brasileiro 21 Dias", duration: 150, price: 105.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Egípcio 15 Dias", duration: 150, price: 90.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Egípcio 21 Dias", duration: 150, price: 110.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Híbrido 15 Dias", duration: 150, price: 100.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Híbrido 21 Dias", duration: 180, price: 120.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Russo 15 Dias", duration: 180, price: 120.00 },
  { category: "Cílios & Olhar", name: "Manutenção Volume Russo 21 Dias", duration: 180, price: 140.00 },
  { category: "Cílios & Olhar", name: "Volume Brasileiro", duration: 150, price: 135.00 },
  { category: "Cílios & Olhar", name: "Volume Egípcio", duration: 150, price: 140.00 },
  { category: "Cílios & Olhar", name: "Volume Híbrido", duration: 180, price: 150.00 },
  { category: "Cílios & Olhar", name: "Volume Russo", duration: 210, price: 180.00 },

  // --- CATEGORIA: SOBRANCELHAS (UNISSEX) ---
  { category: "Sobrancelhas", name: "Design Simples", duration: 30, price: 40.00 },
  { category: "Sobrancelhas", name: "Design Com Henna", duration: 40, price: 50.00 },
  { category: "Sobrancelhas", name: "Design Com Tintura", duration: 40, price: 60.00 },
  { category: "Sobrancelhas", name: "Design Com Henna e Tintura", duration: 70, price: 70.00 },
  { category: "Sobrancelhas", name: "Aplicação de Henna (Avulso)", duration: 20, price: 25.00 },
  { category: "Sobrancelhas", name: "Brow Lamination", duration: 90, price: 100.00 },
  { category: "Sobrancelhas", name: "Micropigmentação", duration: 180, price: 549.90 },
  { category: "Sobrancelhas", name: "Retoque Micro", duration: 90, price: 100.00 },
  { category: "Sobrancelhas", name: "Limpeza Micro", duration: 30, price: 35.00 },
  { category: "Sobrancelhas", name: "Avaliação para Micropigmentação", duration: 5, price: 0.00 },

  // --- CATEGORIA: EPILAÇÃO FACIAL (CERA/LINHA) ---
  { category: "Epilação Facial", name: "Buço", duration: 5, price: 20.00 },
  { category: "Epilação Facial", name: "Mento (Queixo)", duration: 5, price: 20.00 },
  { category: "Epilação Facial", name: "Buço e Mento", duration: 10, price: 30.00 },
  { category: "Epilação Facial", name: "Costeleta", duration: 30, price: 25.00 },
  { category: "Epilação Facial", name: "Epilação Facial Completa", duration: 30, price: 40.00 },
  
  // --- CATEGORIA: DEPILAÇÃO FEMININA ---
  { category: "Depilação Feminina", name: "Axila", duration: 30, price: 30.00 },
  { category: "Depilação Feminina", name: "Virilha Simples", duration: 30, price: 35.00 },
  { category: "Depilação Feminina", name: "Virilha Cavada", duration: 40, price: 50.00 },
  { category: "Depilação Feminina", name: "Virilha Completa", duration: 50, price: 55.00 },
  { category: "Depilação Feminina", name: "Combo: Virilha Simples + Ânus", duration: 40, price: 45.00 },
  { category: "Depilação Feminina", name: "Combo: Virilha Cavada + Ânus", duration: 45, price: 55.00 },
  { category: "Depilação Feminina", name: "Combo: Virilha Completa + Ânus", duration: 60, price: 65.00 },
  { category: "Depilação Feminina", name: "Ânus (Perianal)", duration: 30, price: 25.00 },
  { category: "Depilação Feminina", name: "Nádegas", duration: 30, price: 25.00 },
  { category: "Depilação Feminina", name: "Cócix", duration: 20, price: 25.00 },
  { category: "Depilação Feminina", name: "Faixa de Umbigo", duration: 30, price: 20.00 },
  { category: "Depilação Feminina", name: "Seios (Auréola)", duration: 30, price: 20.00 },
  { category: "Depilação Feminina", name: "Braço Inteiro", duration: 30, price: 35.00 },
  { category: "Depilação Feminina", name: "Meia Perna", duration: 30, price: 35.00 },
  { category: "Depilação Feminina", name: "Perna Completa", duration: 50, price: 60.00 },
  { category: "Depilação Feminina", name: "Coxa", duration: 35, price: 35.00 },
  { category: "Depilação Feminina", name: "Costas Femininas", duration: 30, price: 40.00 },
  { category: "Depilação Feminina", name: "Avaliação Depilação", duration: 15, price: 0.00 },

  // --- CATEGORIA: DEPILAÇÃO MASCULINA ---
  { category: "Depilação Masculina", name: "Barba Completa", duration: 45, price: 50.00 },
  { category: "Depilação Masculina", name: "Axilas Masculina", duration: 30, price: 30.00 },
  { category: "Depilação Masculina", name: "Peitoral", duration: 30, price: 35.00 },
  { category: "Depilação Masculina", name: "Abdômen", duration: 30, price: 35.00 },
  { category: "Depilação Masculina", name: "Peitoral + Abdômen", duration: 45, price: 55.00 },
  { category: "Depilação Masculina", name: "Braço Inteiro Masculino", duration: 30, price: 40.00 },
  { category: "Depilação Masculina", name: "Costas Masculinas", duration: 30, price: 55.00 },
  { category: "Depilação Masculina", name: "Meia Perna Masculina", duration: 30, price: 40.00 },
  { category: "Depilação Masculina", name: "Perna Completa Masculina", duration: 50, price: 65.00 },
  { category: "Depilação Masculina", name: "Coxa Masculina", duration: 35, price: 40.00 },
  { category: "Depilação Masculina", name: "Nariz / Orelha", duration: 20, price: 20.00 },

  // --- CATEGORIA: MASSAGEM & BEM-ESTAR ---
  { category: "Massagem & Bem-Estar", name: "Massagem Relaxante", duration: 40, price: 70.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Terapêutica", duration: 60, price: 140.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Desportiva", duration: 60, price: 140.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Modeladora", duration: 60, price: 130.00 },
  { category: "Massagem & Bem-Estar", name: "Drenagem Linfática", duration: 60, price: 130.00 },
  { category: "Massagem & Bem-Estar", name: "Pacote Drenagem (05 Sessões)", duration: 60, price: 450.00 },
  { category: "Massagem & Bem-Estar", name: "Pacote Drenagem (10 Sessões)", duration: 60, price: 900.00 },
  { category: "Massagem & Bem-Estar", name: "Ventosa (Ventosaterapia)", duration: 40, price: 100.00 },
  { category: "Massagem & Bem-Estar", name: "Liberação Miofascial", duration: 60, price: 140.00 },
  { category: "Massagem & Bem-Estar", name: "Reflexologia Podal", duration: 40, price: 110.00 },
  { category: "Massagem & Bem-Estar", name: "Shiatsu", duration: 60, price: 130.00 },
  { category: "Massagem & Bem-Estar", name: "Quiropraxia", duration: 60, price: 160.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Facial", duration: 30, price: 100.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Quick", duration: 40, price: 120.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Thai", duration: 60, price: 140.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Ayurvédica", duration: 60, price: 140.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Abhyanga", duration: 60, price: 140.00 },
  { category: "Massagem & Bem-Estar", name: "Massagem Tui Na", duration: 40, price: 120.00 },
  { category: "Massagem & Bem-Estar", name: "Peeling Esfoliante (Detox)", duration: 60, price: 100.00 },

  // --- CATEGORIA: ESTÉTICA FACIAL & CORPORAL ---
  { category: "Estética Facial & Corporal", name: "Limpeza de Pele Premium", duration: 90, price: 90.00 },
  { category: "Estética Facial & Corporal", name: "Limpeza Premium Personalizada", duration: 90, price: 110.00 },
  { category: "Estética Facial & Corporal", name: "Revitalização Facial", duration: 40, price: 70.00 },
  { category: "Estética Facial & Corporal", name: "Skin Fusion Pro", duration: 60, price: 250.00 },
  { category: "Estética Facial & Corporal", name: "Microagulhamento Facial", duration: 30, price: 200.00 },
  { category: "Estética Facial & Corporal", name: "Peeling (Axilas/Manchas)", duration: 60, price: 600.00 },
  { category: "Estética Facial & Corporal", name: "Peeling (Melasma/Acne)", duration: 60, price: 600.00 },
  { category: "Estética Facial & Corporal", name: "Peeling Íntimo (Clareamento)", duration: 90, price: 850.00 },
  { category: "Estética Facial & Corporal", name: "Remoção de Sinais", duration: 60, price: 100.00 },
  { category: "Estética Facial & Corporal", name: "Avaliação Remoção Sinais", duration: 25, price: 0.00 },
  { category: "Estética Facial & Corporal", name: "Avaliação Rotina Skincare", duration: 60, price: 300.00 },
  { category: "Estética Facial & Corporal", name: "Evolution Skin (Estrias) - Sessão A", duration: 120, price: 150.00 },
  { category: "Estética Facial & Corporal", name: "Evolution Skin (Estrias) - Sessão B", duration: 120, price: 200.00 },
  { category: "Estética Facial & Corporal", name: "Avaliação Estrias", duration: 30, price: 0.00 },
  { category: "Estética Facial & Corporal", name: "Remoção de Tatuagem (Laser)", duration: 90, price: 150.00 },
  { category: "Estética Facial & Corporal", name: "Avaliação Tatuagem", duration: 15, price: 0.00 },
  { category: "Estética Facial & Corporal", name: "Remoção Micro Sobrancelhas (Laser)", duration: 40, price: 200.00 },

  // --- CATEGORIA: LÁBIOS ---
  { category: "Lábios", name: "Micropigmentação Labial", duration: 120, price: 599.90 },
  { category: "Lábios", name: "Retoque Microlabial", duration: 90, price: 120.00 },
  { category: "Lábios", name: "Avaliação Labial", duration: 10, price: 0.00 },

  // --- CATEGORIA: CURSOS ---
  { category: "Cursos", name: "Curso Design Sobrancelhas Iniciante", duration: 540, price: 897.00 },
  { category: "Cursos", name: "Especialização em Design", duration: 540, price: 597.00 }
];

/**
 * Mapeamento de cores para categorias para manter a UI consistente
 */
const categoryColors: Record<string, string> = {
  "Cílios & Olhar": "#3b82f6", // Blue
  "Sobrancelhas": "#8b5cf6",   // Purple
  "Epilação Facial": "#ec4899", // Pink
  "Depilação Feminina": "#f43f5e", // Rose
  "Depilação Masculina": "#6366f1", // Indigo
  "Massagem & Bem-Estar": "#10b981", // Emerald
  "Estética Facial & Corporal": "#06b6d4", // Cyan
  "Lábios": "#f97316", // Orange
  "Cursos": "#0f172a" // Slate
};

/**
 * Função principal de Seed
 */
export async function seedCatalog() {
    console.log("🚀 Iniciando seed do catálogo de serviços...");
    
    // Mapeia o JSON para os nomes de colunas reais do banco (Postgres)
    const mappedData = servicesData.map(s => ({
        nome: s.name,
        categoria: s.category,
        duracao_min: s.duration,
        preco: s.price,
        ativo: true,
        cor_hex: categoryColors[s.category] || "#f97316",
        descricao: `Serviço profissional de ${s.name} na categoria ${s.category}.`
    }));

    try {
        // Upsert performático em lote ignorando/atualizando conflitos de nome
        const { data, error } = await supabase
            .from('services')
            .upsert(mappedData, { onConflict: 'nome' });

        if (error) throw error;

        console.log(`✅ Sucesso! ${mappedData.length} serviços processados.`);
        return { success: true, count: mappedData.length };
    } catch (err: any) {
        console.error("❌ Falha no Seed:", err.message);
        return { success: false, error: err.message };
    }
}
