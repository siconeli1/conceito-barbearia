"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatarHora, getTodayInputValue } from "@/lib/format"
import { AGENDA_CONFIG, generateSlots, reduceVisibleSlots } from "@/lib/agenda"

type StatusAgendamento = "agendado" | "confirmado" | "cancelado" | "no_show"
type StatusAtendimento = "pendente" | "em_atendimento" | "concluido"
type StatusPagamento = "pendente" | "pago" | "estornado"
type View = "operacao" | "agenda" | "clientes" | "financeiro" | "mais"
type AgendaMode = "dia" | "semana"
type MobileSection = "cronograma" | "financeiro" | "bloqueios" | "horarios" | "clientes"

type Agendamento = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  nome_cliente: string
  celular_cliente: string
  servico_nome?: string
  servico_preco?: number
  valor_tabela?: number
  valor_final?: number
  desconto?: number
  acrescimo?: number
  status: string
  status_agendamento?: StatusAgendamento
  status_atendimento?: StatusAtendimento
  status_pagamento?: StatusPagamento
  origem_agendamento?: "site" | "admin_manual" | "horario_customizado"
  forma_pagamento?: string | null
  observacoes?: string | null
  origem?: "agendamento" | "horario_customizado"
}

type Bloqueio = {
  id: string
  data: string
  hora_inicio: string | null
  hora_fim: string | null
  dia_inteiro: boolean
  motivo: string | null
  tipo_bloqueio: "horario" | "dia_inteiro" | "nao_aceitar_mais"
}

type HorarioCustomizado = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  nome_cliente: string | null
  celular_cliente: string | null
}

type DraftFinanceiro = {
  desconto: string
  acrescimo: string
  valor_final: string
  forma_pagamento: string
  observacoes: string
}

type ConfirmacaoOperacao = {
  acao: "cancelar_agendamento" | "marcar_falta" | "remover_horario"
  item: Agendamento
}

const NAV_ITEMS: { id: View; label: string; shortLabel: string }[] = [
  { id: "operacao", label: "Dia", shortLabel: "Dia" },
  { id: "agenda", label: "Agenda", shortLabel: "Agenda" },
  { id: "clientes", label: "Clientes", shortLabel: "Clientes" },
  { id: "financeiro", label: "Financeiro", shortLabel: "Caixa" },
  { id: "mais", label: "Mais", shortLabel: "Mais" },
]

