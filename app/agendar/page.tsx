"use client"

import { useCallback, useEffect, useReducer, useState } from "react"
import Link from "next/link"
import { Slot, formatarData, converterParaISO, formatarCelular, isDateInPast, isDateBeyondLimit } from "../../lib/format"
import { useDebounce } from "../../lib/hooks"

interface HorariosResponse {
  horarios?: Slot[]
  erro?: string
}

interface ReservaResponse {
  ok: boolean
  erro?: string
}

interface FormState {
  nome: string
  celular: string
  horarioSelecionado: string | null
  msg: string
  erro: string
}

type FormAction =
  | { type: "setNome"; value: string }
  | { type: "setCelular"; value: string }
  | { type: "setHorario"; value: string | null }
  | { type: "setMsg"; value: string }
  | { type: "setErro"; value: string }
  | { type: "reset" }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "setNome":
      return { ...state, nome: action.value }
    case "setCelular":
      return { ...state, celular: action.value }
    case "setHorario":
      return { ...state, horarioSelecionado: action.value }
    case "setMsg":
      return { ...state, msg: action.value }
    case "setErro":
      return { ...state, erro: action.value }
    case "reset":
      return { nome: "", celular: "", horarioSelecionado: null, msg: "", erro: "" }
    default:
      return state
  }
}

