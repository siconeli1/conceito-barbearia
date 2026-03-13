"use client"

import { useCallback, useEffect, useReducer, useState } from "react"
import Link from "next/link"
import { type Servico } from "@/lib/servicos"
import { Slot, formatarCelular, getTodayInputValue, isDateBeyondLimit, isDateInPast } from "@/lib/format"
import { useDebounce } from "@/lib/hooks"

interface ServicosResponse {
  servicos?: Servico[]
  erro?: string
}

interface HorariosResponse {
  horarios?: Slot[]
  horarios_completos?: Slot[]
  servico?: Servico
  erro?: string
}

interface ReservaResponse {
  ok: boolean
  erro?: string
}

interface AgendamentoConfirmado {
  nome: string
  celular: string
  data: string
  hora_inicio: string
  hora_fim: string
  servico_nome: string
  servico_duracao: number
  servico_preco: number
}

interface FormState {
  nome: string
  celular: string
  horarioSelecionado: string | null
  msg: string
  erro: string
}

interface AgendarClientProps {
  initialServicos: Servico[]
  initialErro?: string
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

export default function AgendarClient({ initialServicos, initialErro }: AgendarClientProps) {
  const [servicos, setServicos] = useState<Servico[]>(initialServicos)
  const [servicoSelecionadoId, setServicoSelecionadoId] = useState<string | null>(initialServicos[0]?.id ?? null)
  const [carregandoServicos, setCarregandoServicos] = useState(false)
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState<AgendamentoConfirmado | null>(null)
  const [data, setData] = useState("")
  const debouncedData = useDebounce(data, 300)
  const iso = data || null
  const pastDate = iso ? isDateInPast(iso) : false
  const outOfRange = iso ? isDateBeyondLimit(iso, 30) : false

  const dayNumber = data ? new Date(`${data}T00:00:00`).getDay() : -1
  const isSaturday = dayNumber === 6
  const isSunday = dayNumber === 0
  const closedMessage = isSunday ? "Fechado aos domingos" : isSaturday ? "Fechado aos sábados" : ""
  const isClosedDay = isSaturday || isSunday
  const servicoSelecionado = servicos.find((servico) => servico.id === servicoSelecionadoId) ?? null

  const [slots, setSlots] = useState<Slot[]>([])
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [showAllSlots, setShowAllSlots] = useState(false)
  const [loading, setLoading] = useState(false)
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)

  const [form, dispatch] = useReducer(formReducer, {
    nome: "",
    celular: "",
    horarioSelecionado: null,
    msg: "",
    erro: initialErro ?? "",
  })

  const dateInvalid = form.erro.toLowerCase().includes("data") || form.erro.toLowerCase().includes("passado") || form.erro.toLowerCase().includes("intervalo")
  const nameInvalid = form.erro.toLowerCase().includes("nome")
  const phoneInvalid = form.erro.toLowerCase().includes("celular")

  const slotSelecionado = slots.find((slot) => slot.hora_inicio === form.horarioSelecionado) ?? null
  const podeConfirmar = Boolean(servicoSelecionado && data && form.horarioSelecionado && form.nome && form.celular && !loading)

  const getCurrentStep = () => {
    if (!servicoSelecionado) return 1
    if (!data || pastDate || outOfRange || isClosedDay) return 2
    if (!form.horarioSelecionado) return 3
    if (!form.nome || !form.celular) return 4
    return 5
  }

  const currentStep = getCurrentStep()

