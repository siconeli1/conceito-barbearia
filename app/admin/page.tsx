"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatarHora, getTodayInputValue } from "@/lib/format"

type StatusAgendamento = "agendado" | "confirmado" | "cancelado" | "no_show"
type StatusAtendimento = "pendente" | "em_atendimento" | "concluido"
type StatusPagamento = "pendente" | "pago" | "estornado"
type View = "operacao" | "financeiro" | "clientes" | "bloqueios" | "horarios"

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

export default function AdminPage() {
  const today = getTodayInputValue()
  const [view, setView] = useState<View>("operacao")
  const [dataOperacao, setDataOperacao] = useState(today)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [agendamentosDia, setAgendamentosDia] = useState<Agendamento[]>([])
  const [agendamentosPeriodo, setAgendamentosPeriodo] = useState<Agendamento[]>([])
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [todosBloqueios, setTodosBloqueios] = useState<Bloqueio[]>([])
  const [horarios, setHorarios] = useState<HorarioCustomizado[]>([])
  const [dataBloqueio, setDataBloqueio] = useState(today)
  const [dataHorarios, setDataHorarios] = useState(today)
  const [tipoNovoBloqueio, setTipoNovoBloqueio] = useState<Bloqueio["tipo_bloqueio"]>("horario")
  const [loadingOperacao, setLoadingOperacao] = useState(true)
  const [loadingPeriodo, setLoadingPeriodo] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftFinanceiro>>({})
  const operacaoRequestRef = useRef(0)
  const periodoRequestRef = useRef(0)
  const operacaoAbortRef = useRef<AbortController | null>(null)
  const periodoAbortRef = useRef<AbortController | null>(null)

  const carregarOperacao = useCallback(async (data: string) => {
    const requestId = ++operacaoRequestRef.current
    operacaoAbortRef.current?.abort()
    const controller = new AbortController()
    operacaoAbortRef.current = controller
    setLoadingOperacao(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin-agenda?data=${encodeURIComponent(data)}`, {
        signal: controller.signal,
      })
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

  const carregarPeriodo = useCallback(async (from: string, to: string) => {
    const requestId = ++periodoRequestRef.current
    periodoAbortRef.current?.abort()
    const controller = new AbortController()
    periodoAbortRef.current = controller
    setLoadingPeriodo(true)
    try {
      const res = await fetch(
        `/api/admin-agenda?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,
        { signal: controller.signal }
      )
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao carregar periodo."))
      if (requestId !== periodoRequestRef.current || controller.signal.aborted) return
      setAgendamentosPeriodo(Array.isArray(json) ? (json as Agendamento[]) : [])
    } catch (error) {
      if (requestId !== periodoRequestRef.current || controller.signal.aborted) return
      setErro(error instanceof Error ? error.message : "Erro ao carregar periodo.")
      setAgendamentosPeriodo([])
    } finally {
      if (requestId === periodoRequestRef.current && !controller.signal.aborted) {
        setLoadingPeriodo(false)
      }
    }
  }, [])

  const carregarBloqueios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/bloqueios?data=${data}`)
      const json = await lerRespostaJson(res)
      if (!res.ok) throw new Error(String((json as Record<string, unknown>).erro || "Erro ao carregar bloqueios."))
      setBloqueios((((json as Record<string, unknown>).bloqueios as Bloqueio[]) || []))
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
      setHorarios((((json as Record<string, unknown>).horarios as HorarioCustomizado[]) || []))
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar horarios.")
      setHorarios([])
    }
  }, [])

  useEffect(() => {
    carregarOperacao(dataOperacao)
  }, [carregarOperacao, dataOperacao])

  useEffect(() => {
    carregarPeriodo(dateFrom, dateTo)
  }, [carregarPeriodo, dateFrom, dateTo])

  useEffect(() => {
    return () => {
      operacaoAbortRef.current?.abort()
      periodoAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (view === "bloqueios") {
      carregarBloqueios(dataBloqueio)
      carregarTodosBloqueios()
    }
  }, [view, dataBloqueio, carregarBloqueios, carregarTodosBloqueios])

  useEffect(() => {
    if (view === "horarios") {
      carregarHorarios(dataHorarios)
    }
  }, [view, dataHorarios, carregarHorarios])

  useEffect(() => {
    if (!mensagem) return
    const timer = setTimeout(() => setMensagem(null), 4000)
    return () => clearTimeout(timer)
  }, [mensagem])

  const agendamentosFiltradosDia = agendamentosDia

  const metricasDia = useMemo(() => {
    const reais = agendamentosFiltradosDia.filter((item) => item.origem !== "horario_customizado")
    const receitaPrevista = reais
      .filter((item) => item.status_agendamento !== "cancelado")
      .reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)
    const realizados = reais.filter((item) => item.status_atendimento === "concluido" && item.status_pagamento === "pago")
    const receitaRealizada = realizados.reduce((acc, item) => acc + Number(item.valor_final ?? item.servico_preco ?? 0), 0)

    return {
      agendados: reais.length,
      personalizados: agendamentosFiltradosDia.filter((item) => item.origem === "horario_customizado").length,
      receitaPrevista,
      receitaRealizada,
      ticketMedio: realizados.length ? receitaRealizada / realizados.length : 0,
      pendenciasPagamento: reais.filter((item) => item.status_atendimento === "concluido" && item.status_pagamento !== "pago").length,
    }
  }, [agendamentosFiltradosDia])

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
    const reais = agendamentosPeriodo.filter((item) => item.origem !== "horario_customizado")
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
        if (!acc[nome]) {
          acc[nome] = { nome, total: 0, receita: 0 }
        }
        acc[nome].total += 1
        acc[nome].receita += Number(item.valor_final ?? item.servico_preco ?? 0)
        return acc
      }, {})
    ).sort((a, b) => b.receita - a.receita)

    const porPagamento = Object.values(
      pagos.reduce<Record<string, { forma: string; total: number; receita: number }>>((acc, item) => {
        const forma = item.forma_pagamento || "Nao informado"
        if (!acc[forma]) {
          acc[forma] = { forma, total: 0, receita: 0 }
        }
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
  }, [agendamentosPeriodo])

  const metricasClientes = useMemo(() => {
    const reais = agendamentosPeriodo.filter((item) => item.origem !== "horario_customizado")
    return Object.values(
      reais.reduce<Record<string, {
        celular: string
        nome: string
        total: number
        receita: number
        cancelados: number
        ultData: string
      }>>((acc, item) => {
        const key = item.celular_cliente || item.id
        if (!acc[key]) {
          acc[key] = {
            celular: item.celular_cliente,
            nome: item.nome_cliente,
            total: 0,
            receita: 0,
            cancelados: 0,
            ultData: item.data,
          }
        }
        acc[key].total += 1
        acc[key].receita += Number(item.valor_final ?? item.servico_preco ?? 0)
        if (item.status_agendamento === "cancelado") {
          acc[key].cancelados += 1
        }
        if (item.data > acc[key].ultData) {
          acc[key].ultData = item.data
          acc[key].nome = item.nome_cliente
        }
        return acc
      }, {})
    ).sort((a, b) => b.receita - a.receita)
  }, [agendamentosPeriodo])

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
      await Promise.all([carregarOperacao(dataOperacao), carregarPeriodo(dateFrom, dateTo)])
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao atualizar agendamento.")
    }
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
      await carregarBloqueios(data)
      await carregarTodosBloqueios()
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
      await carregarBloqueios(dataBloqueio)
      await carregarTodosBloqueios()
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
      await Promise.all([carregarHorarios(dataHorarios), carregarOperacao(dataOperacao)])
      ;(e.currentTarget as HTMLFormElement).reset()
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao criar horario.")
    }
  }

  async function deletarHorario(id: string) {
    if (!confirm("Remover este horario personalizado?")) return
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
      await Promise.all([carregarHorarios(dataHorarios), carregarOperacao(dataOperacao)])
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao remover horario.")
    }
  }

  const operacaoDoDia = agendamentosFiltradosDia
  const operacaoAtiva = operacaoDoDia.filter(
    (item) => item.status_agendamento !== "cancelado" && item.status !== "cancelado"
  )
  const operacaoCancelada = operacaoDoDia.filter(
    (item) => item.status_agendamento === "cancelado" || item.status === "cancelado"
  )
  const minutosAtuais = getCurrentMinutesInSaoPaulo()
  const proximosHorarios = operacaoAtiva
    .filter((item) => dataOperacao !== today || timeToMinutes(item.hora_inicio) > minutosAtuais)
    .slice()
    .sort((a, b) => `${a.data}T${a.hora_inicio}`.localeCompare(`${b.data}T${b.hora_inicio}`))
    .slice(0, 5)

  return (
    <main className="min-h-screen text-white p-5 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border border-[var(--line)] bg-black/30 backdrop-blur-sm rounded-[28px] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[var(--accent-strong)] mb-3">Conceito Barbearia</p>
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">Centro de operacao do barbeiro</h1>
              <p className="text-[var(--muted)] mt-3 max-w-2xl">
                Agenda, financeiro, clientes e bloqueios em uma unica tela, com status operacionais e fechamento por periodo.
              </p>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" })
                window.location.href = "/admin/login"
              }}
              className="px-4 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 h-fit"
            >
              Sair
            </button>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto mb-6">
          {([
            { id: "operacao", label: "Operacao" },
            { id: "financeiro", label: "Financeiro" },
            { id: "clientes", label: "Clientes" },
            { id: "bloqueios", label: "Bloqueios" },
            { id: "horarios", label: "Horarios" },
          ] as { id: View; label: string }[]).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id)
                setErro(null)
                setMensagem(null)
              }}
              className={`rounded-full px-4 py-2 text-sm whitespace-nowrap transition ${
                view === item.id
                  ? "bg-[var(--accent)] text-black"
                  : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {erro && <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">{erro}</div>}
        {mensagem && <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-200">{mensagem}</div>}

        {view === "operacao" && (
          <section className="space-y-6">
            <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
              <div className="rounded-[28px] border border-[var(--line)] bg-[rgba(18,18,18,0.92)] p-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)] mb-2">Operacao do dia</p>
                    <h2 className="text-2xl font-semibold">Linha do tempo da agenda</h2>
                  </div>
                  <div className="flex gap-3">
                    <input type="date" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} className="datetime-input text-white px-4 py-2 rounded-xl border border-white/10" />
                    <div className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[var(--muted)]">
                      {servicosDoDia.length} servico(s) no dia
                    </div>
                  </div>
                </div>

                {servicosDoDia.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {servicosDoDia.map((servico) => (
                      <span key={servico} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
                        {servico}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-5 gap-3 mb-6">
                  <MetricCard titulo="Agendamentos" valor={String(metricasDia.agendados)} />
                  <MetricCard titulo="Manuais" valor={String(metricasDia.personalizados)} />
                  <MetricCard titulo="Previsto" valor={moeda(metricasDia.receitaPrevista)} accent />
                  <MetricCard titulo="Realizado" valor={moeda(metricasDia.receitaRealizada)} success />
                  <MetricCard titulo="Pendencias" valor={String(metricasDia.pendenciasPagamento)} />
                </div>

                <div className="space-y-6">
                  {loadingOperacao && <p className="text-[var(--muted)]">Carregando...</p>}
                  {!loadingOperacao && operacaoDoDia.length === 0 && <p className="text-[var(--muted)]">Nenhum item para {formatarDataBR(dataOperacao)}.</p>}

                  {!loadingOperacao && operacaoAtiva.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Agenda ativa</h3>
                        <span className="text-sm text-zinc-300">{operacaoAtiva.length} item(ns)</span>
                      </div>
                      {operacaoAtiva.map((item) => {
                        const draft = getDraft(item)
                        return (
                          <article key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <div className="flex flex-col 2xl:flex-row gap-4 2xl:items-start 2xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <p className="text-lg font-semibold">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</p>
                                  <Badge label={badgeLabel(item)} />
                                </div>
                                <p className="text-white">{item.nome_cliente}</p>
                                <p className="text-sm text-[var(--muted)]">{item.celular_cliente || "Sem telefone"}</p>
                                <p className="text-sm mt-2 text-zinc-200">{item.servico_nome || "Servico nao informado"}</p>
                                <div className="flex flex-wrap gap-4 text-sm mt-3">
                                  <span className="text-[var(--accent-strong)]">Previsto: {moeda(Number(item.valor_final ?? item.servico_preco ?? 0))}</span>
                                  {item.origem !== "horario_customizado" && (
                                    <span className="text-[var(--muted)]">Status: {badgeLabel(item)}</span>
                                  )}
                                </div>
                              </div>

                              <div className="grid md:grid-cols-[200px_1fr] gap-4 w-full 2xl:w-[52%]">
                                <div className="flex flex-col gap-2">
                                  {item.celular_cliente ? (
                                    <a href={`https://wa.me/55${item.celular_cliente.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-500/20 text-emerald-200 px-4 py-2 text-sm text-center hover:bg-emerald-500/30">
                                      WhatsApp
                                    </a>
                                  ) : null}

                                  {canConclude(item) && (
                                    <QuickAction label="Concluir atendimento" onClick={() => atualizarAgendamento(item.id, { status_atendimento: "concluido", status_pagamento: "pago" })} />
                                  )}

                                  {canNoShow(item) && (
                                    <QuickAction label="Cliente faltou" onClick={() => atualizarAgendamento(item.id, { status_agendamento: "no_show" })} />
                                  )}

                                  {canCancel(item) && (
                                    <QuickAction danger label={item.origem === "horario_customizado" ? "Remover horario" : "Cancelar"} onClick={() => item.origem === "horario_customizado" ? deletarHorario(item.id) : atualizarAgendamento(item.id, { status_agendamento: "cancelado" })} />
                                  )}
                                </div>

                                {item.origem !== "horario_customizado" && (
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)] mb-3">Ajuste financeiro rapido</p>
                                    <div className="grid sm:grid-cols-3 gap-3 mb-3">
                                      <InputMoney label="Desconto" value={draft.desconto} onChange={(value) => setDraft(item.id, { desconto: value })} />
                                      <InputMoney label="Acrescimo" value={draft.acrescimo} onChange={(value) => setDraft(item.id, { acrescimo: value })} />
                                      <InputMoney label="Valor final" value={draft.valor_final} onChange={(value) => setDraft(item.id, { valor_final: value })} />
                                    </div>
                                    <div className="grid sm:grid-cols-[220px_1fr] gap-3">
                                      <select value={draft.forma_pagamento} onChange={(e) => setDraft(item.id, { forma_pagamento: e.target.value })} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2">
                                        <option value="">Forma de pagamento</option>
                                        <option value="pix">Pix</option>
                                        <option value="dinheiro">Dinheiro</option>
                                        <option value="credito">Credito</option>
                                        <option value="debito">Debito</option>
                                      </select>
                                      <input value={draft.observacoes} onChange={(e) => setDraft(item.id, { observacoes: e.target.value })} placeholder="Observacoes do atendimento" className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                      <span className="text-sm text-[var(--muted)]">Valor congelado do atendimento</span>
                                      <button onClick={() => salvarFinanceiro(item)} className="rounded-xl bg-[var(--accent)] text-black px-4 py-2 text-sm font-medium hover:opacity-90">
                                        Salvar ajuste
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}

                  {!loadingOperacao && operacaoCancelada.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]">Cancelados</h3>
                        <span className="text-sm text-zinc-300">{operacaoCancelada.length} item(ns)</span>
                      </div>
                      {operacaoCancelada.map((item) => (
                        <article key={item.id} className="rounded-2xl border border-red-500/10 bg-red-500/[0.04] p-4 opacity-85">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                <p className="text-lg font-semibold">{formatarHora(item.hora_inicio)} - {formatarHora(item.hora_fim)}</p>
                                <Badge label={badgeLabel(item)} />
                              </div>
                              <p className="text-white">{item.nome_cliente}</p>
                              <p className="text-sm text-[var(--muted)]">{item.servico_nome || "Servico nao informado"}</p>
                            </div>
                            {item.celular_cliente ? (
                              <a href={`https://wa.me/55${item.celular_cliente.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-center hover:bg-white/10">
                                WhatsApp
                              </a>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <Panel title="Radar do dia" subtitle={`Resumo de ${formatarDataBR(dataOperacao)}`}>
                  <div className="space-y-4">
                    <InfoRow label="Receita prevista" value={moeda(metricasDia.receitaPrevista)} accent />
                    <InfoRow label="Receita realizada" value={moeda(metricasDia.receitaRealizada)} success />
                    <InfoRow label="Ticket medio" value={moeda(metricasDia.ticketMedio)} />
                    <InfoRow label="Pendencias de pagamento" value={String(metricasDia.pendenciasPagamento)} />
                  </div>
                </Panel>

                <Panel title="Proximos horarios" subtitle="Agenda mais proxima do dia">
                  <div className="space-y-3 text-sm">
                    {proximosHorarios.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 px-3 py-3">
                        <p className="text-white">{item.nome_cliente}</p>
                        <p className="text-[var(--muted)]">{formatarHora(item.hora_inicio)} - {item.servico_nome || "Servico nao informado"}</p>
                      </div>
                    ))}
                    {proximosHorarios.length === 0 && (
                      <p className="text-[var(--muted)]">Nenhum horario ativo agora.</p>
                    )}
                  </div>
                </Panel>
              </div>
            </div>
          </section>
        )}

        {view === "financeiro" && (
          <section className="space-y-6">
            <Panel title="Fechamento por periodo" subtitle="Receita prevista, realizada e distribuicao operacional">
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
              </div>

              <div className="grid md:grid-cols-6 gap-3 mb-6">
                <MetricCard titulo="Previsto" valor={moeda(metricasFinanceiras.faturamentoPrevisto)} accent />
                <MetricCard titulo="Realizado" valor={moeda(metricasFinanceiras.faturamentoRealizado)} success />
                <MetricCard titulo="Ticket medio" valor={moeda(metricasFinanceiras.ticketMedio)} />
                <MetricCard titulo="Concluidos" valor={String(metricasFinanceiras.realizados)} />
                <MetricCard titulo="Pagos" valor={String(metricasFinanceiras.pagos)} />
                <MetricCard titulo="Cancel./No-show" valor={`${metricasFinanceiras.cancelados}/${metricasFinanceiras.noShow}`} />
              </div>

              <div className="grid xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)] mb-4">Performance por servico</p>
                  <div className="space-y-3">
                    {loadingPeriodo && <p className="text-[var(--muted)]">Carregando periodo...</p>}
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
                  <p className="text-sm uppercase tracking-[0.22em] text-[var(--muted)] mb-4">Recebimento por forma de pagamento</p>
                  <div className="space-y-3">
                    {loadingPeriodo && <p className="text-[var(--muted)]">Carregando periodo...</p>}
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
          </section>
        )}

        {view === "clientes" && (
          <section className="space-y-6">
            <Panel title="Base de clientes" subtitle="Recorrencia, receita e cancelamentos no periodo selecionado">
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
              </div>

              <div className="grid gap-3">
                {loadingPeriodo && <p className="text-[var(--muted)]">Carregando clientes...</p>}
                {metricasClientes.map((cliente) => (
                  <div key={`${cliente.celular}-${cliente.ultData}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-white">{cliente.nome}</p>
                      <p className="text-sm text-[var(--muted)]">{cliente.celular || "Sem telefone"}</p>
                    </div>
                    <div className="grid grid-cols-3 md:flex gap-4 text-sm">
                      <span className="text-[var(--muted)]">Visitas: <strong className="text-white">{cliente.total}</strong></span>
                      <span className="text-[var(--muted)]">Receita: <strong className="text-[var(--accent-strong)]">{moeda(cliente.receita)}</strong></span>
                      <span className="text-[var(--muted)]">Cancel.: <strong className="text-white">{cliente.cancelados}</strong></span>
                    </div>
                    <span className="text-sm text-[var(--muted)]">Ultima visita {formatarDataBR(cliente.ultData)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {view === "bloqueios" && (
          <section className="grid xl:grid-cols-[0.9fr_1.1fr] gap-6">
            <Panel title="Criar bloqueio" subtitle="Controle de disponibilidade do barbeiro">
              <form onSubmit={criarBloqueio} className="grid gap-4">
                <input name="data" type="date" value={dataBloqueio} onChange={(e) => setDataBloqueio(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                <div className="grid gap-2">
                  {(["horario", "dia_inteiro", "nao_aceitar_mais"] as Bloqueio["tipo_bloqueio"][]).map((tipo) => (
                    <label key={tipo} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 flex items-center gap-3">
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
                <button type="submit" className="rounded-xl bg-[var(--accent)] text-black px-4 py-3 font-medium">Criar bloqueio</button>
              </form>
            </Panel>

            <Panel title="Agenda de bloqueios" subtitle="Historico e disponibilidade recente">
              <div className="space-y-4">
                {[...bloqueios, ...todosBloqueios.filter((item) => item.data !== dataBloqueio)].map((bloqueio) => (
                  <div key={bloqueio.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 flex justify-between gap-4">
                    <div>
                      <p className="text-white">{formatarDataBR(bloqueio.data)}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {bloqueio.tipo_bloqueio === "horario"
                          ? `${formatarHora(bloqueio.hora_inicio || "00:00")} - ${formatarHora(bloqueio.hora_fim || "23:59")}`
                          : bloqueio.tipo_bloqueio === "dia_inteiro"
                            ? "Dia inteiro"
                            : "Nao aceitar mais horarios"}
                      </p>
                      {bloqueio.motivo && <p className="text-sm text-zinc-300 mt-1">{bloqueio.motivo}</p>}
                    </div>
                    <button onClick={() => deletarBloqueio(bloqueio.id)} className="text-red-300 text-sm">Remover</button>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {view === "horarios" && (
          <section className="grid xl:grid-cols-[0.9fr_1.1fr] gap-6">
            <Panel title="Horario personalizado" subtitle="Cadastro manual de compromissos fora do fluxo do site">
              <form onSubmit={criarHorario} className="grid gap-4">
                <p className="text-sm text-[var(--muted)]">
                  O horario personalizado e livre: pode ser cadastrado em qualquer hora, mesmo fora do expediente. So bloqueamos conflito com outro atendimento ja existente.
                </p>
                <input name="data-horario" type="date" value={dataHorarios} onChange={(e) => setDataHorarios(e.target.value)} className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                <input name="nome_cliente" type="text" placeholder="Nome do cliente" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
                <input name="celular_cliente" type="text" placeholder="Celular do cliente" className="rounded-xl border border-white/10 bg-black/20 px-4 py-2" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="hora_inicio" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                  <input name="hora_fim" type="time" className="datetime-input rounded-xl border border-white/10 px-4 py-2" />
                </div>
                <button type="submit" className="rounded-xl bg-emerald-500 text-black px-4 py-3 font-medium">Salvar horario</button>
              </form>
            </Panel>

            <Panel title="Horarios personalizados" subtitle={`Itens de ${formatarDataBR(dataHorarios)}`}>
              <div className="space-y-4">
                {horarios.length === 0 && <p className="text-[var(--muted)]">Nenhum horario personalizado cadastrado.</p>}
                {horarios.map((horario) => (
                  <div key={horario.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 flex justify-between gap-4">
                    <div>
                      <p className="text-white">{formatarHora(horario.hora_inicio)} - {formatarHora(horario.hora_fim)}</p>
                      <p className="text-sm text-zinc-300">{horario.nome_cliente || "Sem nome"}</p>
                      {horario.celular_cliente && <p className="text-sm text-[var(--muted)]">{horario.celular_cliente}</p>}
                    </div>
                    <button onClick={() => deletarHorario(horario.id)} className="text-red-300 text-sm">Remover</button>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}
      </div>
    </main>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[var(--line)] bg-[rgba(18,18,18,0.92)] p-6">
      <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)] mb-2">{subtitle}</p>
      <h2 className="text-2xl font-semibold mb-6">{title}</h2>
      {children}
    </section>
  )
}

function MetricCard({ titulo, valor, accent, success }: { titulo: string; valor: string; accent?: boolean; success?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{titulo}</p>
      <p className={`text-xl font-semibold mt-2 ${success ? "text-emerald-300" : accent ? "text-[var(--accent-strong)]" : "text-white"}`}>{valor}</p>
    </div>
  )
}

function QuickAction({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-xl px-4 py-2 text-sm text-left transition ${danger ? "border border-red-500/20 bg-red-500/10 text-red-200 hover:bg-red-500/20" : "border border-white/10 bg-white/5 hover:bg-white/10"}`}>
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

function InfoRow({ label, value, accent, success }: { label: string; value: string; accent?: boolean; success?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`${success ? "text-emerald-300" : accent ? "text-[var(--accent-strong)]" : "text-white"}`}>{value}</span>
    </div>
  )
}

function InputMoney({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="block text-[var(--muted)] mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" />
    </label>
  )
}