export default function AgendarPage() {
  const [data, setData] = useState("")
  const debouncedData = useDebounce(data, 300)
  const iso = converterParaISO(data)
  const pastDate = iso ? isDateInPast(iso) : false
  const outOfRange = iso ? isDateBeyondLimit(iso, 30) : false

  // dia da semana da data selecionada (0=dom ... 6=sáb)
  const dayNumber = iso ? new Date(iso).getDay() : -1
  const isMonday = dayNumber === 1
  const isSunday = dayNumber === 0
  const closedMessage = isSunday ? 'Fechado aos domingos' : isMonday ? 'Fechado às segundas-feiras' : ''
  const isClosedDay = isMonday || isSunday

  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)

  const [form, dispatch] = useReducer(formReducer, {
    nome: "",
    celular: "",
    horarioSelecionado: null,
    msg: "",
    erro: "",
  })

  const dateInvalid = form.erro.toLowerCase().includes("data") || form.erro.toLowerCase().includes("passado") || form.erro.toLowerCase().includes("intervalo")
  const nameInvalid = form.erro.toLowerCase().includes("nome")
  const phoneInvalid = form.erro.toLowerCase().includes("celular")

  // Stepper: determinar etapa atual baseada no estado
  const getCurrentStep = () => {
    if (!data || pastDate || outOfRange || isClosedDay) return 1
    if (!form.horarioSelecionado) return 2
    if (!form.nome || !form.celular) return 3
    return 4
  }

  const currentStep = getCurrentStep()

  const buscarHorarios = useCallback(async (dataFormatada: string) => {
    setCarregandoHorarios(true)
    dispatch({ type: "setErro", value: "" })
    setSlots([])
    dispatch({ type: "setHorario", value: null })

    try {
      const res = await fetch(`/api/horarios?data=${dataFormatada}`)
      const json: HorariosResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao buscar horários" })
        return
      }

      setSlots(json.horarios ?? [])
    } catch {
      dispatch({ type: "setErro", value: "Erro ao carregar horários" })
    } finally {
      setCarregandoHorarios(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedData && !pastDate && !outOfRange && !isClosedDay) {
      buscarHorarios(debouncedData)
    } else if (debouncedData) {
      // não buscamos horários se data inválida, fora do alcance ou dia fechado
      setSlots([])
      dispatch({ type: "setHorario", value: null })
    }
  }, [debouncedData, pastDate, outOfRange, buscarHorarios])

  async function reservar() {
    if (!form.nome || !form.celular || !form.horarioSelecionado || !data) {
      dispatch({ type: "setErro", value: "Preencha todos os campos obrigatórios" })
      return
    }

    setLoading(true)
    dispatch({ type: "setErro", value: "" })

    try {
      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          hora_inicio: form.horarioSelecionado,
          nome: form.nome,
          celular: form.celular,
        }),
      })

      const json: ReservaResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao fazer reserva" })
        return
      }

      dispatch({ type: "setMsg", value: "Agendamento realizado com sucesso!" })
      dispatch({ type: "reset" })
      setData("")
      setSlots([])
    } catch {
      dispatch({ type: "setErro", value: "Erro ao conectar com o servidor" })
    } finally {
      setLoading(false)
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
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Agendar Horário</h1>
          <p className="text-gray-400 text-lg">Escolha a data e horário</p>
        </div>

        {/* Stepper */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center justify-center min-w-max px-4">
            {[
              { step: 1, label: "Data" },
              { step: 2, label: "Horário" },
              { step: 3, label: "Dados" },
              { step: 4, label: "Confirmar" },
            ].map((item) => (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors ${
                      item.step <= currentStep
                        ? "bg-white text-black"
                        : "bg-white/20 text-gray-400"
                    }`}
                  >
                    {item.step}
                  </div>
                  <span
                    className={`mt-1 text-xs sm:text-sm font-medium whitespace-nowrap ${
                      item.step <= currentStep ? "text-white" : "text-gray-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.step < 4 && (
                  <div
                    className={`w-6 sm:w-8 h-0.5 mx-2 sm:mx-4 ${
                      item.step < currentStep ? "bg-white" : "bg-white/20"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
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

        {/* Form */}
        <div className="space-y-8">
          {/* Date */}
          <div>
            <label className="block text-base sm:text-sm font-semibold text-white mb-4">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={`w-full px-4 py-4 sm:px-4 sm:py-3 bg-white/5 border rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors text-base sm:text-sm ${
                dateInvalid ? 'border-red-600' : 'border-white/20'
              }`}
              min={new Date().toISOString().split('T')[0]}
            />
            {data && (
              <div className="text-sm text-gray-400 mt-2">
                {pastDate && <span className="text-red-400">Data no passado</span>}
                {outOfRange && <span className="text-red-400">Data fora do intervalo (máx. 30 dias)</span>}
                {isClosedDay && <span className="text-red-400">{closedMessage}</span>}
                {!pastDate && !outOfRange && !isClosedDay && <span className="text-green-400">✓ Data válida</span>}
              </div>
            )}
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-semibold text-white mb-4">Horário</label>
            {carregandoHorarios && <p className="text-gray-400">Carregando horários...</p>}
            {!carregandoHorarios && slots.length === 0 && data && !pastDate && !outOfRange && (
              <p className="text-gray-400">Nenhum horário disponível para esta data</p>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.hora_inicio}
                  onClick={() => dispatch({ type: "setHorario", value: slot.hora_inicio })}
                  className={`p-3 sm:p-2 border text-center font-medium text-sm transition-colors ${
                    form.horarioSelecionado === slot.hora_inicio
                      ? 'border-white bg-white text-black'
                      : 'border-white/30 hover:border-white'
                  }`}
                >
                  {slot.hora_inicio}
                </button>
              ))}
            </div>
          </div>

          {/* Personal Data */}
          <div className="border-t border-white/10 pt-8">
            <label className="block text-sm font-semibold text-white mb-4">Dados Pessoais</label>
            <div className="space-y-4">
              <input
                type="text"
                value={form.nome}
                onChange={(e) => dispatch({ type: "setNome", value: e.target.value })}
                placeholder="Nome completo"
                className={`w-full px-4 py-3 bg-white/5 border rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors ${
                  nameInvalid ? 'border-red-600' : 'border-white/20'
                }`}
              />
              <input
                type="tel"
                value={form.celular}
                onChange={(e) => dispatch({ type: "setCelular", value: formatarCelular(e.target.value) })}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className={`w-full px-4 py-3 bg-white/5 border rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors ${
                  phoneInvalid ? 'border-red-600' : 'border-white/20'
                }`}
              />
            </div>
          </div>

          {/* Summary */}
          {form.horarioSelecionado && form.nome && form.celular && data && (
            <div className="border-t border-white/10 pt-8">
              <div className="space-y-2 text-sm text-gray-400 mb-6">
                <div className="flex justify-between">
                  <span>Data:</span>
                  <span className="text-white">{formatarData(data)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horário:</span>
                  <span className="text-white">{form.horarioSelecionado}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nome:</span>
                  <span className="text-white">{form.nome}</span>
                </div>
              </div>
              <button
                onClick={reservar}
                disabled={loading}
                className="w-full px-6 py-3 bg-white text-black font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Confirmando..." : "Confirmar Agendamento"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
