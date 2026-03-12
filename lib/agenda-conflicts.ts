import { supabase } from '@/lib/supabase'

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB
}

export async function getBusyIntervals(data: string, ignoreCustomId?: string) {
  const [agendadosRes, customRes, bloqueiosRes] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('hora_inicio, hora_fim, status, status_agendamento')
      .eq('data', data),
    ignoreCustomId
      ? supabase
          .from('horarios_customizados')
          .select('id, hora_inicio, hora_fim')
          .eq('data', data)
          .neq('id', ignoreCustomId)
      : supabase
          .from('horarios_customizados')
          .select('id, hora_inicio, hora_fim')
          .eq('data', data),
    supabase
      .from('bloqueios_agenda')
      .select('hora_inicio, hora_fim, dia_inteiro, tipo_bloqueio')
      .eq('data', data),
  ])

  if (agendadosRes.error) {
    throw new Error(agendadosRes.error.message)
  }

  if (customRes.error) {
    throw new Error(customRes.error.message)
  }

  if (bloqueiosRes.error) {
    throw new Error(bloqueiosRes.error.message)
  }

  const bloqueios = bloqueiosRes.data ?? []
  const bloqueioDiaInteiro = bloqueios.some((b) => b.dia_inteiro || b.tipo_bloqueio === 'dia_inteiro')
  const naoAceitarMais = bloqueios.some((b) => b.tipo_bloqueio === 'nao_aceitar_mais')

  return {
    bloqueioDiaInteiro,
    naoAceitarMais,
    intervalos: [
      ...(agendadosRes.data ?? [])
        .filter((item) => item.status_agendamento ? item.status_agendamento !== 'cancelado' : item.status === 'ativo')
        .map((item) => ({
          inicio: parseTimeToMinutes(String(item.hora_inicio)),
          fim: parseTimeToMinutes(String(item.hora_fim)),
          tipo: 'agendamento' as const,
        })),
      ...(customRes.data ?? []).map((item) => ({
        inicio: parseTimeToMinutes(String(item.hora_inicio)),
        fim: parseTimeToMinutes(String(item.hora_fim)),
        tipo: 'horario_customizado' as const,
      })),
      ...bloqueios
        .filter((b) => !b.dia_inteiro && b.tipo_bloqueio === 'horario' && b.hora_inicio && b.hora_fim)
        .map((item) => ({
          inicio: parseTimeToMinutes(String(item.hora_inicio)),
          fim: parseTimeToMinutes(String(item.hora_fim)),
          tipo: 'bloqueio' as const,
        })),
    ],
  }
}