function formatarDataBR(data: string) {
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function timeToMinutes(hora: string) {
  const [h, m] = hora.slice(0, 5).split(":").map(Number)
  return h * 60 + m
}

function addDays(dateIso: string, amount: number) {
  const [year, month, day] = dateIso.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getStartOfWeek(dateIso: string) {
  const [year, month, day] = dateIso.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatWeekday(dateIso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${dateIso}T12:00:00`))
}

function buildTimeSlotsForDay(dateIso: string) {
  const day = new Date(`${dateIso}T00:00:00`).getDay()
  return reduceVisibleSlots(generateSlots(day, AGENDA_CONFIG.visibleSlotMinutes)).map((slot) => slot.hora_inicio)
}

function getCurrentMinutesInSaoPaulo(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(referenceDate)

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  ) as Record<string, string>

  return Number(values.hour) * 60 + Number(values.minute)
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

async function lerRespostaJson(res: Response) {
  const contentType = res.headers.get("content-type") || ""
  const body = await res.text()

  if (!contentType.includes("application/json")) {
    throw new Error(body || "Resposta invalida do servidor.")
  }

  return JSON.parse(body) as Record<string, unknown> | Record<string, unknown>[]
}

function badgeLabel(item: Agendamento) {
  if (item.origem === "horario_customizado") return "Horario personalizado"
  if (item.status_agendamento === "cancelado" || item.status === "cancelado") return "Cancelado"
  if (item.status_agendamento === "no_show") return "Nao compareceu"
  if (item.status_atendimento === "concluido") return "Concluido"
  return "Agendado"
}

function canCancel(item: Agendamento) {
  if (item.origem === "horario_customizado") return true
  return item.status_agendamento !== "cancelado" && item.status_agendamento !== "no_show" && item.status_atendimento !== "concluido"
}

function canConclude(item: Agendamento) {
  return item.origem !== "horario_customizado" && item.status_agendamento !== "cancelado" && item.status_agendamento !== "no_show" && item.status_atendimento !== "concluido"
}

function canNoShow(item: Agendamento) {
  return item.origem !== "horario_customizado" && item.status_agendamento !== "cancelado" && item.status_agendamento !== "no_show" && item.status_atendimento !== "concluido"
}

function normalizePhoneLink(phone?: string | null) {
  const digits = String(phone ?? "").replace(/\D/g, "")
  return digits ? `https://wa.me/55${digits}` : null
}

export default function AdminPage() {
  const today = getTodayInputValue()
  const clientesHistoricoInicio = "2000-01-01"
  const [view, setView] = useState<View>("operacao")
  const [agendaMode, setAgendaMode] = useState<AgendaMode>("dia")
  const [dataOperacao, setDataOperacao] = useState(today)
  const [semanaBase, setSemanaBase] = useState(getStartOfWeek(today))
  const [financeDateFrom, setFinanceDateFrom] = useState(today)
  const [financeDateTo, setFinanceDateTo] = useState(today)
  const [agendamentosDia, setAgendamentosDia] = useState<Agendamento[]>([])
  const [agendamentosSemana, setAgendamentosSemana] = useState<Agendamento[]>([])
  const [agendamentosFinanceiro, setAgendamentosFinanceiro] = useState<Agendamento[]>([])
  const [agendamentosClientes, setAgendamentosClientes] = useState<Agendamento[]>([])
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [todosBloqueios, setTodosBloqueios] = useState<Bloqueio[]>([])
  const [horarios, setHorarios] = useState<HorarioCustomizado[]>([])
  const [dataBloqueio, setDataBloqueio] = useState(today)
  const [dataHorarios, setDataHorarios] = useState(today)
  const [tipoNovoBloqueio, setTipoNovoBloqueio] = useState<Bloqueio["tipo_bloqueio"]>("horario")
  const [loadingOperacao, setLoadingOperacao] = useState(true)
  const [loadingSemana, setLoadingSemana] = useState(true)
  const [loadingFinanceiro, setLoadingFinanceiro] = useState(true)
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftFinanceiro>>({})
  const [buscaCliente, setBuscaCliente] = useState("")
  const [mobileSection, setMobileSection] = useState<MobileSection>("cronograma")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>(null)
  const [confirmacaoOperacao, setConfirmacaoOperacao] = useState<ConfirmacaoOperacao | null>(null)
  const [processandoConfirmacao, setProcessandoConfirmacao] = useState(false)

  const operacaoRequestRef = useRef(0)
  const semanaRequestRef = useRef(0)
  const financeiroRequestRef = useRef(0)
  const clientesRequestRef = useRef(0)
  const operacaoAbortRef = useRef<AbortController | null>(null)
  const semanaAbortRef = useRef<AbortController | null>(null)
  const financeiroAbortRef = useRef<AbortController | null>(null)
  const clientesAbortRef = useRef<AbortController | null>(null)

  const carregarOperacao = useCallback(async (data: string) => {
    const requestId = ++operacaoRequestRef.current
    operacaoAbortRef.current?.abort()
    const controller = new AbortController()
    operacaoAbortRef.current = controller
    setLoadingOperacao(true)
    setErro(null)

    try {
      const res = await fetch(`/api/admin-agenda?data=${encodeURIComponent(data)}`, { signal: controller.signal })
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao carregar agenda."))
      if (requestId !== operacaoRequestRef.current || controller.signal.aborted) return
      setAgendamentosDia(Array.isArray(json) ? (json as Agendamento[]) : [])
    } catch (error) {
      if (requestId !== operacaoRequestRef.current || controller.signal.aborted) return
      setErro(error instanceof Error ? error.message : "Erro ao carregar agenda.")
      setAgendamentosDia([])
    } finally {
      if (requestId === operacaoRequestRef.current && !controller.signal.aborted) {
        setLoadingOperacao(false)
      }
    }
  }, [])

  const carregarFaixa = useCallback(
    async (
      from: string,
      to: string,
      requestRef: React.MutableRefObject<number>,
      abortRef: React.MutableRefObject<AbortController | null>,
      setLoading: (value: boolean) => void,
      setData: (value: Agendamento[]) => void,
      errorMessage: string
    ) => {
      const requestId = ++requestRef.current
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)

      try {
        const res = await fetch(
          `/api/admin-agenda?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,
          { signal: controller.signal }
        )
        const json = await lerRespostaJson(res)
        if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || errorMessage))
        if (requestId !== requestRef.current || controller.signal.aborted) return
        setData(Array.isArray(json) ? (json as Agendamento[]) : [])
      } catch (error) {
        if (requestId !== requestRef.current || controller.signal.aborted) return
        setErro(error instanceof Error ? error.message : errorMessage)
        setData([])
      } finally {
        if (requestId === requestRef.current && !controller.signal.aborted) {
          setLoading(false)
        }
      }
    },
    []
  )

  const carregarSemana = useCallback(async (from: string, to: string) => {
    await carregarFaixa(from, to, semanaRequestRef, semanaAbortRef, setLoadingSemana, setAgendamentosSemana, "Erro ao carregar semana.")
  }, [carregarFaixa])

  const carregarFinanceiro = useCallback(async (from: string, to: string) => {
    await carregarFaixa(from, to, financeiroRequestRef, financeiroAbortRef, setLoadingFinanceiro, setAgendamentosFinanceiro, "Erro ao carregar financeiro.")
  }, [carregarFaixa])

  const carregarClientes = useCallback(async (from: string, to: string) => {
    await carregarFaixa(from, to, clientesRequestRef, clientesAbortRef, setLoadingClientes, setAgendamentosClientes, "Erro ao carregar clientes.")
  }, [carregarFaixa])

  const carregarBloqueios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/bloqueios?data=${data}`)
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao carregar bloqueios."))
      setBloqueios(((json as Record<string, unknown>).bloqueios as Bloqueio[]) || [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar bloqueios.")
      setBloqueios([])
    }
  }, [])

  const carregarTodosBloqueios = useCallback(async () => {
    try {
      const res = await fetch("/api/bloqueios/todos")
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao carregar bloqueios."))
      const lista = (((json as Record<string, unknown>).bloqueios as Bloqueio[]) || []).sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      )
      setTodosBloqueios(lista)
    } catch {
      setTodosBloqueios([])
    }
  }, [])

  const carregarHorarios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/horarios-customizados?data=${data}`)
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao carregar horarios."))
      setHorarios(((json as Record<string, unknown>).horarios as HorarioCustomizado[]) || [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar horarios.")
      setHorarios([])
    }
  }, [])

  useEffect(() => {
    carregarOperacao(dataOperacao)
  }, [carregarOperacao, dataOperacao])

  useEffect(() => {
    carregarSemana(semanaBase, addDays(semanaBase, 6))
  }, [carregarSemana, semanaBase])

  useEffect(() => {
    carregarFinanceiro(financeDateFrom, financeDateTo)
  }, [carregarFinanceiro, financeDateFrom, financeDateTo])

  useEffect(() => {
    carregarClientes(clientesHistoricoInicio, today)
  }, [carregarClientes, clientesHistoricoInicio, today])

  useEffect(() => {
    if (view === "mais") {
      carregarBloqueios(dataBloqueio)
      carregarTodosBloqueios()
      carregarHorarios(dataHorarios)
    }
  }, [view, dataBloqueio, dataHorarios, carregarBloqueios, carregarTodosBloqueios, carregarHorarios])

  useEffect(() => {
    return () => {
      operacaoAbortRef.current?.abort()
      semanaAbortRef.current?.abort()
      financeiroAbortRef.current?.abort()
      clientesAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!mensagem) return
    const timer = setTimeout(() => setMensagem(null), 4000)
    return () => clearTimeout(timer)
  }, [mensagem])

  useEffect(() => {
    setMobileExpandedId(null)
  }, [mobileSection, agendaMode, dataOperacao, semanaBase])

  const metricasDia = useMemo(() => {
    const reais = agendamentosDia.filter((item) => item.origem !== "horario_customizado")
    const receitaPrevista = reais
      .filter((item) => item.status_agendamento !== "cancelado")
      .reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)
    const realizados = reais.filter((item) => item.status_atendimento === "concluido" && item.status_pagamento === "pago")
    const receitaRealizada = realizados.reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)

    return {
      agendados: reais.length,
      personalizados: agendamentosDia.filter((item) => item.origem === "horario_customizado").length,
      receitaPrevista,
      receitaRealizada,
      ticketMedio: realizados.length ? receitaRealizada / realizados.length : 0,
      pendenciasPagamento: reais.filter((item) => item.status_atendimento === "concluido" && item.status_pagamento !== "pago").length,
    }
  }, [agendamentosDia])

  const servicosDoDia = useMemo(() => {
    return Array.from(
      new Set(
        agendamentosDia
          .filter((item) => item.origem !== "horario_customizado")
          .map((item) => item.servico_nome)
          .filter(Boolean)
      )
    ) as string[]
  }, [agendamentosDia])

  const metricasFinanceiras = useMemo(() => {
    const reais = agendamentosFinanceiro.filter((item) => item.origem !== "horario_customizado")
    const previstos = reais.filter((item) => item.status_agendamento !== "cancelado")
    const realizados = reais.filter((item) => item.status_atendimento === "concluido")
    const pagos = realizados.filter((item) => item.status_pagamento === "pago")
    const cancelados = reais.filter((item) => item.status_agendamento === "cancelado")
    const noShow = reais.filter((item) => item.status_agendamento === "no_show")
    const faturamentoPrevisto = previstos.reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)
    const faturamentoRealizado = pagos.reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)

    const porServico = Object.values(
      reais.reduce<Record<string, { nome: string; total: number; receita: number }>>((acc, item) => {
        const nome = item.servico_nome || "Nao informado"
        if (!acc[nome]) acc[nome] = { nome, total: 0, receita: 0 }
        acc[nome].total += 1
        acc[nome].receita += Number(item.valor_final ?? item.servico_preco ?? 0)
        return acc
      }, {})
    ).sort((a, b) => b.receita - a.receita)

    const porPagamento = Object.values(
      pagos.reduce<Record<string, { forma: string; total: number; receita: number }>>((acc, item) => {
        const forma = item.forma_pagamento || "Nao informado"
        if (!acc[forma]) acc[forma] = { forma, total: 0, receita: 0 }
        acc[forma].total += 1
        acc[forma].receita += Number(item.valor_final ?? item.servico_preco ?? 0)
        return acc
      }, {})
    ).sort((a, b) => b.receita - a.receita)

    return {
      faturamentoPrevisto,
      faturamentoRealizado,
      realizados: realizados.length,
      pagos: pagos.length,
      cancelados: cancelados.length,
      noShow: noShow.length,
      ticketMedio: pagos.length ? faturamentoRealizado / pagos.length : 0,
      porServico,
      porPagamento,
    }
  }, [agendamentosFinanceiro])

  const metricasClientes = useMemo(() => {
    const reais = agendamentosClientes.filter((item) => item.origem !== "horario_customizado")
    return Object.values(
      reais.reduce<Record<string, { celular: string; nome: string; total: number; receita: number; cancelados: number; ultData: string }>>((acc, item) => {
        const key = item.celular_cliente || item.id
        if (!acc[key]) {
          acc[key] = {
            celular: item.celular_cliente || "",
            nome: item.nome_cliente,
            total: 0,
            receita: 0,
            cancelados: 0,
            ultData: item.data,
          }
        }
        acc[key].total += 1
        acc[key].receita += Number(item.valor_final ?? item.servico_preco ?? 0)
        if (item.status_agendamento === "cancelado") acc[key].cancelados += 1
        if (item.data > acc[key].ultData) {
          acc[key].ultData = item.data
          acc[key].nome = item.nome_cliente
        }
        return acc
      }, {})
    ).sort((a, b) => b.receita - a.receita)
  }, [agendamentosClientes])

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase()
    if (!termo) return metricasClientes
    return metricasClientes.filter((cliente) => {
      return cliente.nome.toLowerCase().includes(termo) || cliente.celular.toLowerCase().includes(termo)
    })
  }, [buscaCliente, metricasClientes])

  const operacaoAtiva = useMemo(
    () => agendamentosDia.filter((item) => item.status_agendamento !== "cancelado" && item.status !== "cancelado"),
    [agendamentosDia]
  )
  const operacaoCancelada = useMemo(
    () => agendamentosDia.filter((item) => item.status_agendamento === "cancelado" || item.status === "cancelado"),
    [agendamentosDia]
  )
  const minutosAtuais = getCurrentMinutesInSaoPaulo()
  const proximosHorarios = useMemo(
    () =>
      operacaoAtiva
        .filter((item) => dataOperacao !== today || timeToMinutes(item.hora_inicio) > minutosAtuais)
        .slice()
        .sort((a, b) => `${a.data}T${a.hora_inicio}`.localeCompare(`${b.data}T${b.hora_inicio}`))
        .slice(0, 5),
    [dataOperacao, minutosAtuais, operacaoAtiva, today]
  )
  const atendimentoAtual = useMemo(
    () =>
      operacaoAtiva.find((item) => {
        const inicio = timeToMinutes(item.hora_inicio)
        const fim = timeToMinutes(item.hora_fim)
        return dataOperacao === today && minutosAtuais >= inicio && minutosAtuais < fim
      }) ?? null,
    [dataOperacao, minutosAtuais, operacaoAtiva, today]
  )
  const proximoHorario = proximosHorarios[0] ?? null
  const agoraSaoPaulo = getCurrentDateTimeInSaoPaulo()
  const clientesPendentesHoje = operacaoAtiva.filter(
    (item) =>
      item.origem !== "horario_customizado" &&
      item.status_atendimento !== "concluido" &&
      timeToMinutes(item.hora_inicio) >= minutosAtuais
  ).length

  const resumoSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const data = addDays(semanaBase, index)
      const ativos = agendamentosSemana
        .filter((item) => item.data === data && item.status_agendamento !== "cancelado" && item.status !== "cancelado")
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
      const receita = ativos
        .filter((item) => item.origem !== "horario_customizado")
        .reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)

      return {
        data,
        ativos,
        receita,
        personalizados: ativos.filter((item) => item.origem === "horario_customizado").length,
      }
    })
  }, [agendamentosSemana, semanaBase])

  const totalSemana = resumoSemana.reduce(
    (acc, dia) => ({
      atendimentos: acc.atendimentos + dia.ativos.filter((item) => item.origem !== "horario_customizado").length,
      personalizados: acc.personalizados + dia.personalizados,
      receita: acc.receita + dia.receita,
    }),
    { atendimentos: 0, personalizados: 0, receita: 0 }
  )
  const mobileTimeSlots = useMemo(() => buildTimeSlotsForDay(dataOperacao), [dataOperacao])

  function getDraft(item: Agendamento): DraftFinanceiro {
    return drafts[item.id] || {
      desconto: String(Number(item.desconto ?? 0)),
      acrescimo: String(Number(item.acrescimo ?? 0)),
      valor_final: String(Number(item.valor_final ?? item.servico_preco ?? 0)),
      forma_pagamento: item.forma_pagamento || "",
      observacoes: item.observacoes || "",
    }
  }

  function setDraft(id: string, patch: Partial<DraftFinanceiro>) {
    const base: DraftFinanceiro = {
      desconto: "0",
      acrescimo: "0",
      valor_final: "0",
      forma_pagamento: "",
      observacoes: "",
    }

    setDrafts((current) => ({
      ...current,
      [id]: {
        ...base,
        ...current[id],
        ...patch,
      },
    }))
  }

  async function refreshAll() {
    await Promise.all([
      carregarOperacao(dataOperacao),
      carregarSemana(semanaBase, addDays(semanaBase, 6)),
      carregarFinanceiro(financeDateFrom, financeDateTo),
      carregarClientes(clientesHistoricoInicio, today),
    ])
  }

  function abrirConfirmacaoOperacao(acao: ConfirmacaoOperacao["acao"], item: Agendamento) {
    setConfirmacaoOperacao({ acao, item })
  }

  async function executarConfirmacaoOperacao() {
    if (!confirmacaoOperacao) return

    const { acao, item } = confirmacaoOperacao
    setProcessandoConfirmacao(true)

    try {
      if (acao === "remover_horario") {
        await deletarHorario(item.id, { skipConfirm: true })
        return
      }

      if (acao === "cancelar_agendamento") {
        await atualizarAgendamento(item.id, { status_agendamento: "cancelado" })
        return
      }

      await marcarFalta(item)
    } finally {
      setProcessandoConfirmacao(false)
      setConfirmacaoOperacao(null)
    }
  }

  function confirmarCancelamento(item: Agendamento) {
    abrirConfirmacaoOperacao(item.origem === "horario_customizado" ? "remover_horario" : "cancelar_agendamento", item)
  }

  function solicitarMarcarFalta(item: Agendamento) {
    abrirConfirmacaoOperacao("marcar_falta", item)
  }

  async function atualizarAgendamento(id: string, patch: Record<string, string | number | null>) {
    setErro(null)
    setMensagem(null)
    try {
      const res = await fetch("/api/admin-agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      })
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao atualizar agendamento."))
      setMensagem("Agendamento atualizado com sucesso.")
      await refreshAll()
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao atualizar agendamento.")
    }
  }

  function podeConcluirAgora(item: Agendamento) {
    if (!canConclude(item)) return false
    if (item.data < agoraSaoPaulo.date) return true
    if (item.data > agoraSaoPaulo.date) return false
    return timeToMinutes(item.hora_inicio) <= agoraSaoPaulo.minutes
  }

  function podeMarcarFaltaAgora(item: Agendamento) {
    if (!canNoShow(item)) return false
    if (item.data < agoraSaoPaulo.date) return true
    if (item.data > agoraSaoPaulo.date) return false
    return timeToMinutes(item.hora_inicio) <= agoraSaoPaulo.minutes
  }

  async function concluirAtendimento(item: Agendamento) {
    if (!podeConcluirAgora(item)) {
      setErro(`O atendimento de ${item.nome_cliente} so pode ser concluido apos ${formatarHora(item.hora_inicio)}.`)
      return
    }

    await atualizarAgendamento(item.id, {
      status_atendimento: "concluido",
      status_pagamento: "pago",
    })
  }

  async function marcarFalta(item: Agendamento) {
    if (!podeMarcarFaltaAgora(item)) {
      setErro(`So e possivel marcar falta para ${item.nome_cliente} apos ${formatarHora(item.hora_inicio)}.`)
      return
    }

    await atualizarAgendamento(item.id, { status_agendamento: "no_show" })
  }

  async function salvarFinanceiro(item: Agendamento) {
    const draft = getDraft(item)
    await atualizarAgendamento(item.id, {
      desconto: Number(draft.desconto || 0),
      acrescimo: Number(draft.acrescimo || 0),
      valor_final: Number(draft.valor_final || 0),
      forma_pagamento: draft.forma_pagamento || null,
      observacoes: draft.observacoes || null,
    })
  }

  async function criarBloqueio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setErro(null)
    setMensagem(null)
    try {
      const data = String(form.get("data") || "")
      const res = await fetch("/api/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          hora_inicio: tipoNovoBloqueio === "horario" ? String(form.get("hora_inicio") || "") || null : null,
          hora_fim: tipoNovoBloqueio === "horario" ? String(form.get("hora_fim") || "") || null : null,
          dia_inteiro: tipoNovoBloqueio === "dia_inteiro",
          motivo: String(form.get("motivo") || "") || null,
          tipo_bloqueio: tipoNovoBloqueio,
        }),
      })
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao criar bloqueio."))
      setMensagem("Bloqueio criado com sucesso.")
      setDataBloqueio(data)
      await Promise.all([carregarBloqueios(data), carregarTodosBloqueios()])
      ;(e.currentTarget as HTMLFormElement).reset()
      setTipoNovoBloqueio("horario")
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao criar bloqueio.")
    }
  }

  async function deletarBloqueio(id: string) {
    if (!confirm("Remover este bloqueio?")) return
    setErro(null)
    setMensagem(null)
    try {
      const res = await fetch("/api/bloqueios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao remover bloqueio."))
      setMensagem("Bloqueio removido com sucesso.")
      await Promise.all([carregarBloqueios(dataBloqueio), carregarTodosBloqueios()])
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao remover bloqueio.")
    }
  }

  async function criarHorario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setErro(null)
    setMensagem(null)
    try {
      const res = await fetch("/api/horarios-customizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: form.get("data-horario"),
          hora_inicio: form.get("hora_inicio"),
          hora_fim: form.get("hora_fim"),
          nome_cliente: form.get("nome_cliente"),
          celular_cliente: form.get("celular_cliente"),
        }),
      })
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao criar horario."))
      setMensagem("Horario personalizado criado com sucesso.")
      await Promise.all([carregarHorarios(dataHorarios), refreshAll()])
      ;(e.currentTarget as HTMLFormElement).reset()
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao criar horario.")
    }
  }

  async function deletarHorario(id: string, options?: { skipConfirm?: boolean }) {
    if (!options?.skipConfirm && !confirm("Remover este horario personalizado?")) return
    setErro(null)
    setMensagem(null)
    try {
      const res = await fetch("/api/horarios-customizados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao remover horario."))
      setMensagem("Horario removido com sucesso.")
      await Promise.all([carregarHorarios(dataHorarios), refreshAll()])
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao remover horario.")
    }
  }

  return (
    <main className="min-h-screen px-4 py-4 text-white sm:p-8">
      <div className="mx-auto max-w-7xl pb-24 md:pb-8">
        <header className="mb-6 hidden rounded-[28px] border border-[var(--line)] bg-black/30 p-5 backdrop-blur-sm sm:p-8 md:block">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-[var(--accent-strong)]">Conceito Barbearia</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-5xl">Painel do barbeiro</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
                Operacao primeiro, semana quando precisar e funcoes administrativas organizadas.
              </p>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" })
                window.location.href = "/admin/login"
              }}
              className="h-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10"
            >
              Sair
            </button>
          </div>
        </header>

        <nav className="mb-6 hidden gap-2 overflow-x-auto md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id)
                setErro(null)
                setMensagem(null)
              }}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                view === item.id ? "bg-[var(--accent)] text-black" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {erro && <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-200">{mensagem}</div>}
        {confirmacaoOperacao && (
          <ConfirmActionDialog
            state={confirmacaoOperacao}
            loading={processandoConfirmacao}
            onClose={() => {
              if (!processandoConfirmacao) setConfirmacaoOperacao(null)
            }}
            onConfirm={executarConfirmacaoOperacao}
          />
        )}

        <section className="md:hidden">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] border border-[var(--line)] bg-[rgba(18,18,18,0.92)] px-4 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-strong)]">Admin mobile</p>
              <h2 className="mt-2 text-xl font-semibold">
                {mobileSection === "cronograma"
                  ? agendaMode === "dia"
                    ? `Dia ${formatarDataBR(dataOperacao)}`
                    : `Semana ${formatarDataBR(semanaBase)}`
                  : mobileSection === "financeiro"
                    ? "Financeiro"
                    : mobileSection === "bloqueios"
                      ? "Bloqueios"
                      : mobileSection === "horarios"
                        ? "Marcar horarios"
                        : "Clientes"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {mobileSection !== "cronograma" && (
                <button
                  type="button"
                  onClick={() => setMobileSection("cronograma")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm"
                >
                  Agenda
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm"
              >
                Menu
              </button>
            </div>
          </div>

          {mobileSection === "cronograma" && (
            <MobileScheduleSection
              agendaMode={agendaMode}
              setAgendaMode={setAgendaMode}
              dataOperacao={dataOperacao}
              setDataOperacao={setDataOperacao}
              today={today}
              semanaBase={semanaBase}
              setSemanaBase={setSemanaBase}
              slots={mobileTimeSlots}
              operacaoDoDia={agendamentosDia}
              resumoSemana={resumoSemana}
              expandedId={mobileExpandedId}
              setExpandedId={setMobileExpandedId}
              loadingOperacao={loadingOperacao}
              loadingSemana={loadingSemana}
              canConcludeNow={podeConcluirAgora}
              canNoShowNow={podeMarcarFaltaAgora}
              onCancelar={confirmarCancelamento}
              onConcluir={concluirAtendimento}
              onNoShow={solicitarMarcarFalta}
            />
          )}

          {mobileSection === "financeiro" && (
            <FinanceSection
              today={today}
              financeDateFrom={financeDateFrom}
              financeDateTo={financeDateTo}
              setFinanceDateFrom={setFinanceDateFrom}
              setFinanceDateTo={setFinanceDateTo}
              loadingFinanceiro={loadingFinanceiro}
              metricasFinanceiras={metricasFinanceiras}
            />
          )}

          {mobileSection === "clientes" && (
            <Panel title="Clientes" subtitle="Todos que ja fizeram cadastro na barbearia">
              <div className="mb-3 grid gap-3">
                <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar por nome ou celular" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3" />
              </div>
              <div className="space-y-3">
                {loadingClientes && <p className="text-[var(--muted)]">Carregando clientes...</p>}
                {!loadingClientes && clientesFiltrados.map((cliente) => <ClienteCard key={`${cliente.celular}-${cliente.ultData}`} cliente={cliente} />)}
              </div>
            </Panel>
          )}

          {mobileSection === "bloqueios" && (
            <BloqueiosPanel
              dataBloqueio={dataBloqueio}
              setDataBloqueio={setDataBloqueio}
              tipoNovoBloqueio={tipoNovoBloqueio}
              setTipoNovoBloqueio={setTipoNovoBloqueio}
              criarBloqueio={criarBloqueio}
              bloqueios={bloqueios}
              todosBloqueios={todosBloqueios}
              deletarBloqueio={deletarBloqueio}
            />
          )}

          {mobileSection === "horarios" && (
            <HorariosPanel
              dataHorarios={dataHorarios}
              setDataHorarios={setDataHorarios}
              criarHorario={criarHorario}
              horarios={horarios}
              deletarHorario={deletarHorario}
            />
          )}

          {mobileMenuOpen && (
            <MobileMenuSheet
              current={mobileSection}
              onClose={() => setMobileMenuOpen(false)}
              onSelect={(section) => {
                setMobileSection(section)
                setMobileMenuOpen(false)
              }}
            />
          )}
        </section>

        <div className="hidden md:block">
        {view === "operacao" && (
          <section className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard titulo="Pendentes do dia" valor={String(clientesPendentesHoje)} />
              <MetricCard titulo="Receita do dia" valor={moeda(metricasDia.receitaPrevista)} accent />
              <MetricCard titulo="Proximo horario" valor={proximoHorario ? formatarHora(proximoHorario.hora_inicio) : "--:--"} success />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <MoreActionCard title="Abrir semana" description="Visao ampla dos proximos 7 dias." onClick={() => { setView("agenda"); setAgendaMode("semana") }} />
              <MoreActionCard title="Bloquear ou adicionar" description="Acesse bloqueios e horarios manuais." onClick={() => setView("mais")} />
              <MoreActionCard title="Ver clientes" description="Busque historico e chame no WhatsApp." onClick={() => setView("clientes")} />
              <MoreActionCard title="Ver faturamento" description="Acompanhe caixa, servicos e pagamentos." onClick={() => setView("financeiro")} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <Panel title="Agora" subtitle={`Resumo rapido de ${formatarDataBR(dataOperacao)}`}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SpotlightCard label="Em atendimento" emptyLabel="Nenhum atendimento em andamento" item={atendimentoAtual} />
                    <SpotlightCard label="Proximo cliente" emptyLabel="Sem proximos horarios" item={proximoHorario} />
                  </div>
                </Panel>

                <Panel title="Agenda do dia" subtitle="Linha do tempo com acoes operacionais">
                  <div className="mb-5 space-y-4">
                    <input type="date" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} className="datetime-input w-full rounded-2xl border border-white/10 px-4 py-3 text-white" />
                    <div className="grid grid-cols-3 gap-2">
                      <QuickFilterButton label="Hoje" onClick={() => setDataOperacao(today)} active={dataOperacao === today} />
                      <QuickFilterButton label="Amanha" onClick={() => setDataOperacao(addDays(today, 1))} />
                      <QuickFilterButton label="Semana" onClick={() => { setSemanaBase(getStartOfWeek(dataOperacao)); setView("agenda"); setAgendaMode("semana") }} />
                    </div>
                    {servicosDoDia.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {servicosDoDia.map((servico) => (
                          <span key={servico} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                            {servico}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <MetricCard titulo="Agend." valor={String(metricasDia.agendados)} />
                    <MetricCard titulo="Manuais" valor={String(metricasDia.personalizados)} />
                    <MetricCard titulo="Previsto" valor={moeda(metricasDia.receitaPrevista)} accent />
                    <MetricCard titulo="Realizado" valor={moeda(metricasDia.receitaRealizada)} success />
                    <MetricCard titulo="Pend." valor={String(metricasDia.pendenciasPagamento)} />
                  </div>

                  <div className="space-y-4">
                    {loadingOperacao && <p className="text-[var(--muted)]">Carregando...</p>}
                    {!loadingOperacao && agendamentosDia.length === 0 && <p className="text-[var(--muted)]">Nenhum item para {formatarDataBR(dataOperacao)}.</p>}
                    {!loadingOperacao && operacaoAtiva.map((item) => {
                      const draft = getDraft(item)
                      const whatsappHref = normalizePhoneLink(item.celular_cliente)
                      return (
                        <article key={item.id} className="rounded-[24px] border border-white/10 bg-black/25 p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-2xl font-semibold">{formatarHora(item.hora_inicio)}</p>
                              <p className="text-sm text-[var(--muted)]">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</p>
                            </div>
                            <Badge label={badgeLabel(item)} />
                          </div>
                          <p className="text-lg text-white">{item.nome_cliente}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{item.celular_cliente || "Sem telefone"}</p>
                          <p className="mt-2 text-sm text-zinc-200">{item.servico_nome || "Servico nao informado"}</p>
                          <ActionFooter
                            canConcluir={podeConcluirAgora(item)}
                            canNoShow={podeMarcarFaltaAgora(item)}
                            canCancelar={canCancel(item)}
                            cancelLabel={item.origem === "horario_customizado" ? "Remover" : "Cancelar"}
                            whatsappHref={whatsappHref}
                            onConcluir={() => concluirAtendimento(item)}
                            onNoShow={() => solicitarMarcarFalta(item)}
                            onCancelar={() => confirmarCancelamento(item)}
                          />
                          {item.origem !== "horario_customizado" && (
                            <CollapsibleCard title="Ajuste financeiro" subtitle="Abra so quando precisar">
                              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <InputMoney label="Desconto" value={draft.desconto} onChange={(value) => setDraft(item.id, { desconto: value })} />
                                <InputMoney label="Acrescimo" value={draft.acrescimo} onChange={(value) => setDraft(item.id, { acrescimo: value })} />
                                <InputMoney label="Valor final" value={draft.valor_final} onChange={(value) => setDraft(item.id, { valor_final: value })} />
                              </div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                                <select value={draft.forma_pagamento} onChange={(e) => setDraft(item.id, { forma_pagamento: e.target.value })} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                                  <option value="">Forma de pagamento</option>
                                  <option value="pix">Pix</option>
                                  <option value="dinheiro">Dinheiro</option>
                                  <option value="credito">Credito</option>
                                  <option value="debito">Debito</option>
                                </select>
                                <input value={draft.observacoes} onChange={(e) => setDraft(item.id, { observacoes: e.target.value })} placeholder="Observacoes do atendimento" className="rounded-xl border border-white/10 bg-black/30 px-3 py-3" />
                              </div>
                              <button onClick={() => salvarFinanceiro(item)} className="mt-4 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-black">Salvar ajuste</button>
                            </CollapsibleCard>
                          )}
                        </article>
                      )
                    })}
                    {!loadingOperacao && operacaoCancelada.length > 0 && (
                      <CollapsibleCard title={`Cancelados (${operacaoCancelada.length})`} subtitle="Toque para expandir">
                        <div className="space-y-3">
                          {operacaoCancelada.map((item) => (
                            <article key={item.id} className="rounded-2xl border border-red-500/10 bg-red-500/[0.04] p-4 opacity-85">
                              <p className="text-lg font-semibold">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</p>
                              <p className="text-white">{item.nome_cliente}</p>
                            </article>
                          ))}
                        </div>
                      </CollapsibleCard>
                    )}
                  </div>
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel title="Radar do dia" subtitle={`Resumo de ${formatarDataBR(dataOperacao)}`}>
                  <div className="space-y-4">
                    <InfoRow label="Receita prevista" value={moeda(metricasDia.receitaPrevista)} accent />
                    <InfoRow label="Receita realizada" value={moeda(metricasDia.receitaRealizada)} success />
                    <InfoRow label="Ticket medio" value={moeda(metricasDia.ticketMedio)} />
                    <InfoRow label="Pendencias" value={String(metricasDia.pendenciasPagamento)} />
                  </div>
                </Panel>

                <Panel title="Fila do dia" subtitle="Quem ainda precisa da sua atencao">
                  <div className="space-y-3 text-sm">
                    {proximosHorarios.map((item) => (
                      <button key={item.id} type="button" onClick={() => setDataOperacao(item.data)} className="w-full rounded-xl border border-white/10 px-3 py-3 text-left hover:bg-white/5">
                        <p className="text-white">{item.nome_cliente}</p>
                        <p className="text-[var(--muted)]">{formatarHora(item.hora_inicio)} - {item.servico_nome || "Servico nao informado"}</p>
                      </button>
                    ))}
                    {proximosHorarios.length === 0 && <p className="text-[var(--muted)]">Nenhum horario ativo agora.</p>}
                  </div>
                </Panel>
              </div>
            </div>
          </section>
        )}

        {view === "agenda" && <AgendaSection agendaMode={agendaMode} setAgendaMode={setAgendaMode} dataOperacao={dataOperacao} setDataOperacao={setDataOperacao} today={today} semanaBase={semanaBase} setSemanaBase={setSemanaBase} loadingOperacao={loadingOperacao} loadingSemana={loadingSemana} metricasDia={metricasDia} agendamentosDia={agendamentosDia} resumoSemana={resumoSemana} totalSemana={totalSemana} />}

        {view === "clientes" && (
          <Panel title="Clientes" subtitle="Base completa de todos os cadastros ja feitos">
            <div className="mb-6">
              <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar por nome ou celular" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
            </div>
            <div className="grid gap-3">
              {loadingClientes && <p className="text-[var(--muted)]">Carregando clientes...</p>}
              {!loadingClientes && clientesFiltrados.length === 0 && <p className="text-[var(--muted)]">Nenhum cliente encontrado.</p>}
              {clientesFiltrados.map((cliente) => <ClienteCard key={`${cliente.celular}-${cliente.ultData}`} cliente={cliente} />)}
            </div>
          </Panel>
        )}

        {view === "financeiro" && <FinanceSection today={today} financeDateFrom={financeDateFrom} financeDateTo={financeDateTo} setFinanceDateFrom={setFinanceDateFrom} setFinanceDateTo={setFinanceDateTo} loadingFinanceiro={loadingFinanceiro} metricasFinanceiras={metricasFinanceiras} />}

        {view === "mais" && <MaisSection today={today} dataBloqueio={dataBloqueio} setDataBloqueio={setDataBloqueio} tipoNovoBloqueio={tipoNovoBloqueio} setTipoNovoBloqueio={setTipoNovoBloqueio} criarBloqueio={criarBloqueio} bloqueios={bloqueios} todosBloqueios={todosBloqueios} deletarBloqueio={deletarBloqueio} dataHorarios={dataHorarios} setDataHorarios={setDataHorarios} criarHorario={criarHorario} horarios={horarios} deletarHorario={deletarHorario} />}
        </div>

        <nav className="hidden fixed bottom-3 left-3 right-3 z-30 rounded-[26px] border border-white/10 bg-[rgba(10,10,10,0.96)] p-2 backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-5 gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id)
                  setErro(null)
                  setMensagem(null)
                }}
                className={`rounded-2xl px-2 py-3 text-[11px] transition ${view === item.id ? "bg-[var(--accent)] font-semibold text-black" : "bg-white/5 text-white/85"}`}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </main>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[var(--line)] bg-[rgba(18,18,18,0.92)] p-4 sm:p-6">
      <p className="mb-2 text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{subtitle}</p>
      <h2 className="mb-5 text-xl font-semibold sm:mb-6 sm:text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function MetricCard({ titulo, valor, accent, success }: { titulo: string; valor: string; accent?: boolean; success?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{titulo}</p>
      <p className={`mt-2 text-xl font-semibold ${success ? "text-emerald-300" : accent ? "text-[var(--accent-strong)]" : "text-white"}`}>{valor}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function ActionFooter({
  canConcluir,
  canNoShow,
  canCancelar,
  cancelLabel,
  whatsappHref,
  onConcluir,
  onNoShow,
  onCancelar,
  compact,
}: {
  canConcluir: boolean
  canNoShow: boolean
  canCancelar: boolean
  cancelLabel: string
  whatsappHref: string | null
  onConcluir: () => void
  onNoShow: () => void
  onCancelar: () => void
  compact?: boolean
}) {
  const gridClass = compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4"

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Acoes rapidas</p>
      <div className={`grid gap-2 ${gridClass}`}>
        <ActionFooterButton label="Concluir" variant="accent" disabled={!canConcluir} onClick={onConcluir} />
        <ActionFooterButton label="Faltou" variant="default" disabled={!canNoShow} onClick={onNoShow} />
        <ActionFooterButton label={cancelLabel} variant="danger" disabled={!canCancelar} onClick={onCancelar} />
        <ActionFooterButton label="WhatsApp" variant="whatsapp" href={whatsappHref} disabled={!whatsappHref} />
      </div>
    </div>
  )
}

function ActionFooterButton({
  label,
  variant,
  onClick,
  href,
  disabled,
}: {
  label: string
  variant: "default" | "accent" | "danger" | "whatsapp"
  onClick?: () => void
  href?: string | null
  disabled?: boolean
}) {
  const classes = [
    "min-h-12 rounded-2xl px-4 py-3 text-center text-sm transition",
    variant === "accent" ? "bg-[var(--accent)] text-black hover:brightness-105" : "",
    variant === "danger" ? "border border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20" : "",
    variant === "whatsapp" ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30" : "",
    variant === "default" ? "border border-white/10 bg-white/5 text-white hover:bg-white/10" : "",
    disabled ? "cursor-not-allowed opacity-35 hover:brightness-100 hover:bg-inherit" : "",
  ].join(" ").trim()

  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {label}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {label}
    </button>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-200">
      {label}
    </span>
  )
}

function ConfirmActionDialog({
  state,
  loading,
  onClose,
  onConfirm,
}: {
  state: ConfirmacaoOperacao
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const serviceLabel = state.item.servico_nome || "Servico nao informado"
  const cancelAction = state.acao === "remover_horario" ? "remover este horario manual" : state.acao === "marcar_falta" ? "marcar falta neste atendimento" : "cancelar este atendimento"
  const confirmLabel = state.acao === "remover_horario" ? "Remover" : state.acao === "marcar_falta" ? "Marcar falta" : "Cancelar"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <button type="button" aria-label="Fechar confirmacao" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[28px] border border-white/10 bg-[rgba(18,18,18,0.98)] p-5 shadow-2xl">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--accent-strong)]">Confirmacao rapida</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Deseja {cancelAction}?</h3>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
          <p className="text-white">{state.item.nome_cliente}</p>
          <p className="mt-1 text-[var(--muted)]">{serviceLabel}</p>
          <p className="mt-3 text-[var(--muted)]">
            {formatarDataBR(state.item.data)} as {formatarHora(state.item.hora_inicio)} - {formatarHora(state.item.hora_fim)}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50">
            Voltar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50">
            {loading ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, accent, success }: { label: string; value: string; accent?: boolean; success?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={success ? "text-emerald-300" : accent ? "text-[var(--accent-strong)]" : "text-white"}>{value}</span>
    </div>
  )
}

function InputMoney({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-[var(--muted)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
    </label>
  )
}

function QuickFilterButton({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl px-3 py-3 text-sm transition ${active ? "bg-[var(--accent)] font-semibold text-black" : "border border-white/10 bg-white/5 text-white/85 hover:bg-white/10"}`}>
      {label}
    </button>
  )
}

function SpotlightCard({ label, emptyLabel, item }: { label: string; emptyLabel: string; item: Agendamento | null }) {
  const whatsappHref = normalizePhoneLink(item?.celular_cliente)

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      {!item && <p className="text-white/80">{emptyLabel}</p>}
      {item && (
        <>
          <p className="text-2xl font-semibold">{formatarHora(item.hora_inicio)}</p>
          <p className="mt-2 text-white">{item.nome_cliente}</p>
          <p className="text-sm text-[var(--muted)]">{item.servico_nome || "Servico nao informado"}</p>
          {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200 hover:bg-emerald-500/30">Abrir WhatsApp</a>}
        </>
      )}
    </div>
  )
}

function CollapsibleCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            {subtitle && <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>}
          </div>
          <span className="text-xs text-[var(--muted)]">Abrir</span>
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

function MoreActionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
    </button>
  )
}