  const carregarServicos = useCallback(async () => {
    setCarregandoServicos(true)
    dispatch({ type: "setErro", value: "" })

    try {
      const res = await fetch("/api/servicos")
      const json: ServicosResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao carregar serviços" })
        setServicos([])
        setServicoSelecionadoId(null)
        return
      }

      const lista = json.servicos ?? []
      setServicos(lista)
      setServicoSelecionadoId((currentId) => currentId && lista.some((servico) => servico.id === currentId) ? currentId : (lista[0]?.id ?? null))
    } catch {
      dispatch({ type: "setErro", value: "Erro ao carregar serviços" })
      setServicos([])
      setServicoSelecionadoId(null)
    } finally {
      setCarregandoServicos(false)
    }
  }, [])

  const buscarHorarios = useCallback(async (dataFormatada: string, servicoId: string) => {
    setCarregandoHorarios(true)
    dispatch({ type: "setErro", value: "" })
    setSlots([])
    setAllSlots([])
    setShowAllSlots(false)
    dispatch({ type: "setHorario", value: null })

    try {
      const res = await fetch(`/api/horarios?data=${dataFormatada}&servico_id=${servicoId}`)
      const json: HorariosResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao buscar horários" })
        return
      }

      setSlots(json.horarios ?? [])
      setAllSlots(json.horarios_completos ?? json.horarios ?? [])
    } catch {
      dispatch({ type: "setErro", value: "Erro ao carregar horários" })
    } finally {
      setCarregandoHorarios(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedData && servicoSelecionadoId && !pastDate && !outOfRange && !isClosedDay) {
      buscarHorarios(debouncedData, servicoSelecionadoId)
    } else if (debouncedData) {
      setSlots([])
      setAllSlots([])
      setShowAllSlots(false)
      dispatch({ type: "setHorario", value: null })
    }
  }, [debouncedData, servicoSelecionadoId, pastDate, outOfRange, isClosedDay, buscarHorarios])

  useEffect(() => {
    dispatch({ type: "setHorario", value: null })
    setSlots([])
    setAllSlots([])
    setShowAllSlots(false)
  }, [servicoSelecionadoId])

  useEffect(() => {
    if (!agendamentoConfirmado) {
      return
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" })
    })
  }, [agendamentoConfirmado])

  async function reservar() {
    if (!servicoSelecionado || !form.nome || !form.celular || !form.horarioSelecionado || !data) {
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
          servico_id: servicoSelecionado.id,
          nome: form.nome,
          celular: form.celular,
        }),
      })

      const json: ReservaResponse = await res.json()

      if (!res.ok) {
        dispatch({ type: "setErro", value: json.erro || "Erro ao fazer reserva" })
        return
      }

      setAgendamentoConfirmado({
        nome: form.nome,
        celular: form.celular,
        data,
        hora_inicio: form.horarioSelecionado,
        hora_fim: slotSelecionado?.hora_fim ?? form.horarioSelecionado,
        servico_nome: servicoSelecionado.nome,
        servico_duracao: servicoSelecionado.duracao_minutos,
        servico_preco: Number(servicoSelecionado.preco),
      })
      dispatch({ type: "reset" })
      setData("")
      setServicoSelecionadoId(servicos[0]?.id ?? null)
      setSlots([])
    } catch {
      dispatch({ type: "setErro", value: "Erro ao conectar com o servidor" })
    } finally {
      setLoading(false)
    }
  }

  function formatarDataResumo(dataIso: string) {
    const [ano, mes, dia] = dataIso.split("-")
    return `${dia}/${mes}/${ano}`
  }

  function formatarPreco(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  const displayedSlots = showAllSlots ? allSlots : slots
  const hasExtraSlots = allSlots.length > slots.length

  if (agendamentoConfirmado) {
    return (
      <main className="min-h-screen bg-black text-white overflow-hidden">
        <div className="relative isolate min-h-screen">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_45%),linear-gradient(180deg,#050505_0%,#000000_100%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
            <div className="mb-8">
              <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </Link>
            </div>

            <section className="border border-white/10 bg-white/[0.03] backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_120px_rgba(0,0,0,0.55)]">
              <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                <div className="p-8 sm:p-12 border-b lg:border-b-0 lg:border-r border-white/10">
                  <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300 mb-8">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    Horario agendado com sucesso
                  </div>

                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                    Seu horario esta confirmado.
                  </h1>
                  <p className="text-lg text-gray-300 max-w-xl leading-relaxed mb-10">
                    Reservamos seu atendimento na Conceito Barbearia. Confira os detalhes abaixo e, se precisar,
                    acompanhe depois em Meus Agendamentos.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="border border-white/10 bg-black/30 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-500 mb-2">Servico</p>
                      <p className="text-xl font-semibold text-white mb-1">{agendamentoConfirmado.servico_nome}</p>
                      <p className="text-sm text-gray-400">
                        {agendamentoConfirmado.servico_duracao} min • {formatarPreco(agendamentoConfirmado.servico_preco)}
                      </p>
                    </div>
                    <div className="border border-white/10 bg-black/30 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-gray-500 mb-2">Horario</p>
                      <p className="text-xl font-semibold text-white mb-1">{formatarDataResumo(agendamentoConfirmado.data)}</p>
                      <p className="text-sm text-gray-400">
                        {agendamentoConfirmado.hora_inicio} ate {agendamentoConfirmado.hora_fim}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-8 sm:p-10 bg-white/[0.02]">
                  <div className="mb-8 pb-6 border-b border-white/10">
                    <p className="text-xs uppercase tracking-[0.24em] text-gray-500 mb-3">Comprovante</p>
                    <p className="text-2xl font-semibold text-white">Resumo do agendamento</p>
                  </div>

                  <div className="space-y-5 text-sm">
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-4">
                      <span className="text-gray-500">Cliente</span>
                      <span className="text-right text-white font-medium">{agendamentoConfirmado.nome}</span>
                    </div>
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-4">
                      <span className="text-gray-500">Celular</span>
                      <span className="text-right text-white font-medium">{agendamentoConfirmado.celular}</span>
                    </div>
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-4">
                      <span className="text-gray-500">Data</span>
                      <span className="text-right text-white font-medium">{formatarDataResumo(agendamentoConfirmado.data)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-4">
                      <span className="text-gray-500">Inicio</span>
                      <span className="text-right text-white font-medium">{agendamentoConfirmado.hora_inicio}</span>
                    </div>
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-4">
                      <span className="text-gray-500">Fim</span>
                      <span className="text-right text-white font-medium">{agendamentoConfirmado.hora_fim}</span>
                    </div>
                    <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-4">
                      <span className="text-gray-500">Valor</span>
                      <span className="text-right text-white font-medium">{formatarPreco(agendamentoConfirmado.servico_preco)}</span>
                    </div>
                  </div>

                  <p className="mt-6 text-sm text-gray-400">
                    Para consultar ou cancelar depois, use apenas o celular informado neste agendamento.
                  </p>

                  <div className="mt-10 space-y-3">
                    <Link
                      href="/"
                      className="inline-flex w-full items-center justify-center px-6 py-3 bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Voltar
                    </Link>
                    <Link
                      href={`/meus-agendamentos?celular=${encodeURIComponent(agendamentoConfirmado.celular)}`}
                      className="inline-flex w-full items-center justify-center px-6 py-3 border border-white/20 text-white hover:bg-white/10 transition-colors"
                    >
                      Ver meus agendamentos
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12 border-b border-white/10 pb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Agendar Horário</h1>
          <p className="text-gray-400 text-lg">Escolha serviço, data e horário</p>
        </div>

        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center justify-center min-w-max px-4">
            {[
              { step: 1, label: "Serviço" },
              { step: 2, label: "Data" },
              { step: 3, label: "Horário" },
              { step: 4, label: "Dados" },
              { step: 5, label: "Confirmar" },
            ].map((item) => (
              <div key={item.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors ${
                      item.step <= currentStep ? "bg-white text-black" : "bg-white/20 text-gray-400"
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
                {item.step < 5 && (
                  <div className={`w-6 sm:w-8 h-0.5 mx-2 sm:mx-4 ${item.step < currentStep ? "bg-white" : "bg-white/20"}`} />
                )}
              </div>
            ))}
          </div>
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

        <div className="space-y-8">
          <div>
            <label className="block text-base sm:text-sm font-semibold text-white mb-4">Serviço</label>
            {carregandoServicos && <p className="text-gray-400">Carregando serviços...</p>}
            {!carregandoServicos && servicos.length === 0 && (
              <div className="border border-white/10 bg-white/[0.03] rounded p-5 space-y-4">
                <p className="text-gray-300">Nenhum serviço disponível no momento.</p>
                <button
                  type="button"
                  onClick={carregarServicos}
                  className="inline-flex items-center justify-center px-4 py-2 border border-white/20 text-white hover:bg-white/10 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {!carregandoServicos && servicos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {servicos.map((servico) => {
                  const selecionado = servico.id === servicoSelecionadoId
                  return (
                    <button
                      key={servico.id}
                      type="button"
                      onClick={() => setServicoSelecionadoId(servico.id)}
                      className={`text-left p-4 border rounded transition-colors ${
                        selecionado
                          ? "border-white bg-white text-black"
                          : "border-white/20 bg-white/5 text-white hover:border-white/60"
                      }`}
                    >
                      <p className="font-semibold text-sm sm:text-base">{servico.nome}</p>
                      <p className={`text-sm ${selecionado ? "text-black/80" : "text-gray-300"}`}>
                        {servico.duracao_minutos} min • {formatarPreco(Number(servico.preco))}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-base sm:text-sm font-semibold text-white mb-4">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={`datetime-input w-full px-4 py-4 sm:px-4 sm:py-3 border rounded text-white placeholder-gray-500 focus:outline-none transition-colors text-base sm:text-sm ${
                dateInvalid ? "border-red-600" : "border-white/20"
              }`}
              min={getTodayInputValue()}
            />
            {data && (
              <div className="text-sm text-gray-400 mt-2">
                {pastDate && <span className="text-red-400">Data no passado</span>}
                {outOfRange && <span className="text-red-400">Data fora do intervalo (máx. 30 dias)</span>}
                {isClosedDay && <span className="text-red-400">{closedMessage}</span>}
                {!pastDate && !outOfRange && !isClosedDay && <span className="text-green-400">Data válida. Atendimento das 08:30 às 12:00 e das 14:00 às 20:00, com último início às 19:00.</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-4">Horário</label>
            {servicoSelecionado && !carregandoHorarios && (
              <p className="text-sm text-gray-400 mb-4">
                {showAllSlots
                  ? "Mostrando todos os horários válidos para este serviço."
                  : "Mostrando os principais horários disponíveis."}
              </p>
            )}
            {!servicoSelecionado && <p className="text-gray-400">Escolha um serviço para ver horários</p>}
            {carregandoHorarios && servicoSelecionado && <p className="text-gray-400">Carregando horários...</p>}
            {!carregandoHorarios && slots.length === 0 && data && !pastDate && !outOfRange && servicoSelecionado && (
              <p className="text-gray-400">Nenhum horário disponível para esta data</p>
            )}
            {!carregandoHorarios && hasExtraSlots && (
              <button
                type="button"
                onClick={() => setShowAllSlots((current) => !current)}
                className="mb-4 text-sm text-white/80 underline underline-offset-4 hover:text-white transition-colors"
              >
                {showAllSlots ? "Mostrar menos horários" : "Ver mais horários"}
              </button>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-2">
              {displayedSlots.map((slot) => (
                <button
                  key={slot.hora_inicio}
                  onClick={() => dispatch({ type: "setHorario", value: slot.hora_inicio })}
                  className={`p-3 sm:p-2 border text-center font-medium text-sm transition-colors ${
                    form.horarioSelecionado === slot.hora_inicio
                      ? "border-white bg-white text-black"
                      : "border-white/30 hover:border-white"
                  }`}
                >
                  {slot.hora_inicio}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-8">
            <label className="block text-sm font-semibold text-white mb-4">Dados Pessoais</label>
            <div className="space-y-4">
              <input
                type="text"
                value={form.nome}
                onChange={(e) => dispatch({ type: "setNome", value: e.target.value })}
                placeholder="Nome completo"
                className={`w-full px-4 py-3 bg-white/5 border rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors ${
                  nameInvalid ? "border-red-600" : "border-white/20"
                }`}
              />
              <input
                type="tel"
                value={form.celular}
                onChange={(e) => dispatch({ type: "setCelular", value: formatarCelular(e.target.value) })}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className={`w-full px-4 py-3 bg-white/5 border rounded text-white placeholder-gray-500 focus:outline-none focus:border-white transition-colors ${
                  phoneInvalid ? "border-red-600" : "border-white/20"
                }`}
              />
            </div>
          </div>

          {(servicoSelecionado || data || form.horarioSelecionado || form.nome || form.celular) && (
            <div className="border-t border-white/10 pt-8">
              <h3 className="text-white font-semibold mb-4">Resumo da reserva</h3>
              <div className="space-y-2 text-sm text-gray-400 mb-6">
                <div className="flex justify-between">
                  <span>Serviço:</span>
                  <span className="text-white">{servicoSelecionado?.nome ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duração:</span>
                  <span className="text-white">{servicoSelecionado ? `${servicoSelecionado.duracao_minutos} min` : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor:</span>
                  <span className="text-white">{servicoSelecionado ? formatarPreco(Number(servicoSelecionado.preco)) : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data:</span>
                  <span className="text-white">{data ? formatarDataResumo(data) : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Início:</span>
                  <span className="text-white">{form.horarioSelecionado ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fim:</span>
                  <span className="text-white">{slotSelecionado?.hora_fim ?? "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nome:</span>
                  <span className="text-white">{form.nome || "-"}</span>
                </div>
              </div>
              <button
                onClick={reservar}
                disabled={!podeConfirmar}
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
