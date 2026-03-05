import Link from 'next/link'

const WHATSAPP_NUMBER = '5517999999999' // <-- troque para o número real (DDI+DDD+número)
const WHATSAPP_MSG = encodeURIComponent('Olá! Quero agendar um horário na Conceito Barbearia.')

export default function HomePage() {
  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontSize: 34, marginBottom: 8 }}>Conceito Barbearia</h1>
        <p style={{ opacity: 0.85, marginBottom: 24 }}>
          Agende seu horário em poucos cliques.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/agendar"
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#111',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Agendar horário
          </Link>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#22c55e', // verde forte
              color: '#ffffff',
              textDecoration: 'none',
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            Falar no WhatsApp
          </a>

          <Link
            href="/meus-agendamentos"
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Meus agendamentos
          </Link>
        </div>
      </div>
    </main>
  )
}