import AgendarClient from './AgendarClient'
import { listarServicosAtivos } from '@/lib/servicos'

export default async function AgendarPage() {
  let servicos = []
  let initialErro: string | undefined

  try {
    servicos = await listarServicosAtivos()
  } catch {
    initialErro = 'Erro ao carregar serviços'
  }

  return <AgendarClient initialServicos={servicos} initialErro={initialErro} />
}
