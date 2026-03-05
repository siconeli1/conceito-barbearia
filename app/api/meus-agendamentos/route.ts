import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const celular = searchParams.get("celular")

    if (!celular) {
      return NextResponse.json(
        { erro: "Celular não informado" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("celular_cliente", celular)
      .order("data", { ascending: true })

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      agendamentos: data || []
    })

  } catch (err) {
    return NextResponse.json(
      { erro: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}