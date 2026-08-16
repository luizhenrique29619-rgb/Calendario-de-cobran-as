# 📅 Agenda de Cobranças

Site simples para controlar **quem te deve, quanto e quando vence**. Mostra as cobranças
em um calendário mensal, avisa o que está atrasado e gera o link de cobrança no WhatsApp.

Feito em HTML, CSS e JavaScript puro — **sem build, sem dependências, sem servidor**.
Basta subir na Vercel e usar.

---

## O que ele faz

| Recurso | Descrição |
|---|---|
| **Calendário mensal** | Cada dia mostra as cobranças que vencem e o total do dia. Clique em um dia para ver os detalhes. |
| **Indicadores** | A receber no mês, recebido no mês, total em atraso e o que vence nos próximos 7 dias. |
| **Cadastro completo** | Cliente, WhatsApp, descrição, valor, vencimento, status e observações. |
| **Recorrência** | Repete a cobrança por semana, quinzena, mês ou ano — até 60 parcelas de uma vez. |
| **Status automático** | Uma cobrança pendente com vencimento vencido aparece sozinha como **atrasada**. |
| **Cobrança no WhatsApp** | Botão 💬 abre a conversa com a mensagem de lembrete já escrita. |
| **Agenda compartilhada** | Com o banco configurado, várias pessoas veem e editam a mesma agenda, cada uma com seu login. |
| **Backup** | Exporta e importa `.json`, e exporta `.csv` para abrir no Excel. |
| **Tema claro/escuro** | Segue a preferência do sistema e pode ser trocado a qualquer momento. |

## Onde ficam os dados: dois modos

O site funciona de duas formas, e quem decide é o arquivo `assets/js/config.js`.

### Modo local (padrão, sem configurar nada)

Tudo é salvo no `localStorage` do próprio navegador. Nada sai do aparelho.

- As cobranças ficam **só no navegador em que você cadastrou**. Cadastrou no celular, não aparece no notebook — e outra pessoa que abrir o link vê a agenda vazia.
- Limpar os dados de navegação do site apaga as cobranças.
- Uma faixa amarela no topo lembra disso enquanto o modo estiver ativo.

### Modo compartilhado (Supabase)

As cobranças ficam num banco de dados e todo mundo que tem acesso enxerga **a mesma
agenda**, de qualquer aparelho, protegida por login com e-mail e senha.

Passo a passo:

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e um projeto novo.
2. Abra `supabase/schema.sql` deste repositório. **No final do arquivo, troque os dois
   e-mails de exemplo** pelos e-mails de quem vai usar a agenda.
3. No Supabase, vá em **SQL Editor → New query**, cole o arquivo inteiro e clique em **Run**.
4. Vá em **Project Settings → API** e copie:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
5. Cole os dois valores em `assets/js/config.js` e envie para o GitHub. A Vercel republica sozinha.
6. Abra o site, clique em **"Não tenho conta ainda"** e crie a conta com o e-mail que você
   liberou no passo 2. Sua colega faz o mesmo com o e-mail dela.

Se você já tinha cobranças cadastradas no modo local, ao entrar pela primeira vez o site
oferece **enviá-las para a agenda compartilhada** com um clique (e baixa um backup antes,
por segurança).

#### Quem consegue ver os dados

A chave `anon` é pública de propósito — ela vai no código do site e qualquer visitante
consegue lê-la. Quem protege os dados são as regras de acesso (RLS) criadas pelo
`schema.sql`: **só os e-mails cadastrados na tabela `membros` enxergam alguma coisa.**
Quem criar uma conta com outro e-mail recebe um aviso e não vê nada.

Para liberar mais alguém depois, rode no SQL Editor:

```sql
insert into public.membros (email) values ('nova.pessoa@email.com');
```

E para remover o acesso:

```sql
delete from public.membros where email = 'pessoa@email.com';
```

> **Nunca** coloque em `config.js` a chave `service_role` do Supabase: ela ignora todas as
> regras de acesso e daria acesso total a qualquer visitante do site.

---

## Publicando na Vercel

### Opção 1 — pelo site (mais fácil)

1. Faça o push deste repositório para o GitHub.
2. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório.
3. Em **Framework Preset**, deixe **Other**. Não preencha *Build Command* nem *Output Directory*.
4. Clique em **Deploy**. Em poucos segundos o site estará no ar.

Cada novo push para a branch principal republica o site automaticamente.

### Opção 2 — pelo terminal

```bash
npm i -g vercel
vercel          # publica um preview
vercel --prod   # publica em produção
```

---

## Rodando no seu computador

Como o projeto usa módulos JavaScript (`type="module"`), abrir o `index.html` com dois
cliques não funciona — é preciso um servidor local:

```bash
# com Python
python3 -m http.server 3000

# ou com Node
npx serve .
```

Depois abra <http://localhost:3000>.

---

## Estrutura

```
.
├── index.html              # a página inteira
├── assets/
│   ├── css/styles.css      # estilos e temas
│   └── js/
│       ├── config.js       # ←← chaves do Supabase (vazio = modo local)
│       ├── app.js          # interface, eventos e renderização
│       ├── store.js        # regras de negócio; escolhe entre nuvem e local
│       ├── supabase.js     # login e acesso ao banco, via fetch
│       └── utils.js        # datas, moeda e formatação
├── supabase/schema.sql     # tabelas e regras de acesso do banco
├── vercel.json             # configuração da publicação
└── README.md
```

## Dicas de uso

- **Mensalidade fixa**: cadastre com `Repetir → Todo mês` e `12` parcelas para gerar o ano inteiro.
- **Recebeu?** Clique no ✓ do item — ele guarda a data do recebimento e entra no total "Recebido no mês".
- **Cobrança parecida**: use o ⧉ para duplicar e só ajustar a data.
- **Telefone**: pode digitar com máscara — `(11) 98888-7777` funciona. O DDI 55 é acrescentado sozinho.
