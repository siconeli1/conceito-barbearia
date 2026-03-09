"use client"

import { useCallback, useEffect, useReducer, useState } from "react"
import Link from "next/link"
import { formatarData } from "../../lib/format"

interface Agendamento {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  nome: string
  celular: string
  status: "confirmed" | "cancelled"
}

interface SearchResponse {
  agendamentos?: Agendamento[]
  erro?: string
}

interface CancelResponse {
  ok: boolean
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
  | { type: "reset" }

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
    case "reset":
      return { celular: "", agendamentos: [], msg: "", erro: "", loading: false }
    default:
      return state
  }
}

export default function MeusAgendamentosPage() {
  const [form, dispatch] = useReducer(formReducer, {
    celular: "",
    agendamentos: [],
    msg: "",
    erro: "",
    loading: false,
  })

  const agendamentosAtivos = form.agendamentos.filter((a) => a.status === "confirmed")
  const agendamentosCancelados = form.agendamentos.filter((a) => a.status === "cancelled")

  async function buscar() {
    if (!form.celular) {
      dispatch({ type: "setErro", value: "Digite seu celular" })
      return
    }

    dispatch({ type: "setLoading", value: true })
    dispatch({ type: "setErro", value: "" })
    dispatch({ type: "setMsg", value: "" })

    try {
      const res = await fetch(`/api/meus-agendamentos?celular=${form.celular}`)
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
        body: JSON.stringify({ id }),
      })

      const json: CancelResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao cancelar agendamento" })
        return
      }

      dispatch({ type: "setMsg", value: "Agendamento cancelado com sucesso" })
      buscar()
    } catch {
      dispatch({ type: "setErro", value: "Erro ao conectar com o servidor" })
    } finally {
      dispatch({ type: "setLoading", value: false })
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
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
          <p className="text-gray-400 text-lg">Consulte e cancele seus agendamentos</p>
        </div>

        {/* Messages */}
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

        {/* Search */}
        <div className="mb-12">
          <label className="block text-sm font-semibold text-white mb-4">Buscar por Celular</label>
          <div className="flex gap-3">
            <input
              type="tel"
              value={form.celular}
              onChange={(e) => dispatch({ type: "setCelular", value: e.target.value })}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors"
              onKeyDown={(e) => e.key === "Enter" && buscar()}
            />
            <button
              onClick={buscar}
              disabled={form.loading}
              className="px-6 py-3 bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {form.loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>

        {/* Results */}
        {form.agendamentos.length === 0 && form.celular && !form.loading && (
          <div className="text-center py-12 border border-white/10 rounded">
            <p className="text-gray-400">Nenhum agendamento encontrado</p>
          </div>
        )}

        {/* Agendamentos Ativos */}
        {agendamentosAtivos.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Agendamentos Ativas ({agendamentosAtivos.length})
            </h2>
            <div className="space-y-4">
              {agendamentosAtivos.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="p-6 border border-white/20 rounded hover:border-white/40 transition-colors"
                >
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Data</p>
                      <p className="text-white font-semibold">{formatarData(agendamento.data)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Horário</p>
                      <p className="text-white font-semibold">
                        {agendamento.hora_inicio} - {agendamento.hora_fim}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Nome</p>
                      <p className="text-white font-semibold">{agendamento.nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Celular</p>
                      <p className="text-white font-semibold">{agendamento.celular}</p>
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
          </div>
        )}

        {/* Agendamentos Cancelados */}
        {agendamentosCancelados.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Agendamentos Cancelados ({agendamentosCancelados.length})
            </h2>
            <div className="space-y-4">
              {agendamentosCancelados.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="p-6 border border-white/10 rounded opacity-70"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Data</p>
                      <p className="text-gray-300">{formatarData(agendamento.data)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Horário</p>
                      <p className="text-gray-300">
                        {agendamento.hora_inicio} - {agendamento.hora_fim}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Nome</p>
                      <p className="text-gray-300">{agendamento.nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Celular</p>
                      <p className="text-gray-300">{agendamento.celular}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 mt-4">Cancelado</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
