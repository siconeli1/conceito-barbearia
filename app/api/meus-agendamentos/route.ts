import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { syncAutoClosedAgendamentos } from "@/lib/agendamento"
import { getCustomerAccessCode, normalizePhone } from "@/lib/phone"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const celular = normalizePhone(searchParams.get("celular"))
    const codigo = String(searchParams.get("codigo") ?? "").trim().toUpperCase()

    if (!celular || !codigo) {
      return NextResponse.json(
        { erro: "Celular e codigo de acesso sao obrigatorios" },
        { status: 400 }
      )
    }

    const codigoEsperado = await getCustomerAccessCode(celular)
    if (codigo !== codigoEsperado) {
      return NextResponse.json(
        { erro: "Codigo de acesso invalido" },
        { status: 401 }
      )
    }

    const { data: agendamentosRaw, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("celular_cliente", celular)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    const data = await syncAutoClosedAgendamentos(agendamentosRaw || [])

    return NextResponse.json({
      agendamentos: data || []
    })

  } catch {
    return NextResponse.json(
      { erro: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
