# Sistema de Agendamento — Conceito Barbearia

<p align="center">
  <img src="/public/logo.png" alt="Conceito Barbearia Logo" width="250"/>
</p>

<p align="center">
  Sistema de agendamento online desenvolvido especificamente para a barbearia <strong>Conceito Barbearia</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black"/>
  <img src="https://img.shields.io/badge/TypeScript-5-blue"/>
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-green"/>
  <img src="https://img.shields.io/badge/Vercel-Deploy-black"/>
</p>

---

# 📖 Sobre o Projeto

Este projeto é um **sistema de agendamento online desenvolvido exclusivamente para a barbearia Conceito Barbearia**.

O objetivo do sistema é permitir que clientes realizem agendamentos de forma simples, rápida e intuitiva, enquanto a barbearia possui controle completo sobre a agenda de atendimentos.

O sistema foi desenvolvido com foco em:

- simplicidade de uso
- organização da agenda
- prevenção de conflitos de horário
- controle administrativo dos agendamentos

---

# ✂️ Funcionalidades

## Agendamento Online

Clientes podem:

- escolher o serviço desejado
- selecionar a data
- visualizar horários disponíveis
- realizar o agendamento rapidamente

---

## Agenda Inteligente

O sistema possui uma lógica de agenda dinâmica que permite:

- encaixe automático de horários
- serviços com duração variável
- prevenção automática de sobreposição de atendimentos
- cálculo automático do horário final

---

## Gestão de Serviços

A barbearia pode configurar:

- serviços disponíveis
- duração de cada serviço
- valor de cada serviço

---

## Controle da Agenda

O sistema permite:

- bloqueio manual de horários
- criação de pausas na agenda
- controle completo da disponibilidade

---

# 🧠 Lógica da Agenda

Diferente de sistemas que usam intervalos fixos (ex: 30 minutos), este sistema utiliza **duração real por serviço**.

Exemplo:

| Serviço | Duração |
|------|------|
| Corte | 40 min |
| Barba | 30 min |
| Corte + Barba | 60 min |
| Acabamento | 10 min |

O sistema calcula automaticamente:

```
hora_inicio + duração_do_serviço = hora_fim
```

Além disso, o sistema impede automaticamente **conflitos de horário entre atendimentos**.

---

# ⏰ Horário de Funcionamento

Segunda a Sexta

```
08:30 - 12:00
14:00 - 19:00
```

Regras aplicadas:

- pausa automática no almoço
- último horário permitido para início: **19:00**
- horários gerados dinamicamente

---

# 🏗 Arquitetura do Projeto

Estrutura principal do projeto:

```
/app
/components
/lib
/db
   /migrations
/scripts
/public

package.json
tsconfig.json
next.config.ts
```

### /app

Contém as rotas e páginas do Next.js.

---

### /components

Componentes reutilizáveis da interface.

---

### /lib

Funções auxiliares e lógica de negócio.

Exemplos:

- cálculo de horários
- verificação de conflitos de agenda
- integração com Supabase

---

### /db/migrations

Scripts SQL utilizados para evolução da estrutura do banco de dados.

---

### /scripts

Scripts SQL auxiliares utilizados para manutenção e verificação do banco.

---

# 🗄 Banco de Dados

O banco de dados é gerenciado utilizando **Supabase (PostgreSQL)**.

Principais tabelas do sistema:

### agendamentos

Armazena todos os agendamentos realizados.

Campos principais:

- data
- hora_inicio
- hora_fim
- nome_cliente
- celular_cliente
- servico_nome
- servico_duracao_minutos
- servico_preco
- status_agendamento

---

### horarios_customizados

Permite criar horários específicos para datas específicas.

---

### bloqueios

Permite bloquear horários manualmente na agenda.

---

# 🚀 Tecnologias Utilizadas

Este projeto foi desenvolvido utilizando:

- **Next.js**
- **React**
- **TypeScript**
- **Supabase**
- **PostgreSQL**
- **TailwindCSS**
- **Vercel**

---

# 💻 Como Rodar o Projeto

## 1️⃣ Clonar o repositório

```
git clone https://github.com/seu-usuario/conceito-barbearia.git
```

---

## 2️⃣ Instalar dependências

```
npm install
```

ou

```
yarn install
```

---

## 3️⃣ Criar arquivo de ambiente

Crie um arquivo:

```
.env.local
```

Exemplo:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 4️⃣ Rodar o projeto

```
npm run dev
```

O sistema ficará disponível em:

```
http://localhost:3000
```

---

# 🌐 Deploy

O deploy do projeto é realizado utilizando **Vercel**.

Cada commit enviado para o repositório gera automaticamente um novo deploy.

---

# 📄 Licença

Este projeto foi desenvolvido para uso específico da **Conceito Barbearia**.

---

# 👨‍💻 Desenvolvedor

**Lucas Siconeli**

Desenvolvedor responsável pelo sistema de agendamento da **Conceito Barbearia**.

---


