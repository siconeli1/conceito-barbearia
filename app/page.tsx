import Link from "next/link"
import Image from "next/image"

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="mb-12 flex justify-center">
            <Image
              src="/logo.png"
              alt="Conceito Barbearia"
              width={550}
              height={700}
              priority
              className="h-auto w-auto max-w-md sm:max-w-2xl"
            />
          </div>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto text-base sm:text-lg">
            Excelência e sofisticação em cada detalhe
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/agendar"
              className="px-6 py-3 sm:px-8 sm:py-3 bg-white text-black font-semibold hover:bg-gray-200 transition-colors text-base sm:text-sm"
            >
              Agendar Horário
            </Link>
            <Link
              href="/meus-agendamentos"
              className="px-6 py-3 sm:px-8 sm:py-3 border border-white text-white hover:bg-white/10 transition-colors text-base sm:text-sm"
            >
              Meus Agendamentos
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border border-white mb-6 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Rápido</h3>
              <p className="text-gray-400">Agende em segundos</p>
            </div>

            <div className="text-center">
              <div className="inline-block w-12 h-12 border border-white mb-6 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Seguro</h3>
              <p className="text-gray-400">Seus dados protegidos</p>
            </div>

            <div className="text-center">
              <div className="inline-block w-12 h-12 border border-white mb-6 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Flexível</h3>
              <p className="text-gray-400">Cancele quando precisar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hours Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-semibold text-center mb-12">Horários</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-center">
          <div className="border-l border-white/20 pl-8">
            <p className="text-gray-400 mb-2">Segunda a Sexta</p>
            <p className="text-2xl font-semibold">08:30 - 12:00</p>
          </div>
          <div className="border-l border-white/20 pl-8">
            <p className="text-gray-400 mb-2">Retorno e encerramento</p>
            <p className="text-2xl font-semibold">14:00 - 20:00</p>
            <p className="text-sm text-gray-500 mt-2">Ultimo horario para iniciar atendimento: 19:00</p>
          </div>
        </div>
      </div>
    </main>
  )
}
