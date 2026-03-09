import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getAgendaErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42P01") {
    return 'Tabela "agendamentos" nao encontrada no Supabase.'
  }

  return error.message
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const data = searchParams.get("data")

    if (!data) {
      return NextResponse.json({ erro: "Data obrigatoria." }, { status: 400 })
    }

    const { data: agendamentos, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("data", data)
      .in("status", ["agendado", "ativo"])
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: getAgendaErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json(agendamentos || [])
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao carregar agenda." },
      { status: 500 }
    )
  }
}
