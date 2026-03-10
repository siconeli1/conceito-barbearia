"use client"

import { useCallback, useEffect, useState } from "react"

type Agendamento = {
  id: string
  data: string
  hora_inicio: string
  nome_cliente: string
  celular_cliente: string
}

type Bloqueio = {
  id: string
  data: string
  hora_inicio: string | null
  hora_fim: string | null
  dia_inteiro: boolean
  motivo: string | null
  tipo_bloqueio: 'horario' | 'dia_inteiro' | 'nao_aceitar_mais'
}

type HorarioCustomizado = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  nome_cliente: string | null
  celular_cliente: string | null
}

type ApiJson = unknown

function formatarDataInput(data: Date) {
  return data.toISOString().split("T")[0]
}

function formatarDataBR(data: string) {
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}

function formatarHora(hora: string) {
  return hora.slice(0, 5)
}

async function lerRespostaJson(res: Response): Promise<ApiJson> {
  const contentType = res.headers.get("content-type") || ""
  const body = await res.text()

  if (!contentType.includes("application/json")) {
    const msg = body.trim().startsWith("<")
      ? "O servidor retornou uma pagina HTML em vez de JSON. Verifique erro na rota da API."
      : body || "Resposta invalida do servidor."
    throw new Error(msg)
  }

  return JSON.parse(body) as ApiJson
}

