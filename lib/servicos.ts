import { supabase } from '@/lib/supabase'

export interface Servico {
  id: string
  codigo: string
  nome: string
  duracao_minutos: number
  preco: number
}

export async function listarServicosAtivos() {
  const { data, error } = await supabase
    .from('servicos')
    .select('id, codigo, nome, duracao_minutos, preco, ativo, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Servico[]
}