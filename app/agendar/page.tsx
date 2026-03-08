"use client"

import { useCallback, useEffect, useReducer, useState } from "react"
import Link from "next/link"
import { Slot, formatarData, converterParaISO, formatarCelular, isDateInPast, isDateBeyondLimit } from "../../lib/format"
import { useDebounce } from "../../lib/hooks"

// responses from the backend
interface HorariosResponse {
  horarios?: Slot[]
  erro?: string
}

interface ReservaResponse {
  ok: boolean
  erro?: string
}

// consolidated form state handled by reducer
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

  // derived validation flags
  const dateInvalid =
    form.erro.toLowerCase().includes("data") ||
    form.erro.toLowerCase().includes("passado") ||
    form.erro.toLowerCase().includes("intervalo")
  const timeInvalid = form.erro.toLowerCase().includes("horário")
  const nameInvalid = form.erro.toLowerCase().includes("nome")
  const phoneInvalid = form.erro.toLowerCase().includes("celular")

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
    const iso = converterParaISO(debouncedData)

    if (iso) {
      if (pastDate) {
        dispatch({ type: "setErro", value: "Não é possível buscar horários no passado" })
        setSlots([])
        dispatch({ type: "setHorario", value: null })
      } else if (outOfRange) {
        dispatch({ type: "setErro", value: "Data fora do intervalo permitido (30 dias)" })
        setSlots([])
        dispatch({ type: "setHorario", value: null })
      } else {
        buscarHorarios(iso)
      }
    } else {
      setSlots([])
      dispatch({ type: "setHorario", value: null })
    }
  }, [debouncedData, buscarHorarios, pastDate, outOfRange])

  const reservar = useCallback(async () => {
    const iso = converterParaISO(data)
    const pastDate = iso ? isDateInPast(iso) : false
    const outOfRangeLocal = iso ? isDateBeyondLimit(iso, 30) : false

    if (!iso) {
      dispatch({ type: "setMsg", value: "" })
      dispatch({ type: "setErro", value: "Informe uma data válida" })
      return
    }

    if (pastDate || outOfRangeLocal) {
      dispatch({ type: "setMsg", value: "" })
      dispatch({ type: "setErro", value: "Não é possível agendar para esta data" })
      return
    }

    if (!form.horarioSelecionado) {
      dispatch({ type: "setMsg", value: "" })
      dispatch({ type: "setErro", value: "Selecione um horário" })
      return
    }

    if (!form.nome || !form.celular) {
      dispatch({ type: "setMsg", value: "" })
      dispatch({ type: "setErro", value: "Informe seu nome e celular" })
      return
    }

    setLoading(true)
    dispatch({ type: "setMsg", value: "" })
    dispatch({ type: "setErro", value: "" })

    try {
      const res = await fetch("/api/reservar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: iso,
          hora_inicio: form.horarioSelecionado,
          nome: form.nome,
          celular: form.celular.replace(/\D/g, ""),
        }),
      })

      const json: ReservaResponse = await res.json()

      if (json.ok) {
        dispatch({ type: "setMsg", value: "Agendamento realizado com sucesso!" })
        dispatch({ type: "setHorario", value: null })
        dispatch({ type: "setNome", value: "" })
        dispatch({ type: "setCelular", value: "" })
        buscarHorarios(iso)
      } else {
        dispatch({ type: "setErro", value: json.erro || "Erro ao agendar" })
      }
    } catch {
      dispatch({ type: "setErro", value: "Erro ao agendar" })
    } finally {
      setLoading(false)
    }
  }, [data, form.horarioSelecionado, form.nome, form.celular, buscarHorarios])

  // clear success message after a few seconds
  useEffect(() => {
    if (form.msg) {
      const timer = setTimeout(() => dispatch({ type: "setMsg", value: "" }), 5000)
      return () => clearTimeout(timer)
    }
  }, [form.msg])

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white">Agendar horário</h1>
          <p className="mt-3 text-zinc-200">
            Escolha a data, selecione um horário disponível e preencha seus dados
            para confirmar o atendimento.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:p-8 shadow-2xl">
          <div className={`grid gap-8 md:grid-cols-[280px_1fr] ${
            timeInvalid ? "border border-red-500 p-2 rounded" : ""
          }`}>
            <div>
              <label htmlFor="data-input" className="mb-2 block text-sm font-medium text-zinc-200">
                Data do atendimento
              </label>

              <input
                id="data-input"
                placeholder="dd/mm/aaaa"
                value={data}
                disabled={loading || carregandoHorarios}
                onChange={(e) => setData(formatarData(e.target.value))}
                className={`w-full rounded-xl border px-4 py-3 bg-zinc-900 text-white outline-none transition focus:border-green-500 ${
                  dateInvalid ? "border-red-500" : "border-zinc-700"
                } ${loading || carregandoHorarios ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              {(pastDate || outOfRange) && (
                <p className="mt-1 text-sm text-red-400">
                  Não é possível agendar para esta data.
                </p>
              )}

              <p className="mt-3 text-sm text-zinc-500">
                Exemplo: 07/03/2026
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Horários disponíveis</h2>

                {carregandoHorarios && (
                  <span className="text-sm text-zinc-200">Carregando...</span>
                )}
              </div>

              {!carregandoHorarios && data && slots.length === 0 && !form.erro && (
                <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-200">
                  Nenhum horário disponível para esta data.
                </div>
              )}

              {slots.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map((s) => {
                    const ativo = form.horarioSelecionado === s.hora_inicio

                    return (
                      <button
                        key={s.hora_inicio}
                        onClick={() => dispatch({ type: "setHorario", value: s.hora_inicio })}
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          ativo
                            ? "border-green-500 bg-green-500 text-white shadow-lg shadow-green-500/20"
                            : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        {s.hora_inicio}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="my-8 h-px bg-zinc-800" />

          <div>
            <h2 className="mb-5 text-lg font-semibold">Seus dados</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="nome-input" className="mb-2 block text-sm font-medium text-zinc-200">
                  Nome
                </label>
                <input
                  id="nome-input"
                  placeholder="Seu nome completo"
                  value={form.nome}
                  disabled={loading}
                  onChange={(e) => dispatch({ type: "setNome", value: e.target.value })}
                  className={`w-full rounded-xl border px-4 py-3 bg-zinc-900 text-white outline-none transition focus:border-green-500 ${
                    nameInvalid ? "border-red-500" : "border-zinc-700"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                />
              </div>

              <div>
                <label htmlFor="celular-input" className="mb-2 block text-sm font-medium text-zinc-200">
                  Celular
                </label>
                <input
                  id="celular-input"
                  placeholder="(00) 00000-0000"
                  value={form.celular}
                  disabled={loading}
                  onChange={(e) => dispatch({ type: "setCelular", value: formatarCelular(e.target.value) })}
                  className={`w-full rounded-xl border px-4 py-3 bg-zinc-900 text-white outline-none transition focus:border-green-500 ${
                    phoneInvalid ? "border-red-500" : "border-zinc-700"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                />
              </div>
            </div>

            {form.horarioSelecionado && (
              <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                Horário selecionado: <strong>{form.horarioSelecionado}</strong>
              </div>
            )}

            {form.erro && (
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {form.erro}
              </div>
            )}

            {form.msg && (
              <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {form.msg}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={reservar}
                disabled={loading || pastDate}
                className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Agendando..." : "Confirmar agendamento"}
              </button>

              <Link
                href="/"
                className="rounded-xl border border-zinc-700 px-6 py-3 text-center font-semibold text-zinc-200 transition hover:bg-zinc-900"
              >
                Voltar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}