function ClienteCard({
  cliente,
}: {
  cliente: { celular: string; nome: string; total: number; receita: number; cancelados: number; ultData: string }
}) {
  const whatsappHref = normalizePhoneLink(cliente.celular)

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white">{cliente.nome}</p>
          <p className="text-sm text-[var(--muted)]">{cliente.celular || "Sem telefone"}</p>
        </div>
        <span className="text-sm text-[var(--muted)]">Ultima visita {formatarDataBR(cliente.ultData)}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <span className="text-[var(--muted)]">Visitas <strong className="text-white">{cliente.total}</strong></span>
        <span className="text-[var(--muted)]">Receita <strong className="text-[var(--accent-strong)]">{moeda(cliente.receita)}</strong></span>
        <span className="text-[var(--muted)]">Cancel. <strong className="text-white">{cliente.cancelados}</strong></span>
      </div>
      {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200 hover:bg-emerald-500/30">Conversar no WhatsApp</a>}
    </div>
  )
}

function AgendaSection({
  agendaMode,
  setAgendaMode,
  dataOperacao,
  setDataOperacao,
  today,
  semanaBase,
  setSemanaBase,
  loadingOperacao,
  loadingSemana,
  metricasDia,
  agendamentosDia,
  resumoSemana,
  totalSemana,
}: {
  agendaMode: AgendaMode
  setAgendaMode: (value: AgendaMode) => void
  dataOperacao: string
  setDataOperacao: (value: string) => void
  today: string
  semanaBase: string
  setSemanaBase: (value: string) => void
  loadingOperacao: boolean
  loadingSemana: boolean
  metricasDia: { agendados: number; personalizados: number; receitaPrevista: number; pendenciasPagamento: number }
  agendamentosDia: Agendamento[]
  resumoSemana: { data: string; ativos: Agendamento[]; receita: number; personalizados: number }[]
  totalSemana: { atendimentos: number; personalizados: number; receita: number }
}) {
  return (
    <section className="space-y-6">
      <Panel title="Agenda" subtitle="Visao ampla do dia e da semana">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid grid-cols-2 gap-2">
            <QuickFilterButton label="Dia" onClick={() => setAgendaMode("dia")} active={agendaMode === "dia"} />
            <QuickFilterButton label="Semana" onClick={() => setAgendaMode("semana")} active={agendaMode === "semana"} />
          </div>
          {agendaMode === "dia" ? (
            <div className="grid grid-cols-3 gap-2">
              <QuickFilterButton label="Hoje" onClick={() => setDataOperacao(today)} active={dataOperacao === today} />
              <QuickFilterButton label="Amanha" onClick={() => setDataOperacao(addDays(today, 1))} />
              <input type="date" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} className="datetime-input rounded-2xl border border-white/10 px-4 py-3" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <QuickFilterButton label="Atual" onClick={() => setSemanaBase(getStartOfWeek(today))} active={semanaBase === getStartOfWeek(today)} />
              <QuickFilterButton label="Anterior" onClick={() => setSemanaBase(addDays(semanaBase, -7))} />
              <QuickFilterButton label="Proxima" onClick={() => setSemanaBase(addDays(semanaBase, 7))} />
            </div>
          )}
        </div>
      </Panel>

      {agendaMode === "dia" && (
        <Panel title={`Dia ${formatarDataBR(dataOperacao)}`} subtitle="Leitura rapida para operacao mobile">
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard titulo="Atendimentos" valor={String(metricasDia.agendados)} />
            <MetricCard titulo="Manuais" valor={String(metricasDia.personalizados)} />
            <MetricCard titulo="Previsto" valor={moeda(metricasDia.receitaPrevista)} accent />
            <MetricCard titulo="Pagto pend." valor={String(metricasDia.pendenciasPagamento)} />
          </div>
          <div className="space-y-3">
            {loadingOperacao && <p className="text-[var(--muted)]">Carregando agenda...</p>}
            {!loadingOperacao && agendamentosDia.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</p>
                    <p className="text-sm text-[var(--muted)]">{item.nome_cliente}</p>
                  </div>
                  <Badge label={badgeLabel(item)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {agendaMode === "semana" && (
        <section className="space-y-6">
          <Panel title="Resumo semanal" subtitle={`${formatarDataBR(semanaBase)} ate ${formatarDataBR(addDays(semanaBase, 6))}`}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard titulo="Atendimentos" valor={String(totalSemana.atendimentos)} />
              <MetricCard titulo="Manuais" valor={String(totalSemana.personalizados)} />
              <MetricCard titulo="Receita prevista" valor={moeda(totalSemana.receita)} accent />
              <MetricCard titulo="Dias cheios" valor={String(resumoSemana.filter((dia) => dia.ativos.length >= 6).length)} />
            </div>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {loadingSemana && <p className="text-[var(--muted)]">Carregando semana...</p>}
            {!loadingSemana && resumoSemana.map((dia) => (
              <article key={dia.data} className="rounded-[28px] border border-white/10 bg-[rgba(18,18,18,0.92)] p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{formatWeekday(dia.data)}</p>
                    <h3 className="mt-2 text-xl font-semibold">{formatarDataBR(dia.data)}</h3>
                  </div>
                  <button type="button" onClick={() => { setDataOperacao(dia.data); setAgendaMode("dia") }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/5">
                    Ver dia
                  </button>
                </div>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Agenda" value={String(dia.ativos.filter((item) => item.origem !== "horario_customizado").length)} />
                  <MiniStat label="Manual" value={String(dia.personalizados)} />
                  <MiniStat label="Prev." value={moeda(dia.receita)} />
                </div>
                <div className="space-y-2">
                  {dia.ativos.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                      <p className="text-white">{formatarHora(item.hora_inicio)} - {item.nome_cliente}</p>
                      <p className="text-sm text-[var(--muted)]">{item.servico_nome || "Servico nao informado"}</p>
                    </div>
                  ))}
                  {dia.ativos.length === 0 && <p className="text-sm text-[var(--muted)]">Sem horarios cadastrados.</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}

function FinanceSection({
  today,
  financeDateFrom,
  financeDateTo,
  setFinanceDateFrom,
  setFinanceDateTo,
  loadingFinanceiro,
  metricasFinanceiras,
}: {
  today: string
  financeDateFrom: string
  financeDateTo: string
  setFinanceDateFrom: (value: string) => void
  setFinanceDateTo: (value: string) => void
  loadingFinanceiro: boolean
  metricasFinanceiras: {
    faturamentoPrevisto: number
    faturamentoRealizado: number
    ticketMedio: number
    realizados: number
    pagos: number
    cancelados: number
    noShow: number
    porServico: { nome: string; total: number; receita: number }[]
    porPagamento: { forma: string; total: number; receita: number }[]
  }
}) {
  const semanaInicio = addDays(today, -6)
  const mesInicio = addDays(today, -29)
  const isHoje = financeDateFrom === today && financeDateTo === today
  const isSemana = financeDateFrom === semanaInicio && financeDateTo === today
  const isMes = financeDateFrom === mesInicio && financeDateTo === today

  return (
    <Panel title="Financeiro" subtitle="Fechamento rapido do periodo selecionado">
      <div className="mb-3 flex flex-col gap-3 md:flex-row">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-[var(--muted)]">Data inicial</span>
          <input type="date" value={financeDateFrom} onChange={(e) => setFinanceDateFrom(e.target.value)} className="datetime-input w-full rounded-xl border border-white/10 px-4 py-2" />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-[var(--muted)]">Data final</span>
          <input type="date" value={financeDateTo} onChange={(e) => setFinanceDateTo(e.target.value)} className="datetime-input w-full rounded-xl border border-white/10 px-4 py-2" />
        </label>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-2">
        <QuickFilterButton label="Hoje" onClick={() => { setFinanceDateFrom(today); setFinanceDateTo(today) }} active={isHoje} />
        <QuickFilterButton label="Semana" onClick={() => { setFinanceDateFrom(semanaInicio); setFinanceDateTo(today) }} active={isSemana} />
        <QuickFilterButton label="Mes" onClick={() => { setFinanceDateFrom(mesInicio); setFinanceDateTo(today) }} active={isMes} />
      </div>
      <div className="mb-6 grid gap-3 md:grid-cols-6">
        <MetricCard titulo="Previsto" valor={moeda(metricasFinanceiras.faturamentoPrevisto)} accent />
        <MetricCard titulo="Realizado" valor={moeda(metricasFinanceiras.faturamentoRealizado)} success />
        <MetricCard titulo="Ticket medio" valor={moeda(metricasFinanceiras.ticketMedio)} />
        <MetricCard titulo="Concluidos" valor={String(metricasFinanceiras.realizados)} />
        <MetricCard titulo="Pagos" valor={String(metricasFinanceiras.pagos)} />
        <MetricCard titulo="Cancel./No-show" valor={`${metricasFinanceiras.cancelados}/${metricasFinanceiras.noShow}`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="mb-4 text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Performance por servico</p>
          <div className="space-y-3">
            {loadingFinanceiro && <p className="text-[var(--muted)]">Carregando periodo...</p>}
            {metricasFinanceiras.porServico.map((item) => (
              <div key={item.nome} className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <div>
                  <p className="text-white">{item.nome}</p>
                  <p className="text-sm text-[var(--muted)]">{item.total} atendimento(s)</p>
                </div>
                <span className="text-[var(--accent-strong)]">{moeda(item.receita)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="mb-4 text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Recebimento por forma de pagamento</p>
          <div className="space-y-3">
            {loadingFinanceiro && <p className="text-[var(--muted)]">Carregando periodo...</p>}
            {metricasFinanceiras.porPagamento.length === 0 && <p className="text-[var(--muted)]">Nenhum pagamento baixado no periodo.</p>}
            {metricasFinanceiras.porPagamento.map((item) => (
              <div key={item.forma} className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                <div>
                  <p className="text-white capitalize">{item.forma}</p>
                  <p className="text-sm text-[var(--muted)]">{item.total} pagamento(s)</p>
                </div>
                <span className="text-emerald-300">{moeda(item.receita)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function MobileMenuSheet({
  current,
  onClose,
  onSelect,
}: {
  current: MobileSection
  onClose: () => void
  onSelect: (section: MobileSection) => void
}) {
  const items: { id: MobileSection; label: string; description: string }[] = [
    { id: "cronograma", label: "Cronograma", description: "Voltar para agenda principal." },
    { id: "financeiro", label: "Financeiro", description: "Ver balanco do dia, semana ou mes." },
    { id: "bloqueios", label: "Bloqueios", description: "Bloquear horarios ou dias." },
    { id: "horarios", label: "Marcar horarios", description: "Criar horarios personalizados." },
    { id: "clientes", label: "Clientes", description: "Ver clientes cadastrados." },
  ]

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm">
      <button type="button" aria-label="Fechar menu" className="absolute inset-0" onClick={onClose} />
      <div className="absolute inset-x-3 top-20 rounded-[28px] border border-white/10 bg-[rgba(18,18,18,0.98)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Menu do barbeiro</h3>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm">Fechar</button>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left ${current === item.id ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-white/10 bg-white/5"}`}
            >
              <p className="font-medium text-white">{item.label}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MobileScheduleSection({
  agendaMode,
  setAgendaMode,
  dataOperacao,
  setDataOperacao,
  today,
  semanaBase,
  setSemanaBase,
  slots,
  operacaoDoDia,
  resumoSemana,
  expandedId,
  setExpandedId,
  loadingOperacao,
  loadingSemana,
  canConcludeNow,
  canNoShowNow,
  onCancelar,
  onConcluir,
  onNoShow,
}: {
  agendaMode: AgendaMode
  setAgendaMode: (value: AgendaMode) => void
  dataOperacao: string
  setDataOperacao: (value: string) => void
  today: string
  semanaBase: string
  setSemanaBase: (value: string) => void
  slots: string[]
  operacaoDoDia: Agendamento[]
  resumoSemana: { data: string; ativos: Agendamento[]; receita: number; personalizados: number }[]
  expandedId: string | null
  setExpandedId: (value: string | null) => void
  loadingOperacao: boolean
  loadingSemana: boolean
  canConcludeNow: (item: Agendamento) => boolean
  canNoShowNow: (item: Agendamento) => boolean
  onCancelar: (item: Agendamento) => void
  onConcluir: (item: Agendamento) => void
  onNoShow: (item: Agendamento) => void
}) {
  const timelineSlots = Array.from(
    new Set([
      ...slots,
      ...operacaoDoDia
        .filter((agendamento) => agendamento.status_agendamento !== "cancelado" && agendamento.status !== "cancelado")
        .map((agendamento) => formatarHora(agendamento.hora_inicio)),
    ])
  ).sort((a, b) => timeToMinutes(a) - timeToMinutes(b))

  const timeline = timelineSlots.map((slot) => {
    const item = operacaoDoDia.find((agendamento) => {
      const inicio = timeToMinutes(agendamento.hora_inicio)
      const fim = timeToMinutes(agendamento.hora_fim)
      const current = timeToMinutes(slot)
      return current >= inicio && current < fim && agendamento.status_agendamento !== "cancelado" && agendamento.status !== "cancelado"
    })

    if (!item) {
      return { slot, item: null, isStart: false, isContinuation: false }
    }

    const current = timeToMinutes(slot)
    const start = timeToMinutes(item.hora_inicio)

    return {
      slot,
      item,
      isStart: current === start,
      isContinuation: current > start,
    }
  })

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-white/10 bg-[rgba(18,18,18,0.92)] p-4">
        <div className="grid grid-cols-2 gap-2">
          <QuickFilterButton label="Dia" onClick={() => setAgendaMode("dia")} active={agendaMode === "dia"} />
          <QuickFilterButton label="Semana" onClick={() => setAgendaMode("semana")} active={agendaMode === "semana"} />
        </div>
        {agendaMode === "dia" ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <QuickFilterButton label="Hoje" onClick={() => setDataOperacao(today)} active={dataOperacao === today} />
              <QuickFilterButton label="Amanha" onClick={() => setDataOperacao(addDays(today, 1))} />
            </div>
            <input type="date" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} className="datetime-input w-full min-w-0 rounded-2xl border border-white/10 px-3 py-3" />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <QuickFilterButton label="Atual" onClick={() => setSemanaBase(getStartOfWeek(today))} active={semanaBase === getStartOfWeek(today)} />
            <QuickFilterButton label="Anterior" onClick={() => setSemanaBase(addDays(semanaBase, -7))} />
            <QuickFilterButton label="Proxima" onClick={() => setSemanaBase(addDays(semanaBase, 7))} />
          </div>
        )}
      </div>

      {agendaMode === "dia" && (
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(18,18,18,0.92)]">
          <div className="grid grid-cols-[68px_1fr] border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>Hora</span>
            <span>Agenda</span>
          </div>
          {loadingOperacao && <p className="px-4 py-6 text-[var(--muted)]">Carregando cronograma...</p>}
          {!loadingOperacao && (
            <div className="relative">
              <div className="absolute bottom-0 left-[4.25rem] top-0 w-px bg-white/8" />
              {timeline.map(({ slot, item, isStart, isContinuation }, index) => {
            const rowId = item ? `${item.id}-${slot}` : `empty-${dataOperacao}-${slot}`
            const expanded = expandedId === rowId
            return (
              <div key={rowId} className={`border-b border-white/8 px-4 py-2.5 ${index % 2 === 0 ? "bg-white/[0.015]" : ""}`}>
                <button type="button" onClick={() => setExpandedId(item && isStart ? (expanded ? null : rowId) : null)} className="grid w-full grid-cols-[68px_1fr] items-start gap-3 text-left">
                  <span className="pt-2 text-xs font-semibold tracking-[0.08em] text-[var(--accent-strong)]">{slot}</span>
                  <div className="relative pb-1">
                    {!item && (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3">
                        <p className="text-sm text-[var(--muted)]">Horario livre</p>
                      </div>
                    )}
                    {item && isStart && (
                      <div className={`rounded-2xl border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition ${
                        expanded ? "border-[var(--accent)] bg-[rgba(197,154,92,0.14)]" : "border-white/10 bg-black/30"
                      }`}>
                        <p className="text-sm font-medium text-white">{item.servico_nome || "Servico nao informado"}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.nome_cliente}</p>
                      </div>
                    )}
                    {item && isContinuation && (
                      <div className="flex min-h-12 items-center px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Em andamento ate {formatarHora(item.hora_fim)}</p>
                      </div>
                    )}
                  </div>
                </button>
                {item && isStart && expanded && (
                  <div className="mt-2 ml-[5rem] rounded-2xl border border-white/10 bg-black/35 p-3">
                    <div className="space-y-2 text-sm">
                      <InfoRow label="Horario" value={`${formatarHora(item.hora_inicio)} - ${formatarHora(item.hora_fim)}`} />
                      <InfoRow label="Preco" value={moeda(Number(item.valor_final ?? item.servico_preco ?? 0))} />
                      <InfoRow label="Status" value={badgeLabel(item)} />
                    </div>
                    <ActionFooter
                      canConcluir={canConcludeNow(item)}
                      canNoShow={canNoShowNow(item)}
                      canCancelar={canCancel(item)}
                      cancelLabel={item.origem === "horario_customizado" ? "Remover" : "Cancelar"}
                      whatsappHref={normalizePhoneLink(item.celular_cliente)}
                      onConcluir={() => onConcluir(item)}
                      onNoShow={() => onNoShow(item)}
                      onCancelar={() => onCancelar(item)}
                      compact
                    />
                  </div>
                )}
              </div>
            )
          })}
            </div>
          )}
        </div>
      )}

      {agendaMode === "semana" && (
        <div className="space-y-4">
          {loadingSemana && <p className="text-[var(--muted)]">Carregando semana...</p>}
          {!loadingSemana && resumoSemana.map((dia) => (
            <div key={dia.data} className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(18,18,18,0.92)]">
              <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{formatWeekday(dia.data)}</p>
                <h3 className="mt-1 text-lg font-semibold">{formatarDataBR(dia.data)}</h3>
              </div>
              <div className="px-4 py-3">
                {dia.ativos.length === 0 && <p className="text-sm text-[var(--muted)]">Sem horarios marcados.</p>}
                <div className="space-y-3">
                  {dia.ativos.map((item) => {
                    const rowId = `week-${dia.data}-${item.id}`
                    const expanded = expandedId === rowId
                    return (
                      <div key={rowId} className="rounded-2xl border border-white/10 bg-black/20">
                        <button type="button" onClick={() => setExpandedId(expanded ? null : rowId)} className="grid w-full grid-cols-[60px_1fr] gap-3 px-3 py-3 text-left">
                          <span className="pt-1 text-xs font-semibold tracking-[0.08em] text-[var(--accent-strong)]">{formatarHora(item.hora_inicio)}</span>
                          <div>
                            <p className="text-sm font-medium text-white">{item.servico_nome || "Servico nao informado"}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">{item.nome_cliente}</p>
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-white/10 px-3 py-3">
                            <div className="space-y-2 text-sm">
                              <InfoRow label="Horario" value={`${formatarHora(item.hora_inicio)} - ${formatarHora(item.hora_fim)}`} />
                              <InfoRow label="Preco" value={moeda(Number(item.valor_final ?? item.servico_preco ?? 0))} />
                              <InfoRow label="Status" value={badgeLabel(item)} />
                            </div>
                            <ActionFooter
                              canConcluir={canConcludeNow(item)}
                              canNoShow={canNoShowNow(item)}
                              canCancelar={canCancel(item)}
                              cancelLabel={item.origem === "horario_customizado" ? "Remover" : "Cancelar"}
                              whatsappHref={normalizePhoneLink(item.celular_cliente)}
                              onConcluir={() => onConcluir(item)}
                              onNoShow={() => onNoShow(item)}
                              onCancelar={() => onCancelar(item)}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BloqueiosPanel({
  dataBloqueio,
  setDataBloqueio,
  tipoNovoBloqueio,
  setTipoNovoBloqueio,
  criarBloqueio,
  bloqueios,
  todosBloqueios,
  deletarBloqueio,
}: {
  dataBloqueio: string
  setDataBloqueio: (value: string) => void
  tipoNovoBloqueio: Bloqueio["tipo_bloqueio"]
  setTipoNovoBloqueio: (value: Bloqueio["tipo_bloqueio"]) => void
  criarBloqueio: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  bloqueios: Bloqueio[]
  todosBloqueios: Bloqueio[]
  deletarBloqueio: (id: string) => Promise<void>
}) {
  return (
    <Panel title="Bloqueios" subtitle="Bloqueie horarios ou dias inteiros">
      <form onSubmit={criarBloqueio} className="grid gap-4">
        <input name="data" type="date" value={dataBloqueio} onChange={(e) => setDataBloqueio(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
        <div className="grid gap-2">
          {(["horario", "dia_inteiro", "nao_aceitar_mais"] as Bloqueio["tipo_bloqueio"][]).map((tipo) => (
            <label key={tipo} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <input type="radio" checked={tipoNovoBloqueio === tipo} onChange={() => setTipoNovoBloqueio(tipo)} />
              <span>{tipo === "horario" ? "Bloquear horario especifico" : tipo === "dia_inteiro" ? "Bloquear dia inteiro" : "Nao aceitar mais horarios"}</span>
            </label>
          ))}
        </div>
        {tipoNovoBloqueio === "horario" && (
          <div className="grid grid-cols-2 gap-3">
            <input name="hora_inicio" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
            <input name="hora_fim" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
          </div>
        )}
        <input name="motivo" type="text" placeholder="Motivo do bloqueio" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-black">Criar bloqueio</button>
      </form>
      <div className="mt-6 space-y-4">
        {[...bloqueios, ...todosBloqueios.filter((item) => item.data !== dataBloqueio)].map((bloqueio) => (
          <div key={bloqueio.id} className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
            <div>
              <p className="text-white">{formatarDataBR(bloqueio.data)}</p>
              <p className="text-sm text-[var(--muted)]">
                {bloqueio.tipo_bloqueio === "horario"
                  ? `${formatarHora(bloqueio.hora_inicio || "00:00")} - ${formatarHora(bloqueio.hora_fim || "23:59")}`
                  : bloqueio.tipo_bloqueio === "dia_inteiro"
                    ? "Dia inteiro"
                    : "Nao aceitar mais horarios"}
              </p>
            </div>
            <button onClick={() => deletarBloqueio(bloqueio.id)} className="text-sm text-red-300">Remover</button>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function HorariosPanel({
  dataHorarios,
  setDataHorarios,
  criarHorario,
  horarios,
  deletarHorario,
}: {
  dataHorarios: string
  setDataHorarios: (value: string) => void
  criarHorario: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  horarios: HorarioCustomizado[]
  deletarHorario: (id: string) => Promise<void>
}) {
  return (
    <Panel title="Marcar horarios" subtitle="Crie horarios personalizados">
      <form onSubmit={criarHorario} className="grid gap-4">
        <input name="data-horario" type="date" value={dataHorarios} onChange={(e) => setDataHorarios(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
        <input name="nome_cliente" type="text" placeholder="Nome do cliente" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
        <input name="celular_cliente" type="text" placeholder="Celular do cliente" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
        <div className="grid grid-cols-2 gap-3">
          <input name="hora_inicio" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
          <input name="hora_fim" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
        </div>
        <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-black">Salvar horario</button>
      </form>
      <div className="mt-6 space-y-4">
        {horarios.length === 0 && <p className="text-[var(--muted)]">Nenhum horario personalizado cadastrado.</p>}
        {horarios.map((horario) => (
          <div key={horario.id} className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
            <div>
              <p className="text-white">{formatarHora(horario.hora_inicio)} - {formatarHora(horario.hora_fim)}</p>
              <p className="text-sm text-zinc-300">{horario.nome_cliente || "Sem nome"}</p>
            </div>
            <button onClick={() => deletarHorario(horario.id)} className="text-sm text-red-300">Remover</button>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function MaisSection({
  today,
  dataBloqueio,
  setDataBloqueio,
  tipoNovoBloqueio,
  setTipoNovoBloqueio,
  criarBloqueio,
  bloqueios,
  todosBloqueios,
  deletarBloqueio,
  dataHorarios,
  setDataHorarios,
  criarHorario,
  horarios,
  deletarHorario,
}: {
  today: string
  dataBloqueio: string
  setDataBloqueio: (value: string) => void
  tipoNovoBloqueio: Bloqueio["tipo_bloqueio"]
  setTipoNovoBloqueio: (value: Bloqueio["tipo_bloqueio"]) => void
  criarBloqueio: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  bloqueios: Bloqueio[]
  todosBloqueios: Bloqueio[]
  deletarBloqueio: (id: string) => Promise<void>
  dataHorarios: string
  setDataHorarios: (value: string) => void
  criarHorario: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  horarios: HorarioCustomizado[]
  deletarHorario: (id: string) => Promise<void>
}) {
  return (
    <section className="space-y-6">
      <Panel title="Mais funcoes" subtitle="Acoes administrativas menos frequentes">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MoreActionCard title="Bloquear horario" description="Impede novos agendamentos em um intervalo." onClick={() => { setDataBloqueio(today); setTipoNovoBloqueio("horario") }} />
          <MoreActionCard title="Bloquear dia" description="Fecha a agenda inteira para um dia." onClick={() => { setDataBloqueio(today); setTipoNovoBloqueio("dia_inteiro") }} />
          <MoreActionCard title="Nao aceitar mais" description="Trava o restante do dia sem cancelar o que ja existe." onClick={() => { setDataBloqueio(today); setTipoNovoBloqueio("nao_aceitar_mais") }} />
          <MoreActionCard title="Horario manual" description="Cadastra um compromisso fora do fluxo do site." onClick={() => setDataHorarios(today)} />
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Bloqueios" subtitle="Controle de disponibilidade do barbeiro">
          <form onSubmit={criarBloqueio} className="grid gap-4">
            <input name="data" type="date" value={dataBloqueio} onChange={(e) => setDataBloqueio(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
            <div className="grid gap-2">
              {(["horario", "dia_inteiro", "nao_aceitar_mais"] as Bloqueio["tipo_bloqueio"][]).map((tipo) => (
                <label key={tipo} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <input type="radio" checked={tipoNovoBloqueio === tipo} onChange={() => setTipoNovoBloqueio(tipo)} />
                  <span>{tipo === "horario" ? "Bloquear horario especifico" : tipo === "dia_inteiro" ? "Bloquear dia inteiro" : "Nao aceitar mais horarios"}</span>
                </label>
              ))}
            </div>
            {tipoNovoBloqueio === "horario" && (
              <div className="grid grid-cols-2 gap-3">
                <input name="hora_inicio" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                <input name="hora_fim" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
              </div>
            )}
            <input name="motivo" type="text" placeholder="Motivo do bloqueio" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
            <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-black">Criar bloqueio</button>
          </form>

          <div className="mt-6 space-y-4">
            {[...bloqueios, ...todosBloqueios.filter((item) => item.data !== dataBloqueio)].map((bloqueio) => (
              <div key={bloqueio.id} className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div>
                  <p className="text-white">{formatarDataBR(bloqueio.data)}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {bloqueio.tipo_bloqueio === "horario"
                      ? `${formatarHora(bloqueio.hora_inicio || "00:00")} - ${formatarHora(bloqueio.hora_fim || "23:59")}`
                      : bloqueio.tipo_bloqueio === "dia_inteiro"
                        ? "Dia inteiro"
                        : "Nao aceitar mais horarios"}
                  </p>
                  {bloqueio.motivo && <p className="mt-1 text-sm text-zinc-300">{bloqueio.motivo}</p>}
                </div>
                <button onClick={() => deletarBloqueio(bloqueio.id)} className="text-sm text-red-300">Remover</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Horario manual" subtitle="Cadastro rapido fora do fluxo do site">
          <form onSubmit={criarHorario} className="grid gap-4">
            <p className="text-sm text-[var(--muted)]">Pode ser cadastrado em qualquer hora, mesmo fora do expediente. O sistema so bloqueia conflito com outro atendimento existente.</p>
            <input name="data-horario" type="date" value={dataHorarios} onChange={(e) => setDataHorarios(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
            <input name="nome_cliente" type="text" placeholder="Nome do cliente" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
            <input name="celular_cliente" type="text" placeholder="Celular do cliente" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <input name="hora_inicio" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
              <input name="hora_fim" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
            </div>
            <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-black">Salvar horario</button>
          </form>

          <div className="mt-6 space-y-4">
            {horarios.length === 0 && <p className="text-[var(--muted)]">Nenhum horario personalizado cadastrado.</p>}
            {horarios.map((horario) => (
              <div key={horario.id} className="flex justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div>
                  <p className="text-white">{formatarHora(horario.hora_inicio)} - {formatarHora(horario.hora_fim)}</p>
                  <p className="text-sm text-zinc-300">{horario.nome_cliente || "Sem nome"}</p>
                  {horario.celular_cliente && <p className="text-sm text-[var(--muted)]">{horario.celular_cliente}</p>}
                </div>
                <button onClick={() => deletarHorario(horario.id)} className="text-sm text-red-300">Remover</button>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </section>
  )
}
