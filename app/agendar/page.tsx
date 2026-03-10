import AgendarClient from './AgendarClient'
import { listarServicosAtivos, type Servico } from '@/lib/servicos'

export default async function AgendarPage() {
  let servicos: Servico[] = []
  let initialErro: string | undefined

  try {
    servicos = await listarServicosAtivos()
  } catch {
    initialErro = 'Erro ao carregar serviços'
  }

  return <AgendarClient initialServicos={servicos} initialErro={initialErro} />
}
