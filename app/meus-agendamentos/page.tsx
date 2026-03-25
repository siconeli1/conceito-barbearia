"use client"

import { Suspense, useEffect, useReducer } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { formatarCelular, formatarDataISO, formatarHora } from "@/lib/format"
import { normalizePhone } from "@/lib/phone"

interface Agendamento {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  nome_cliente: string
  celular_cliente: string
  servico_nome?: string
  servico_preco?: number
  valor_final?: number
  status: "ativo" | "cancelado"
  status_agendamento?: "agendado" | "confirmado" | "cancelado" | "no_show"
  status_atendimento?: "pendente" | "em_atendimento" | "concluido"
  status_pagamento?: "pendente" | "pago" | "estornado"
}

type AgendamentoComEstado = Agendamento & {
  passouDoHorario: boolean
}

interface SearchResponse {
  agendamentos?: Agendamento[]
  erro?: string
}

interface CancelResponse {
  ok?: boolean
  erro?: string
}

interface FormState {
  celular: string
  agendamentos: Agendamento[]
  msg: string
  erro: string
  loading: boolean
}

type FormAction =
  | { type: "setCelular"; value: string }
  | { type: "setAgendamentos"; value: Agendamento[] }
  | { type: "setMsg"; value: string }
  | { type: "setErro"; value: string }
  | { type: "setLoading"; value: boolean }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setCelular":
      return { ...state, celular: action.value }
    case "setAgendamentos":
      return { ...state, agendamentos: action.value }
    case "setMsg":
      return { ...state, msg: action.value }
    case "setErro":
      return { ...state, erro: action.value }
    case "setLoading":
      return { ...state, loading: action.value }
    default:
      return state
  }
}

function getCurrentDateTimeInSaoPaulo(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(referenceDate)

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  ) as Record<string, string>

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

function timeToMinutes(hora: string) {
  const [h, m] = String(hora).slice(0, 5).split(":").map(Number)
  return h * 60 + m
}

export default function MeusAgendamentosPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black text-white flex items-center justify-center">Carregando...</main>}>
      <MeusAgendamentosContent />
    </Suspense>
  )
}

