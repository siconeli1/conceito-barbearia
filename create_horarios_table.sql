-- Criar tabela horarios_customizados no Supabase
-- Execute este SQL no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS horarios_customizados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para melhorar performance das consultas por data
CREATE INDEX IF NOT EXISTS idx_horarios_customizados_data ON horarios_customizados(data);

-- Políticas RLS (Row Level Security) - se estiver habilitado
ALTER TABLE horarios_customizados ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (ajuste conforme necessário)
CREATE POLICY "Allow all operations on horarios_customizados" ON horarios_customizados
  FOR ALL USING (true);