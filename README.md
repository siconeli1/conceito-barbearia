# Conceito Barbearia

<p align="center">
  <img src="/public/logo.png" alt="Conceito Barbearia Logo" width="180"/>
</p>

<p align="center">
  Sistema moderno de agendamento online para barbearias.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black"/>
  <img src="https://img.shields.io/badge/TypeScript-5-blue"/>
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-green"/>
  <img src="https://img.shields.io/badge/Vercel-Deploy-black"/>
</p>

---

# 📖 Sobre o Projeto

O **Conceito Barbearia** é um sistema web de agendamento online desenvolvido para simplificar a gestão de horários em barbearias.

O sistema permite que clientes realizem agendamentos de forma rápida e intuitiva, enquanto o administrador possui controle total sobre horários, serviços e disponibilidade da agenda.

O projeto foi desenvolvido com foco em:

- experiência do usuário
- organização da agenda
- escalabilidade do sistema
- facilidade de manutenção

---

# ✂️ Funcionalidades

## Agendamento Online

- escolha de serviço
- seleção de data
- visualização de horários disponíveis
- reserva rápida de horário

## Agenda Inteligente

- cálculo dinâmico de horários
- encaixe automático de atendimentos
- duração variável por serviço
- prevenção de conflitos de agenda

## Gestão de Serviços

- cadastro de serviços
- definição de duração
- definição de preço
- atualização dinâmica

## Bloqueio de Horários

- bloqueio manual de horários
- bloqueios personalizados
- pausas automáticas (almoço)

## Painel Administrativo

- visualização de agendamentos
- gestão de horários
- controle da agenda

---

# 🧠 Lógica da Agenda

O sistema não utiliza intervalos fixos de atendimento.

Cada serviço possui sua própria duração.

Exemplo:

| Serviço | Duração |
|------|------|
| Corte | 40 min |
| Barba | 30 min |
| Corte + Barba | 60 min |
| Acabamento | 10 min |

A agenda calcula automaticamente:
hora_inicio + duração_serviço = hora_fim

O sistema também impede sobreposição de horários.

---

# ⏰ Horário de Funcionamento

Segunda a Sexta
08:30 - 12:00
14:00 - 19:00


Regras:

- pausa automática no almoço
- último horário permitido para início: **19:00**
- horários calculados dinamicamente

---

# 🏗 Arquitetura do Sistema

Estrutura principal do projeto:
/app
/components
/lib
/db
/public

package.json
tsconfig.json
next.config.ts


Descrição das pastas:

### /app
Rotas e páginas do Next.js.

### /components
Componentes reutilizáveis da interface.

### /lib
Funções auxiliares e lógica de negócio.

Exemplos:

- cálculo de horários
- verificação de conflitos
- integração com Supabase

### /db/migrations
Scripts SQL utilizados para evolução do banco de dados.

---

# 🗄 Banco de Dados

O banco de dados é gerenciado pelo **Supabase (PostgreSQL)**.

Principais tabelas:

### agendamentos

Armazena os agendamentos realizados.

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

### horarios_customizados

Permite criar horários específicos para datas.

### bloqueios

Permite bloquear horários manualmente.

---

# 🚀 Tecnologias Utilizadas

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
git clone https://github.com/siconei1/conceito-barbearia.git

---

## 2️⃣ Instalar dependências
npm install

---

## 3️⃣ Criar arquivo de ambiente

Crie um arquivo:
.env.local

Exemplo:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

---

## 4️⃣ Rodar o projeto
npm run dev

O projeto está disponível em:
http://localhost:3000

---

# 🌐 Deploy

O deploy é realizado utilizando **Vercel**.

Cada commit na branch principal gera automaticamente um novo deploy.

---

# 📈 Melhorias Futuras

Possíveis evoluções do projeto:

- confirmação de agendamento via WhatsApp
- lembrete automático de horários
- sistema de autenticação para clientes
- dashboard analítico
- sistema multi-barbearia (SaaS)

---

# 🤝 Contribuição

Contribuições são bem-vindas.

Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch
3. Faça suas alterações
4. Abra um Pull Request

---

# 📄 Licença

Este projeto está sob a licença MIT.

---

# 👨‍💻 Autor

**Lucas Siconeli**

Desenvolvedor do sistema **Conceito Barbearia**.

---



