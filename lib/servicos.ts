import { supabase } from '@/lib/supabase'

export interface Servico {
  id: string
  codigo: string
  nome: string
  duracao_minutos: number
  preco: number
  ordem?: number
  db_id?: string | null
}

type ServicoCatalogo = Servico & {
  aliases?: string[]
}

const SERVICOS_CATALOGO: ServicoCatalogo[] = [
  {
    id: 'cabelo',
    codigo: 'cabelo',
    nome: 'Cabelo',
    duracao_minutos: 40,
    preco: 45,
    ordem: 1,
    aliases: ['corte', 'corte_cabelo'],
  },
  {
    id: 'barba',
    codigo: 'barba',
    nome: 'Barba',
    duracao_minutos: 30,
    preco: 40,
    ordem: 2,
  },
  {
    id: 'corte_barba',
    codigo: 'corte_barba',
    nome: 'Corte e barba',
    duracao_minutos: 60,
    preco: 80,
    ordem: 3,
    aliases: ['cabelo_barba'],
  },
  {
    id: 'combo_barba_corte_sobrancelha',
    codigo: 'combo_barba_corte_sobrancelha',
    nome: 'Combo barba, corte e sobrancelha',
    duracao_minutos: 60,
    preco: 95,
    ordem: 4,
    aliases: ['combo_cabelo_barba_sobrancelha'],
  },
  {
    id: 'acabamento_pezinho',
    codigo: 'acabamento_pezinho',
    nome: 'Acabamento pezinho',
    duracao_minutos: 10,
    preco: 15,
    ordem: 5,
    aliases: ['acabamento', 'corte_cabelo_sobrancelha'],
  },
]

function normalizarCodigo(valor?: string | null) {
  return String(valor ?? '').trim().toLowerCase()
}

function localizarServicoCatalogo(chave?: string | null) {
  const codigo = normalizarCodigo(chave)

  if (!codigo) {
    return null
  }

  return (
    SERVICOS_CATALOGO.find((servico) => {
      if (servico.id === codigo || servico.codigo === codigo) {
        return true
      }

      return servico.aliases?.includes(codigo)
    }) ?? null
  )
}

function encontrarRegistroBancoPorServico(
  servicosBanco: Array<{ id: string; codigo: string; ativo: boolean | null }>,
  servico: ServicoCatalogo
) {
  return (
    servicosBanco.find((item) => normalizarCodigo(item.codigo) === servico.codigo) ??
    servicosBanco.find((item) => localizarServicoCatalogo(item.codigo)?.codigo === servico.codigo) ??
    null
  )
}

async function carregarServicosBanco() {
  const { data, error } = await supabase
    .from('servicos')
    .select('id, codigo, ativo')

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

function montarServicoCatalogo(servico: ServicoCatalogo, dbId?: string | null): Servico {
  return {
    id: servico.id,
    codigo: servico.codigo,
    nome: servico.nome,
    duracao_minutos: servico.duracao_minutos,
    preco: servico.preco,
    ordem: servico.ordem,
    db_id: dbId ?? null,
  }
}

export async function listarServicosAtivos() {
  try {
    const servicosBanco = await carregarServicosBanco()

    return SERVICOS_CATALOGO.filter((servico) => {
      const registro = encontrarRegistroBancoPorServico(servicosBanco, servico)
      return !registro || registro.ativo !== false
    }).map((servico) => {
      const registro = encontrarRegistroBancoPorServico(servicosBanco, servico)
      return montarServicoCatalogo(servico, registro?.id)
    })
  } catch {
    return SERVICOS_CATALOGO.map((servico) => montarServicoCatalogo(servico))
  }
}

export async function encontrarServicoAtivo(params: { id?: string | null; codigo?: string | null }) {
  const servicoCatalogo = localizarServicoCatalogo(params.codigo ?? params.id)

  if (!servicoCatalogo) {
    return null
  }

  try {
    const servicosBanco = await carregarServicosBanco()
    const registro = encontrarRegistroBancoPorServico(servicosBanco, servicoCatalogo)

    if (registro?.ativo === false) {
      return null
    }

    return montarServicoCatalogo(servicoCatalogo, registro?.id)
  } catch {
    return montarServicoCatalogo(servicoCatalogo)
  }
}