function MeusAgendamentosContent() {
  const searchParams = useSearchParams()
  const [form, dispatch] = useReducer(formReducer, {
    celular: "",
    agendamentos: [],
    msg: "",
    erro: "",
    loading: false,
  })

  useEffect(() => {
    const celularParam = searchParams.get("celular")

    if (celularParam) {
      dispatch({ type: "setCelular", value: formatarCelular(celularParam) })
    }
  }, [searchParams])

  const agoraSaoPaulo = getCurrentDateTimeInSaoPaulo()

  function horarioJaPassou(agendamento: Agendamento) {
    if (agendamento.data < agoraSaoPaulo.date) return true
    if (agendamento.data > agoraSaoPaulo.date) return false
    return timeToMinutes(agendamento.hora_inicio) <= agoraSaoPaulo.minutes
  }

  function podeCancelar(agendamento: Agendamento) {
    if (agendamento.status_agendamento === "cancelado" || agendamento.status === "cancelado") return false
    if (agendamento.status_agendamento === "no_show") return false
    if (agendamento.status_atendimento === "concluido") return false
    if (horarioJaPassou(agendamento)) return false
    return true
  }

  const agendamentosComEstado: AgendamentoComEstado[] = form.agendamentos.map((item) => ({
    ...item,
    passouDoHorario: horarioJaPassou(item),
  }))

  const agendamentosAtivos = agendamentosComEstado.filter((item) => podeCancelar(item))
  const agendamentosHistorico = agendamentosComEstado.filter((item) => !podeCancelar(item))
  const historicoLimitado = agendamentosHistorico.slice(0, 10)

  function formatarPreco(valor?: number) {
    return Number(valor ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function getStatusLabel(agendamento: AgendamentoComEstado) {
    if (agendamento.status_agendamento === "cancelado" || agendamento.status === "cancelado") return "Cancelado"
    if (agendamento.status_agendamento === "no_show") return "Não compareceu"
    if (agendamento.status_pagamento === "pago") return "Pago"
    if (agendamento.status_atendimento === "concluido") return "Concluído"
    if (agendamento.passouDoHorario) return "Horário encerrado"
    if (agendamento.status_atendimento === "em_atendimento") return "Em atendimento"
    if (agendamento.status_agendamento === "confirmado") return "Confirmado"
    return "Agendado"
  }

  async function buscar() {
    if (!form.celular) {
      dispatch({ type: "setErro", value: "Digite seu celular" })
      return
    }

    dispatch({ type: "setLoading", value: true })
    dispatch({ type: "setErro", value: "" })
    dispatch({ type: "setMsg", value: "" })

    try {
      const celular = normalizePhone(form.celular)
      const res = await fetch(`/api/meus-agendamentos?celular=${celular}`)
      const json: SearchResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao buscar agendamentos" })
        dispatch({ type: "setAgendamentos", value: [] })
        return
      }

      dispatch({ type: "setAgendamentos", value: json.agendamentos ?? [] })
    } catch {
      dispatch({ type: "setErro", value: "Erro ao conectar com o servidor" })
    } finally {
      dispatch({ type: "setLoading", value: false })
    }
  }

  async function cancelar(id: string) {
    dispatch({ type: "setLoading", value: true })
    dispatch({ type: "setErro", value: "" })

    try {
      const res = await fetch("/api/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          celular: normalizePhone(form.celular),
        }),
      })

      const json: CancelResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao cancelar agendamento" })
        return
      }

      dispatch({ type: "setMsg", value: "Agendamento cancelado com sucesso" })
      await buscar()
    } catch {
      dispatch({ type: "setErro", value: "Erro ao conectar com o servidor" })
    } finally {
      dispatch({ type: "setLoading", value: false })
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12 border-b border-white/10 pb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Meus Agendamentos</h1>
          <p className="text-gray-400 text-lg">Consulte e cancele usando apenas seu celular</p>
        </div>

        {form.erro && (
          <div className="mb-6 p-4 bg-red-950 border border-red-700 rounded">
            <p className="text-red-300">{form.erro}</p>
          </div>
        )}

        {form.msg && (
          <div className="mb-6 p-4 bg-green-950 border border-green-700 rounded">
            <p className="text-green-300 font-medium">{form.msg}</p>
          </div>
        )}

        <div className="mb-12 border border-white/10 rounded p-6 space-y-4">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <input
              type="tel"
              value={form.celular}
              onChange={(e) => dispatch({ type: "setCelular", value: formatarCelular(e.target.value) })}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
            <button
              onClick={buscar}
              disabled={form.loading}
              className="px-6 py-3 bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {form.loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          <p className="text-sm text-gray-400">
            Digite o mesmo celular usado no agendamento para consultar ou cancelar seus horários.
          </p>
        </div>

        {form.agendamentos.length === 0 && form.celular && !form.loading && (
          <div className="text-center py-12 border border-white/10 rounded">
            <p className="text-gray-400">Nenhum agendamento encontrado</p>
          </div>
        )}

        {agendamentosAtivos.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Próximos Agendamentos ({agendamentosAtivos.length})
            </h2>
            <div className="space-y-4">
              {agendamentosAtivos.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="p-6 border border-white/20 rounded hover:border-white/40 transition-colors"
                >
                  <div className="flex justify-between gap-4 mb-4">
                    <div>
                      <p className="text-white font-semibold">{formatarDataISO(agendamento.data)}</p>
                      <p className="text-gray-400">
                        {formatarHora(agendamento.hora_inicio)} - {formatarHora(agendamento.hora_fim)}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-300 border border-white/15 px-3 py-2 h-fit">
                      {getStatusLabel(agendamento)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-400 mb-1">Serviço</p>
                      <p className="text-white font-semibold">{agendamento.servico_nome || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Valor</p>
                      <p className="text-green-400 font-semibold">
                        {formatarPreco(agendamento.valor_final ?? agendamento.servico_preco)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => cancelar(agendamento.id)}
                    disabled={form.loading}
                    className="w-full px-4 py-2 border border-red-600 text-red-400 font-medium hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancelar Agendamento
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {agendamentosHistorico.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Histórico ({historicoLimitado.length})
            </h2>
            <div className="space-y-4">
              {historicoLimitado.map((agendamento) => (
                <div key={agendamento.id} className="p-6 border border-white/10 rounded opacity-70">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-gray-300">{formatarDataISO(agendamento.data)}</p>
                      <p className="text-gray-400">
                        {formatarHora(agendamento.hora_inicio)} - {formatarHora(agendamento.hora_fim)}
                      </p>
                      <p className="text-gray-300 mt-2">{agendamento.servico_nome || "Não informado"}</p>
                    </div>
                    <span className="text-sm text-gray-400">{getStatusLabel(agendamento)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
