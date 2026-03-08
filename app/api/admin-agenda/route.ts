import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url)
  const data = searchParams.get("data")

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("data", data)
    .in("status", ["agendado", "ativo"])
    .order("hora_inicio", { ascending: true })

  if (error) {
    return NextResponse.json({ error })
  }

  return NextResponse.json(agendamentos)
}