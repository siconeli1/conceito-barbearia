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

    const { data: bloqueios, error } = await supabase
      .from("bloqueios_agenda")
      .select("*")
      .eq("data", data)
      .order("hora_inicio", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ bloqueios: bloqueios || [] })
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao listar bloqueios" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      data,
      hora_inicio,
      hora_fim,
      dia_inteiro,
      motivo,
    } = body

    if (!data) {
      return NextResponse.json(
        { erro: "A data é obrigatória" },
        { status: 400 }
      )
    }

    const { data: bloqueio, error } = await supabase
      .from("bloqueios_agenda")
      .insert([
        {
          data,
          hora_inicio: dia_inteiro ? null : hora_inicio || null,
          hora_fim: dia_inteiro ? null : hora_fim || null,
          dia_inteiro: !!dia_inteiro,
          motivo: motivo || null,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(bloqueio)
  } catch {
    return NextResponse.json(
      { erro: "Erro interno ao criar bloqueio" },
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
        { erro: "ID do bloqueio é obrigatório" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("bloqueios_agenda")
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
      { erro: "Erro interno ao deletar bloqueio" },
      { status: 500 }
    )
  }
}
