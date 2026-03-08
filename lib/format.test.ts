import { formatarData, converterParaISO, formatarCelular } from "./format"

describe("helpers de formatação", () => {
  test("formatarData converte corretamente", () => {
    expect(formatarData("07032026")).toBe("07/03/2026")
    expect(formatarData("0703")).toBe("07/03")
    expect(formatarData("07")).toBe("07")
    expect(formatarData("")).toBe("")
  })

  test("converterParaISO retorna null para dados inválidos", () => {
    expect(converterParaISO("07/03/2026"))
      .toBe("2026-03-07")
    expect(converterParaISO("07032026")).toBeNull()
    expect(converterParaISO("07/03/26")).toBeNull()
  })

  test("formatarCelular mantém apenas dígitos e insere máscara", () => {
    expect(formatarCelular("11987654321")).toBe("(11) 98765-4321")
    expect(formatarCelular("112345")).toBe("(11) 2345")
    expect(formatarCelular("1")).toBe("(1")
    expect(formatarCelular("")).toBe("")
  })
})
