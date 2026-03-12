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
  codigo: string
  agendamentos: Agendamento[]
  msg: string
  erro: string
  loading: boolean
}

type FormAction =
  | { type: "setCelular"; value: string }
  | { type: "setCodigo"; value: string }
  | { type: "setAgendamentos"; value: Agendamento[] }
  | { type: "setMsg"; value: string }
  | { type: "setErro"; value: string }
  | { type: "setLoading"; value: boolean }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setCelular":
      return { ...state, celular: action.value }
    case "setCodigo":
      return { ...state, codigo: action.value.toUpperCase() }
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
    codigo: "",
    agendamentos: [],
    msg: "",
    erro: "",
    loading: false,
  })

  useEffect(() => {
    const celularParam = searchParams.get("celular")
    const codigoParam = searchParams.get("codigo")

    if (celularParam) {
      dispatch({ type: "setCelular", value: formatarCelular(celularParam) })
    }

    if (codigoParam) {
      dispatch({ type: "setCodigo", value: codigoParam })
    }
  }, [searchParams])

  const agendamentosAtivos = form.agendamentos.filter((item) => item.status_agendamento !== "cancelado" && item.status !== "cancelado")
  const agendamentosCancelados = form.agendamentos.filter((item) => item.status_agendamento === "cancelado" || item.status === "cancelado")

  function formatarPreco(valor?: number) {
    return Number(valor ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  function getStatusLabel(agendamento: Agendamento) {
    if (agendamento.status_agendamento === "cancelado" || agendamento.status === "cancelado") return "Cancelado"
    if (agendamento.status_agendamento === "no_show") return "Nao compareceu"
    if (agendamento.status_pagamento === "pago") return "Pago"
    if (agendamento.status_atendimento === "concluido") return "Concluido"
    if (agendamento.status_atendimento === "em_atendimento") return "Em atendimento"
    if (agendamento.status_agendamento === "confirmado") return "Confirmado"
    return "Agendado"
  }

  async function buscar() {
    if (!form.celular || !form.codigo) {
      dispatch({ type: "setErro", value: "Digite celular e codigo de acesso" })
      return
    }

    dispatch({ type: "setLoading", value: true })
    dispatch({ type: "setErro", value: "" })
    dispatch({ type: "setMsg", value: "" })

    try {
      const celular = normalizePhone(form.celular)
      const codigo = form.codigo.trim().toUpperCase()
      const res = await fetch(`/api/meus-agendamentos?celular=${celular}&codigo=${codigo}`)
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
          codigo: form.codigo.trim().toUpperCase(),
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
          <p className="text-gray-400 text-lg">Consulte e cancele usando seu celular e codigo de acesso</p>
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
          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3">
            <input
              type="tel"
              value={form.celular}
              onChange={(e) => dispatch({ type: "setCelular", value: formatarCelular(e.target.value) })}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
            />
            <input
              type="text"
              value={form.codigo}
              onChange={(e) => dispatch({ type: "setCodigo", value: e.target.value })}
              placeholder="Codigo"
              maxLength={8}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors uppercase tracking-[0.2em]"
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
            O codigo aparece na confirmacao do agendamento. Ele protege seus dados contra consultas por terceiros.
          </p>
        </div>

        {form.agendamentos.length === 0 && form.celular && form.codigo && !form.loading && (
          <div className="text-center py-12 border border-white/10 rounded">
            <p className="text-gray-400">Nenhum agendamento encontrado</p>
          </div>
        )}

        {agendamentosAtivos.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Agendamentos Ativos ({agendamentosAtivos.length})
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
                      <p className="text-gray-400 mb-1">Servico</p>
                      <p className="text-white font-semibold">{agendamento.servico_nome || "Nao informado"}</p>
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

        {agendamentosCancelados.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Historico ({agendamentosCancelados.length})
            </h2>
            <div className="space-y-4">
              {agendamentosCancelados.map((agendamento) => (
                <div key={agendamento.id} className="p-6 border border-white/10 rounded opacity-70">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-gray-300">{formatarDataISO(agendamento.data)}</p>
                      <p className="text-gray-400">
                        {formatarHora(agendamento.hora_inicio)} - {formatarHora(agendamento.hora_fim)}
                      </p>
                      <p className="text-gray-300 mt-2">{agendamento.servico_nome || "Nao informado"}</p>
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
