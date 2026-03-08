import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const data = searchParams.get("data")

    if (!data) {
      return NextResponse.json(
        { erro: "Data é obrigatória" },
        { status: 400 }
      )
    }

    const { data: horarios, error } = await supabase
      .from("horarios_customizados")
      .select("*")
      .eq("data", data)
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ horarios: horarios || [] })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao listar horários" },
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
        { erro: "Data, hora de início e hora de fim são obrigatórias" },
        { status: 400 }
      )
    }

    if (hora_inicio >= hora_fim) {
      return NextResponse.json(
        { erro: "Hora de fim deve ser após hora de início" },
        { status: 400 }
      )
    }

    // Verifica se já existe
    const { data: existing } = await supabase
      .from("horarios_customizados")
      .select("id")
      .eq("data", data)
      .eq("hora_inicio", hora_inicio)
      .eq("hora_fim", hora_fim)
      .single()

    if (existing) {
      return NextResponse.json(
        { erro: "Este horário já foi cadastrado" },
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
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(horario)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao criar horário" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { erro: "ID do horário é obrigatório" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("horarios_customizados")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao deletar horário" },
      { status: 500 }
    )
  }
}
