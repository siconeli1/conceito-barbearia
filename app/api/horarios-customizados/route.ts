import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function getHorariosErrorMessage(error: { code?: string; message: string }) {
  if (error.code === "42P01") {
    return 'Tabela "horarios_customizados" nao encontrada. Execute o arquivo create_horarios_table.sql no Supabase.'
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

    const { data: horarios, error } = await supabase
      .from("horarios_customizados")
      .select("*")
      .eq("data", data)
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ horarios: horarios || [] })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao listar horarios." },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { data, hora_inicio, hora_fim } = body

    if (!data || !hora_inicio || !hora_fim) {
      return NextResponse.json(
        { erro: "Data, hora de inicio e hora de fim sao obrigatorias." },
        { status: 400 }
      )
    }

    if (hora_inicio >= hora_fim) {
      return NextResponse.json(
        { erro: "Hora de fim deve ser apos hora de inicio." },
        { status: 400 }
      )
    }

    const { data: existing, error: existingError } = await supabase
      .from("horarios_customizados")
      .select("id")
      .eq("data", data)
      .eq("hora_inicio", hora_inicio)
      .eq("hora_fim", hora_fim)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(existingError) },
        { status: 500 }
      )
    }

    if (existing) {
      return NextResponse.json(
        { erro: "Este horario ja foi cadastrado." },
        { status: 400 }
      )
    }

    const { data: horario, error } = await supabase
      .from("horarios_customizados")
      .insert([{ data, hora_inicio, hora_fim }])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json(horario)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao criar horario." },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ erro: "ID do horario obrigatorio." }, { status: 400 })
    }

    const { error } = await supabase
      .from("horarios_customizados")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { erro: getHorariosErrorMessage(error) },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao deletar horario." },
      { status: 500 }
    )
  }
}
