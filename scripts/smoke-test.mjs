const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const TEST_DATE = process.env.SMOKE_TEST_DATE || getNextOpenDate()
const TEST_PHONE = process.env.SMOKE_TEST_PHONE || '11999999999'
const TEST_NAME = process.env.SMOKE_TEST_NAME || 'Teste Smoke'

function getNextOpenDate() {
  const date = new Date()
  for (let step = 0; step < 14; step += 1) {
    date.setDate(date.getDate() + (step === 0 ? 0 : 1))
    const day = date.getDay()
    if (day >= 2 && day <= 6) {
      return date.toISOString().split('T')[0]
    }
  }

  return new Date().toISOString().split('T')[0]
}

async function requestJson(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  const text = await response.text()
  let json = null

  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  return { response, json }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  console.log(`Smoke test base URL: ${BASE_URL}`)
  console.log(`Smoke test date: ${TEST_DATE}`)

  const { response: servicosRes, json: servicosJson } = await requestJson('/api/servicos')
  assert(servicosRes.ok, `Falha ao buscar serviços: ${JSON.stringify(servicosJson)}`)
  const servicos = servicosJson?.servicos || []
  assert(Array.isArray(servicos) && servicos.length >= 5, 'Serviços não carregados corretamente')

  const barba = servicos.find((item) => item.codigo === 'barba')
  const cabeloBarba = servicos.find((item) => item.codigo === 'cabelo_barba')
  assert(barba, 'Serviço BARBA não encontrado')
  assert(cabeloBarba, 'Serviço CABELO + BARBA não encontrado')

  const { response: horarios30Res, json: horarios30Json } = await requestJson(
    `/api/horarios?data=${TEST_DATE}&servico_codigo=barba`
  )
  assert(horarios30Res.ok, `Falha ao buscar horários BARBA: ${JSON.stringify(horarios30Json)}`)

  const { response: horarios60Res, json: horarios60Json } = await requestJson(
    `/api/horarios?data=${TEST_DATE}&servico_codigo=cabelo_barba`
  )
  assert(horarios60Res.ok, `Falha ao buscar horários CABELO + BARBA: ${JSON.stringify(horarios60Json)}`)

  const horarios30 = horarios30Json?.horarios || []
  const horarios60 = horarios60Json?.horarios || []
  assert(Array.isArray(horarios30), 'Resposta de horários 30 min inválida')
  assert(Array.isArray(horarios60), 'Resposta de horários 60 min inválida')

  console.log(`Horários BARBA: ${horarios30.length}`)
  console.log(`Horários CABELO + BARBA: ${horarios60.length}`)
  assert(
    horarios60.length <= horarios30.length,
    'Serviço de 60 min retornou mais horários que serviço de 30 min'
  )

  const slot = horarios30[0]
  if (!slot) {
    console.log('Nenhum horário livre para testar reserva. APIs de listagem responderam corretamente.')
    return
  }

  const { response: reservaRes, json: reservaJson } = await requestJson('/api/reservar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: TEST_DATE,
      hora_inicio: slot.hora_inicio,
      servico_id: barba.id,
      nome: TEST_NAME,
      celular: TEST_PHONE,
    }),
  })

  assert(reservaRes.ok, `Falha ao reservar slot teste: ${JSON.stringify(reservaJson)}`)
  const agendamentoId = reservaJson?.agendamento?.id
  assert(agendamentoId, 'Reserva criada sem ID retornado')
  console.log(`Reserva criada: ${agendamentoId}`)

  const { response: cancelarRes, json: cancelarJson } = await requestJson('/api/cancelar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: agendamentoId }),
  })

  assert(cancelarRes.ok, `Falha ao cancelar reserva teste: ${JSON.stringify(cancelarJson)}`)
  console.log('Reserva de teste cancelada com sucesso.')
  console.log('Smoke test concluído com sucesso.')
}

main().catch((error) => {
  console.error('Smoke test falhou.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})