type Tab = "agenda" | "bloqueios" | "horarios"

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("agenda")
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [dataSelecionada, setDataSelecionada] = useState(formatarDataInput(new Date()))
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [dataBloqueio, setDataBloqueio] = useState(formatarDataInput(new Date()))
  const [todosBloqueios, setTodosBloqueios] = useState<Bloqueio[]>([])
  const [horarios, setHorarios] = useState<HorarioCustomizado[]>([])
  const [dataHorarios, setDataHorarios] = useState(formatarDataInput(new Date()))
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const carregarAgenda = useCallback(async (data: string) => {
    setLoading(true)
    setErro(null)

    try {
      const res = await fetch(`/api/admin-agenda?data=${data}`)
      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao carregar agenda.")
      }

      setAgendamentos(Array.isArray(json) ? (json as Agendamento[]) : [])
    } catch (error) {
      console.error(error)
      setErro(error instanceof Error ? error.message : "Erro ao carregar a agenda.")
      setAgendamentos([])
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarBloqueios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/bloqueios?data=${data}`)
      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao carregar bloqueios.")
      }

      setBloqueios((((json as Record<string, unknown>).bloqueios as Bloqueio[]) || []))
    } catch (error) {
      console.error(error)
      setErro(error instanceof Error ? error.message : "Erro ao carregar bloqueios.")
      setBloqueios([])
    }
  }, [])

  const carregarTodosBloqueios = useCallback(async () => {
    try {
      const res = await fetch("/api/bloqueios/todos")
      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao carregar bloqueios.")
      }

      const bloqueiosData = (((json as Record<string, unknown>).bloqueios as Bloqueio[]) || [])
      
      // Ordena por data (descendente)
      bloqueiosData.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      
      setTodosBloqueios(bloqueiosData)
    } catch (error) {
      console.error(error)
      setTodosBloqueios([])
    }
  }, [])

  const carregarHorarios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/horarios-customizados?data=${data}`)
      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao carregar horarios.")
      }

      setHorarios((((json as Record<string, unknown>).horarios as HorarioCustomizado[]) || []))
    } catch (error) {
      console.error(error)
      setErro(error instanceof Error ? error.message : "Erro ao carregar horarios.")
      setHorarios([])
    }
  }, [])

  useEffect(() => {
    carregarAgenda(dataSelecionada)
  }, [dataSelecionada, carregarAgenda])

  useEffect(() => {
    if (tab === "bloqueios") {
      carregarBloqueios(dataBloqueio)
      carregarTodosBloqueios()
    }
  }, [dataBloqueio, tab, carregarBloqueios, carregarTodosBloqueios])

  useEffect(() => {
    if (tab === "horarios") {
      carregarHorarios(dataHorarios)
    }
  }, [dataHorarios, tab, carregarHorarios])

  async function criarBloqueio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const form = e.currentTarget
    const data = (form.elements.namedItem("data") as HTMLInputElement).value
    const hora_inicio = (form.elements.namedItem("hora_inicio") as HTMLInputElement).value
    const hora_fim = (form.elements.namedItem("hora_fim") as HTMLInputElement).value
    const motivo = (form.elements.namedItem("motivo") as HTMLInputElement).value
    
    // Pega o tipo de bloqueio selecionado do radio button
    const tipo_bloqueio_input = (form.elements.namedItem("tipo_bloqueio") as RadioNodeList)
    let tipo_bloqueio: 'horario' | 'dia_inteiro' | 'nao_aceitar_mais' = 'horario'
    
    if (tipo_bloqueio_input && tipo_bloqueio_input.length > 0) {
      const selecionado = (tipo_bloqueio_input as any).value
      if (selecionado === 'dia_inteiro' || selecionado === 'nao_aceitar_mais') {
        tipo_bloqueio = selecionado
      }
    }

    setErro(null)
    setMensagem(null)

    if (!data) {
      setErro("Informe a data.")
      return
    }

    // Validações específicas por tipo de bloqueio
    if (tipo_bloqueio === 'horario') {
      // Bloqueio de horário específico
      if (!hora_inicio) {
        setErro("Informe a hora de inicio.")
        return
      }
      if (hora_inicio && hora_fim && hora_inicio >= hora_fim) {
        setErro("Hora de fim deve ser apos hora de inicio.")
        return
      }
    }

    setLoading(true)

    try {
      const res = await fetch("/api/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          hora_inicio: tipo_bloqueio === 'horario' ? hora_inicio || null : null,
          hora_fim: tipo_bloqueio === 'horario' ? hora_fim || null : null,
          dia_inteiro: tipo_bloqueio === 'dia_inteiro',
          motivo: motivo || null,
          tipo_bloqueio,
        }),
      })

      const json = await lerRespostaJson(res)

      if (!res.ok) {
        // Se há agendamentos ativos, mostrar mensagem especial
        if ((json as Record<string, unknown>).agendamentos) {
          setErro(`${(json as Record<string, unknown>).erro}\n\nAgendamentos ativos:`)
          // Aqui você poderia mostrar os agendamentos em uma lista
          return
        }
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao criar bloqueio.")
      }

      setMensagem("Bloqueio criado com sucesso!")
      form.reset()
      setDataBloqueio(data)
      await carregarBloqueios(data)
      await carregarTodosBloqueios()
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao criar bloqueio.")
    } finally {
      setLoading(false)
    }
  }

  async function deletarBloqueio(id: string) {
    if (!confirm("Tem certeza que deseja remover este bloqueio?")) return

    setErro(null)
    setMensagem(null)
    setLoading(true)

    try {
      const res = await fetch("/api/bloqueios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao deletar bloqueio.")
      }

      setMensagem("Bloqueio removido com sucesso!")
      await carregarBloqueios(dataBloqueio)
      await carregarTodosBloqueios()
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao deletar bloqueio.")
    } finally {
      setLoading(false)
    }
  }

  async function criarHorario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const form = e.currentTarget
    const data = (form.elements.namedItem("data-horario") as HTMLInputElement).value
    const hora_inicio = (form.elements.namedItem("hora_inicio") as HTMLInputElement).value
    const hora_fim = (form.elements.namedItem("hora_fim") as HTMLInputElement).value
    const nome_cliente = (form.elements.namedItem("nome_cliente") as HTMLInputElement).value
    const celular_cliente = (form.elements.namedItem("celular_cliente") as HTMLInputElement).value

    setErro(null)
    setMensagem(null)

    if (!data || !hora_inicio || !hora_fim) {
      setErro("Informe data, hora de inicio e hora de fim.")
      return
    }

    if (!nome_cliente) {
      setErro("Informe o nome do cliente.")
      return
    }

    if (hora_inicio >= hora_fim) {
      setErro("Hora de fim deve ser apos hora de inicio.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/horarios-customizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, hora_inicio, hora_fim, nome_cliente, celular_cliente: celular_cliente || null }),
      })

      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao criar horario.")
      }

      setMensagem("Horario criado com sucesso!")
      form.reset()
      setDataHorarios(data)
      await carregarHorarios(data)
      await carregarAgenda(data)
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao criar horario.")
    } finally {
      setLoading(false)
    }
  }

  async function deletarHorario(id: string) {
    if (!confirm("Tem certeza que deseja remover este horario?")) return

    setErro(null)
    setMensagem(null)
    setLoading(true)

    try {
      const res = await fetch("/api/horarios-customizados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      const json = await lerRespostaJson(res)

      if (!res.ok) {
        throw new Error(((json as Record<string, unknown>).erro as string) || "Erro ao deletar horario.")
      }

      setMensagem("Horario removido com sucesso!")
      await carregarHorarios(dataHorarios)
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao deletar horario.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mensagem) {
      const timer = setTimeout(() => setMensagem(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [mensagem])

  return (
    <main className="min-h-screen bg-black text-white p-6 sm:p-10">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Painel do Barbeiro</h1>
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" })
              window.location.href = "/admin/login"
            }}
            className="px-4 py-2 bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors text-sm sm:text-base"
          >
            Sair
          </button>
        </div>

        <div className="flex gap-4 mb-6 border-b border-zinc-700 overflow-x-auto">
          <button
            onClick={() => {
              setTab("agenda")
              setErro(null)
              setMensagem(null)
            }}
            className={`pb-2 px-4 font-semibold transition whitespace-nowrap ${
              tab === "agenda"
                ? "text-white border-b-2 border-green-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Agenda
          </button>

          <button
            onClick={() => {
              setTab("bloqueios")
              setErro(null)
              setMensagem(null)
            }}
            className={`pb-2 px-4 font-semibold transition whitespace-nowrap ${
              tab === "bloqueios"
                ? "text-white border-b-2 border-green-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Bloquear horarios
          </button>

          <button
            onClick={() => {
              setTab("horarios")
              setErro(null)
              setMensagem(null)
            }}
            className={`pb-2 px-4 font-semibold transition whitespace-nowrap ${
              tab === "horarios"
                ? "text-white border-b-2 border-green-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Meus horarios
          </button>
        </div>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-green-200">
            {mensagem}
          </div>
        )}

        {tab === "agenda" && (
          <div className="bg-zinc-900 rounded-lg p-6">
            <h2 className="text-xl mb-4 text-white">Agenda</h2>

            <div className="mb-6">
              <label htmlFor="data-agenda" className="block text-sm text-zinc-200 mb-2">
                Selecionar data
              </label>

              <input
                id="data-agenda"
                type="date"
                disabled={loading}
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <p className="text-sm text-zinc-200 mb-4">
              Exibindo agenda de {formatarDataBR(dataSelecionada)}
            </p>

            {loading && <p>Carregando...</p>}

            {!loading && agendamentos.length === 0 && (
              <p className="text-zinc-400">Nenhum horario agendado nesta data.</p>
            )}

            {!loading &&
              agendamentos.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center border-b border-zinc-700 py-4"
                >
                  <div>
                    <p className="font-semibold">{formatarHora(a.hora_inicio)}</p>
                    <p className="text-sm text-zinc-300">{a.nome_cliente}</p>
                    <p className="text-sm text-zinc-500">{a.celular_cliente}</p>
                  </div>

                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/55${a.celular_cliente.replace(/\D/g, "")}`}
                    className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded text-sm font-medium"
                  >
                    WhatsApp
                  </a>
                </div>
              ))}
          </div>
        )}

        {tab === "bloqueios" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">Criar novo bloqueio</h2>

              <form onSubmit={criarBloqueio} className="grid gap-4">
                <div>
                  <label htmlFor="data-bloqueio" className="block text-sm text-zinc-200 mb-2">
                    Data
                  </label>
                  <input
                    id="data-bloqueio"
                    name="data"
                    type="date"
                    required
                    value={dataBloqueio}
                    onChange={(e) => setDataBloqueio(e.target.value)}
                    className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      name="tipo_bloqueio"
                      type="radio"
                      value="horario"
                      defaultChecked
                      className="w-4 h-4"
                    />
                    Bloquear horário específico
                  </label>

                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      name="tipo_bloqueio"
                      type="radio"
                      value="dia_inteiro"
                      className="w-4 h-4"
                    />
                    Bloquear dia inteiro (não permite nenhum horário)
                  </label>

                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      name="tipo_bloqueio"
                      type="radio"
                      value="nao_aceitar_mais"
                      className="w-4 h-4"
                    />
                    Não aceitar mais horários (mantém agendamentos existentes, bloqueia horários vazios)
                  </label>
                </div>

                <div id="horarios" className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hora-inicio" className="block text-sm text-zinc-200 mb-2">
                      Hora inicio
                    </label>
                    <input
                      id="hora-inicio"
                      name="hora_inicio"
                      type="time"
                      className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="hora-fim" className="block text-sm text-zinc-200 mb-2">
                      Hora fim
                    </label>
                    <input
                      id="hora-fim"
                      name="hora_fim"
                      type="time"
                      className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="motivo" className="block text-sm text-zinc-200 mb-2">
                    Motivo (opcional)
                  </label>
                  <input
                    id="motivo"
                    name="motivo"
                    type="text"
                    placeholder="Ex: almoco, folga, compromisso..."
                    className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-medium w-fit"
                >
                  {loading ? "Criando..." : "Criar bloqueio"}
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">
                Bloqueios em {formatarDataBR(dataBloqueio)}
              </h2>

              {bloqueios.length === 0 && (
                <p className="text-zinc-400">Nenhum bloqueio para esta data.</p>
              )}

              {bloqueios.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b border-zinc-700 py-4 last:border-0"
                >
                  <div>
                    <p className="font-semibold">
                      {b.tipo_bloqueio === 'dia_inteiro' && "Dia inteiro"}
                      {b.tipo_bloqueio === 'nao_aceitar_mais' && "Não aceitar mais horários"}
                      {b.tipo_bloqueio === 'horario' && `${formatarHora(b.hora_inicio || "00:00")} - ${formatarHora(b.hora_fim || "23:59")}`}
                    </p>
                    {b.motivo && <p className="text-sm text-zinc-400">{b.motivo}</p>}
                  </div>

                  <button
                    onClick={() => deletarBloqueio(b.id)}
                    disabled={loading}
                    className="bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 text-red-200 px-3 py-1 rounded text-sm font-medium"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">Todos os bloqueios cadastrados</h2>

              {todosBloqueios.length === 0 && (
                <p className="text-zinc-400">Nenhum bloqueio cadastrado.</p>
              )}

              {todosBloqueios.length > 0 && (
                <div className="text-xs text-zinc-400 mb-4">
                  Total de {todosBloqueios.length} bloqueio{todosBloqueios.length !== 1 ? "s" : ""} cadastrado{todosBloqueios.length !== 1 ? "s" : ""}
                </div>
              )}

              {todosBloqueios.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b border-zinc-700 py-4 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-sm text-zinc-100">
                      {formatarDataBR(b.data)}
                    </p>
                    <p className="text-sm text-zinc-300 mt-1">
                      {b.tipo_bloqueio === 'dia_inteiro' && "Dia inteiro"}
                      {b.tipo_bloqueio === 'nao_aceitar_mais' && "Não aceitar mais horários"}
                      {b.tipo_bloqueio === 'horario' && `${formatarHora(b.hora_inicio || "00:00")} - ${formatarHora(b.hora_fim || "23:59")}`}
                    </p>
                    {b.motivo && <p className="text-xs text-zinc-400 mt-1">{b.motivo}</p>}
                  </div>

                  <button
                    onClick={() => deletarBloqueio(b.id)}
                    disabled={loading}
                    className="bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 text-red-200 px-3 py-1 rounded text-sm font-medium whitespace-nowrap"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "horarios" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">Cadastrar horario personalizado</h2>

              <form onSubmit={criarHorario} className="grid gap-4">
                <div>
                  <label htmlFor="data-horario" className="block text-sm text-zinc-200 mb-2">
                    Data
                  </label>
                  <input
                    id="data-horario"
                    name="data-horario"
                    type="date"
                    required
                    value={dataHorarios}
                    onChange={(e) => setDataHorarios(e.target.value)}
                    className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                  />
                </div>

                <div>
                  <label htmlFor="nome-cliente" className="block text-sm text-zinc-200 mb-2">
                    Nome do cliente (obrigatório)
                  </label>
                  <input
                    id="nome-cliente"
                    name="nome_cliente"
                    type="text"
                    placeholder="Ex: João Silva"
                    required
                    className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                  />
                </div>

                <div>
                  <label htmlFor="celular-cliente" className="block text-sm text-zinc-200 mb-2">
                    Celular do cliente (opcional)
                  </label>
                  <input
                    id="celular-cliente"
                    name="celular_cliente"
                    type="text"
                    placeholder="Ex: 11999999999"
                    className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hora-inicio-personalizado" className="block text-sm text-zinc-200 mb-2">
                      Hora inicio
                    </label>
                    <input
                      id="hora-inicio-personalizado"
                      name="hora_inicio"
                      type="time"
                      required
                      className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="hora-fim-personalizado" className="block text-sm text-zinc-200 mb-2">
                      Hora fim
                    </label>
                    <input
                      id="hora-fim-personalizado"
                      name="hora_fim"
                      type="time"
                      required
                      className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-medium w-fit"
                >
                  {loading ? "Salvando..." : "Salvar horario"}
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">
                Horarios em {formatarDataBR(dataHorarios)}
              </h2>

              {horarios.length === 0 && (
                <p className="text-zinc-400">Nenhum horario personalizado para esta data.</p>
              )}

              {horarios.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b border-zinc-700 py-4 last:border-0"
                >
                  <div>
                    <p className="font-semibold">
                      {formatarHora(h.hora_inicio)} - {formatarHora(h.hora_fim)}
                    </p>
                    <p className="text-sm text-zinc-300 mt-1">{h.nome_cliente || 'Sem nome'}</p>
                    {h.celular_cliente && (
                      <p className="text-sm text-zinc-500">{h.celular_cliente}</p>
                    )}
                  </div>

                  <button
                    onClick={() => deletarHorario(h.id)}
                    disabled={loading}
                    className="bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 text-red-200 px-3 py-1 rounded text-sm font-medium"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
