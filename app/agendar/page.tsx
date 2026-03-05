'use client'

import { useEffect, useState } from 'react'

type Slot = {
  hora_inicio: string
  hora_fim: string
}

function formatarData(valor: string) {
  valor = valor.replace(/\D/g, '')

  if (valor.length > 8) valor = valor.slice(0, 8)

  if (valor.length > 4) {
    return `${valor.slice(0, 2)}/${valor.slice(2, 4)}/${valor.slice(4)}`
  }

  if (valor.length > 2) {
    return `${valor.slice(0, 2)}/${valor.slice(2)}`
  }

  return valor
}

function converterParaISO(data: string) {
  if (data.length !== 10) return null

  const [dia, mes, ano] = data.split('/')

  return `${ano}-${mes}-${dia}`
}

function formatarCelular(valor: string) {
  valor = valor.replace(/\D/g, '')

  if (valor.length > 11) valor = valor.slice(0, 11)

  if (valor.length > 6) {
    return `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7)}`
  }

  if (valor.length > 2) {
    return `(${valor.slice(0, 2)}) ${valor.slice(2)}`
  }

  if (valor.length > 0) {
    return `(${valor}`
  }

  return valor
}

export default function AgendarPage() {
  const [data, setData] = useState('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function buscarHorarios(dataFormatada: string) {
    const res = await fetch(`/api/horarios?data=${dataFormatada}`)
    const json = await res.json()

    setSlots(json.horarios ?? [])
  }

  useEffect(() => {
    const iso = converterParaISO(data)

    if (iso) {
      buscarHorarios(iso)
    }
  }, [data])

  async function reservar() {
    const iso = converterParaISO(data)

    if (!iso) {
      setMsg('Informe uma data válida')
      return
    }

    if (!horarioSelecionado) {
      setMsg('Selecione um horário')
      return
    }

    if (!nome || !celular) {
      setMsg('Informe nome e celular')
      return
    }

    setLoading(true)
    setMsg('')

    const res = await fetch('/api/reservar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: iso,
        hora_inicio: horarioSelecionado,
        nome,
        celular: celular.replace(/\D/g, ''),
      }),
    })

    const json = await res.json()

    setLoading(false)

    if (json.ok) {
      setMsg('Agendamento realizado com sucesso!')
      setHorarioSelecionado(null)
      setNome('')
      setCelular('')
      buscarHorarios(iso)
    } else {
      setMsg(json.erro || 'Erro ao agendar')
    }
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 700,
        margin: '0 auto',
        fontFamily: 'system-ui',
        color: '#fff',
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Agendar horário</h1>

      <div style={{ marginBottom: 20 }}>
        <label>Escolha a data</label>

        <input
          placeholder="dd/mm/aaaa"
          value={data}
          onChange={(e) => setData(formatarData(e.target.value))}
          style={{
            display: 'block',
            marginTop: 6,
            padding: 10,
            borderRadius: 8,
            border: '1px solid #555',
            background: '#111',
            color: '#fff',
          }}
        />
      </div>

      {slots.length > 0 && (
        <>
          <h3>Horários disponíveis</h3>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {slots.map((s) => {
              const ativo = horarioSelecionado === s.hora_inicio

              return (
                <button
                  key={s.hora_inicio}
                  onClick={() => setHorarioSelecionado(s.hora_inicio)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: ativo ? '2px solid #22c55e' : '1px solid #555',
                    background: ativo ? '#22c55e' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {s.hora_inicio}
                </button>
              )
            })}
          </div>
        </>
      )}

      {horarioSelecionado && (
        <>
          <h3>Seus dados</h3>

          <input
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            style={{
              display: 'block',
              marginBottom: 10,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #555',
              background: '#111',
              color: '#fff',
              width: '100%',
            }}
          />

          <input
            placeholder="(00) 00000-0000"
            value={celular}
            onChange={(e) => setCelular(formatarCelular(e.target.value))}
            style={{
              display: 'block',
              marginBottom: 12,
              padding: 10,
              borderRadius: 8,
              border: '1px solid #555',
              background: '#111',
              color: '#fff',
              width: '100%',
            }}
          />

          <button
            onClick={reservar}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#22c55e',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Agendando...' : 'Confirmar agendamento'}
          </button>
        </>
      )}

      {msg && (
        <p style={{ marginTop: 16, fontWeight: 500 }}>
          {msg}
        </p>
      )}
    </main>
  )
}