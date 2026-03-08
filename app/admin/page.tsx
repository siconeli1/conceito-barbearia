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
}

type HorarioCustomizado = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
}

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

type Tab = "agenda" | "bloqueios" | "horarios"

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("agenda")
  
  // Agenda
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [dataSelecionada, setDataSelecionada] = useState(formatarDataInput(new Date()))
  
  // Bloqueios
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [dataBloqueio, setDataBloqueio] = useState(formatarDataInput(new Date()))
  
  // Horários customizados
  const [horarios, setHorarios] = useState<HorarioCustomizado[]>([])
  const [dataHorarios, setDataHorarios] = useState(formatarDataInput(new Date()))
  
  // Estados globais
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const carregarAgenda = useCallback(async (data: string) => {
    setLoading(true)
    setErro(null)

    try {
      const res = await fetch(`/api/admin-agenda?data=${data}`)
      if (!res.ok) throw new Error("Erro ao carregar agenda")
      
      const dados: Agendamento[] = await res.json()
      setAgendamentos(dados)
    } catch (error) {
      console.error(error)
      setErro("Erro ao carregar a agenda. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarBloqueios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/bloqueios?data=${data}`)
      if (!res.ok) throw new Error("Erro ao carregar bloqueios")
      
      const json = await res.json()
      setBloqueios(json.bloqueios || [])
    } catch (error) {
      console.error(error)
      setErro("Erro ao carregar bloqueios.")
    }
  }, [])

  const carregarHorarios = useCallback(async (data: string) => {
    try {
      const res = await fetch(`/api/horarios-customizados?data=${data}`)
      if (!res.ok) throw new Error("Erro ao carregar horários")
      
      const json = await res.json()
      setHorarios(json.horarios || [])
    } catch (error) {
      console.error(error)
      setErro("Erro ao carregar horários.")
    }
  }, [])

  useEffect(() => {
    carregarAgenda(dataSelecionada)
  }, [dataSelecionada, carregarAgenda])

  useEffect(() => {
    if (tab === "bloqueios") {
      carregarBloqueios(dataBloqueio)
    }
  }, [dataBloqueio, tab, carregarBloqueios])

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
    const dia_inteiro = (form.elements.namedItem("dia_inteiro") as HTMLInputElement).checked
    const motivo = (form.elements.namedItem("motivo") as HTMLInputElement).value

    setErro(null)
    setMensagem(null)

    // Validações
    if (!data) {
      setErro("Informe a data")
      return
    }

    if (!dia_inteiro && !hora_inicio) {
      setErro("Informe a hora de início")
      return
    }

    if (!dia_inteiro && hora_inicio && hora_fim && hora_inicio >= hora_fim) {
      setErro("Hora de fim deve ser após hora de início")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/bloqueios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          hora_inicio: dia_inteiro ? null : hora_inicio || null,
          hora_fim: dia_inteiro ? null : hora_fim || null,
          dia_inteiro: !!dia_inteiro,
          motivo: motivo || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.erro || "Erro ao criar bloqueio")
      }

      setMensagem("Bloqueio criado com sucesso!")
      form.reset()
      setDataBloqueio(data)
      await carregarBloqueios(data)
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao criar bloqueio")
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

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.erro || "Erro ao deletar bloqueio")
      }

      setMensagem("Bloqueio removido com sucesso!")
      await carregarBloqueios(dataBloqueio)
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao deletar bloqueio")
    } finally {
      setLoading(false)
    }
  }

  async function criarHorario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    const form = e.currentTarget
    const data = (form.elements.namedItem("data-horario") as HTMLInputElement).value
    const hora_inicio = (form.elements.namedItem("hora-inicio-nuevo") as HTMLInputElement).value
    const hora_fim = (form.elements.namedItem("hora-fim-nuevo") as HTMLInputElement).value

    setErro(null)
    setMensagem(null)

    if (!data || !hora_inicio || !hora_fim) {
      setErro("Informe data, hora de início e hora de fim")
      return
    }

    if (hora_inicio >= hora_fim) {
      setErro("Hora de fim deve ser após hora de início")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/horarios-customizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, hora_inicio, hora_fim }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.erro || "Erro ao criar horário")
      }

      setMensagem("Horário criado com sucesso!")
      form.reset()
      await carregarHorarios(data)
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao criar horário")
    } finally {
      setLoading(false)
    }
  }

  async function deletarHorario(id: string) {
    if (!confirm("Tem certeza que deseja remover este horário?")) return

    setErro(null)
    setMensagem(null)
    setLoading(true)

    try {
      const res = await fetch("/api/horarios-customizados", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.erro || "Erro ao deletar horário")
      }

      setMensagem("Horário removido com sucesso!")
      await carregarHorarios(dataHorarios)
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Erro ao deletar horário")
    } finally {
      setLoading(false)
    }
  }

  // Auto-limpar mensagens após 5 segundos
  useEffect(() => {
    if (mensagem) {
      const timer = setTimeout(() => setMensagem(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [mensagem])

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Painel do Barbeiro</h1>

        {/* Abas */}
        <div className="flex gap-4 mb-6 border-b border-zinc-700">
          <button
            onClick={() => {
              setTab("agenda")
              setErro(null)
              setMensagem(null)
            }}
            className={`pb-2 px-4 font-semibold transition ${
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
            className={`pb-2 px-4 font-semibold transition ${
              tab === "bloqueios"
                ? "text-white border-b-2 border-green-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Bloquear horários
          </button>

          <button
            onClick={() => {
              setTab("horarios")
              setErro(null)
              setMensagem(null)
            }}
            className={`pb-2 px-4 font-semibold transition ${
              tab === "horarios"
                ? "text-white border-b-2 border-green-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Meus horários
          </button>
        </div>

        {/* Mensagens */}
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

        {/* Aba: Agenda */}
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
              <p className="text-zinc-400">Nenhum horário agendado nesta data.</p>
            )}

            {!loading && agendamentos.map((a) => (
              <div
                key={a.id}
                className="flex justify-between items-center border-b border-zinc-700 py-4"
              >
                <div>
                  <p className="font-semibold">
                    {formatarHora(a.hora_inicio)}
                  </p>

                  <p className="text-sm text-zinc-300">
                    {a.nome_cliente}
                  </p>

                  <p className="text-sm text-zinc-500">
                    {a.celular_cliente}
                  </p>
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

        {/* Aba: Bloqueios */}
        {tab === "bloqueios" && (
          <div className="space-y-6">
            {/* Formulário */}
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

                <label className="flex items-center gap-2 text-sm text-zinc-200">
                  <input
                    name="dia_inteiro"
                    type="checkbox"
                    defaultChecked={false}
                    className="w-4 h-4"
                  />
                  Bloquear dia inteiro
                </label>

                <div id="horarios" className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hora-inicio" className="block text-sm text-zinc-200 mb-2">
                      Hora início
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
                    placeholder="Ex: almoço, folga, compromisso..."
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

            {/* Lista de bloqueios */}
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
                      {b.dia_inteiro
                        ? "Dia inteiro"
                        : `${formatarHora(b.hora_inicio || "00:00")} - ${formatarHora(b.hora_fim || "23:59")}`}
                    </p>
                    {b.motivo && (
                      <p className="text-sm text-zinc-400">
                        {b.motivo}
                      </p>
                    )}
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
          </div>
        )}

        {/* Aba: Horários */}
        {tab === "horarios" && (
          <div className="space-y-6">
            {/* Formulário */}
            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">Cadastrar horário personalizado</h2>

              <form onSubmit={criarHorario} className="grid gap-4">
                <div>
                  <label htmlFor="data-horario" className="block text-sm text-zinc-200 mb-2">
                    Data
                  </label>
                  <input
                    id="data-horario"
                    name="data"
                    type="date"
                    required
                    value={dataHorarios}
                    onChange={(e) => setDataHorarios(e.target.value)}
                    className="bg-zinc-800 text-white px-4 py-2 rounded border border-zinc-700 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hora-inicio" className="block text-sm text-zinc-200 mb-2">
                      Hora início
                    </label>
                    <input
                      id="hora-inicio"
                      name="hora_inicio"
                      type="time"
                      required
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
                  {loading ? "Salvando..." : "Salvar horário"}
                </button>
              </form>
            </div>

            {/* Lista de horários */}
            <div className="bg-zinc-900 rounded-lg p-6">
              <h2 className="text-xl mb-4 text-white">
                Horários em {formatarDataBR(dataHorarios)}
              </h2>

              {horarios.length === 0 && (
                <p className="text-zinc-400">Nenhum horário personalizado para esta data.</p>
              )}

              {horarios.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-zinc-700 py-4 last:border-0"
                >
                  <p className="font-semibold">
                    {formatarHora(h.hora_inicio)} - {formatarHora(h.hora_fim)}
                  </p>

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
