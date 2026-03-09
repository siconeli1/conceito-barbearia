import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getBloqueiosErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42P01") {
    return 'Tabela "bloqueios_agenda" nao encontrada. Execute o SQL de criacao da tabela.'
  }

  return error.message
}

export async function GET() {
  try {
    const { data: bloqueios, error } = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .order("data", { ascending: false })
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: getBloqueiosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ bloqueios: bloqueios || [] })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao listar bloqueios." },
      { status: 500 }
    )
  }
}
