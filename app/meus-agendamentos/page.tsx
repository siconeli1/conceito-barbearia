'use client'

import { useMemo, useState } from 'react'

type Agendamento = {
  id: string
  barbeiro_id: string
  data: string // YYYY-MM-DD
  hora_inicio: string // "09:00:00"
  hora_fim: string // "09:30:00"
  status: string // "ativo" | "cancelado" | etc
  nome_cliente: string
  celular_cliente: string
  created_at?: string
}

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '')
}

// (xx) xxxxx-xxxx (celular) e também aceita (xx) xxxx-xxxx
function formatPhoneBR(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 2) return d
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)

  if (rest.length <= 4) return `(${ddd}) ${rest}`
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`

  // 9 dígitos
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`
}

function formatDateBR(yyyyMmDd: string) {
  // "2026-03-06" -> "06/03/2026"
  const [y, m, d] = (yyyyMmDd || '').split('-')
  if (!y || !m || !d) return yyyyMmDd
  return `${d}/${m}/${y}`
}

function formatHour(h: string) {
  // "09:00:00" -> "09:00"
  if (!h) return ''
  return h.slice(0, 5)
}

export default function MeusAgendamentosPage() {
  const [celular, setCelular] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [buscou, setBuscou] = useState(false)

  const celularDigits = useMemo(() => onlyDigits(celular), [celular])

  async function buscar() {
    setErro(null)
    setLoading(true)
    setBuscou(true)

    try {
      if (celularDigits.length < 10) {
        throw new Error('Digite um celular válido com DDD.')
      }

      // OBS: mantém compatível com seu endpoint atual que retorna JSON no formato do print
      const res = await fetch(`/api/meus-agendamentos?celular=${encodeURIComponent(celularDigits)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json?.erro || 'Erro ao buscar agendamentos.')
      }

      setAgendamentos(json?.agendamentos || [])
    } catch (e: any) {
      setAgendamentos([])
      setErro(e?.message || 'Erro desconhecido.')
    } finally {
      setLoading(false)
    }
  }

  async function cancelar(id: string) {
    const ok = confirm('Confirmar cancelamento deste agendamento?')
    if (!ok) return

    setErro(null)
    setLoading(true)

    try {
      const res = await fetch('/api/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json?.erro || 'Erro ao cancelar.')
      }

      // Atualiza lista local: marca como cancelado
      setAgendamentos(prev =>
        prev.map(a => (a.id === id ? { ...a, status: 'cancelado' } : a))
      )
    } catch (e: any) {
      setErro(e?.message || 'Erro desconhecido.')
    } finally {
      setLoading(false)
    }
  }

  const ativos = agendamentos.filter(a => a.status === 'ativo')
  const cancelados = agendamentos.filter(a => a.status !== 'ativo')

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight">Meus agendamentos</h1>
        <p className="mt-2 text-white/70">
          Digite seu celular com DDD para consultar e cancelar horários.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <label className="block text-sm text-white/70">Celular</label>
          <input
            value={celular}
            onChange={(e) => setCelular(formatPhoneBR(e.target.value))}
            placeholder="(17) 99999-9999"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
            inputMode="numeric"
          />

          <div className="mt-4 flex gap-3">
            <button
              onClick={buscar}
              disabled={loading}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black disabled:opacity-60"
            >
              {loading ? 'Carregando...' : 'Buscar'}
            </button>

            <a
              href="/"
              className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-white/90 hover:bg-white/5"
            >
              Voltar
            </a>
          </div>

          {erro && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200">
              {erro}
            </div>
          )}
        </div>

        {buscou && !loading && agendamentos.length === 0 && !erro && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Nenhum agendamento encontrado para esse celular.
          </div>
        )}

        {agendamentos.length > 0 && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Ativos</h2>
              <div className="mt-4 space-y-3">
                {ativos.length === 0 && (
                  <p className="text-white/60">Nenhum agendamento ativo.</p>
                )}

                {ativos.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-semibold">
                        {formatDateBR(a.data)} — {formatHour(a.hora_inicio)}
                      </div>
                      <div className="text-sm text-white/70">
                        {a.nome_cliente} • {formatPhoneBR(a.celular_cliente)}
                      </div>
                    </div>

                    <button
                      onClick={() => cancelar(a.id)}
                      disabled={loading}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-semibold text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Histórico</h2>
              <div className="mt-4 space-y-3">
                {cancelados.length === 0 && (
                  <p className="text-white/60">Nada no histórico ainda.</p>
                )}

                {cancelados.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="font-semibold">
                      {formatDateBR(a.data)} — {formatHour(a.hora_inicio)}
                      <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                        {a.status}
                      </span>
                    </div>
                    <div className="text-sm text-white/70">
                      {a.nome_cliente} • {formatPhoneBR(a.celular_cliente)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}