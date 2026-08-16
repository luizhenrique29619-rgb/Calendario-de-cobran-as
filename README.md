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
| **Backup** | Exporta e importa `.json`, e exporta `.csv` para abrir no Excel. |
| **Tema claro/escuro** | Segue a preferência do sistema e pode ser trocado a qualquer momento. |

## Onde ficam os dados

Tudo é salvo no **`localStorage` do próprio navegador**. Nada é enviado para nenhum servidor.

Consequências práticas:

- Os dados ficam **no aparelho e no navegador em que você cadastrou**. Cadastrou no celular, não aparece no notebook.
- Limpar os dados de navegação do site apaga as cobranças.
- **Faça backup**: menu `Dados → Exportar backup (.json)`. Para restaurar (ou levar para outro aparelho), use `Dados → Importar backup (.json)`.

Se no futuro você precisar acessar as mesmas cobranças de vários aparelhos, será preciso
adicionar um banco de dados (Vercel Postgres, Supabase ou similar) — o front-end atual já
fica pronto para isso, bastando trocar a camada `assets/js/store.js`.

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
│       ├── app.js          # interface, eventos e renderização
│       ├── store.js        # leitura/gravação e regras de recorrência
│       └── utils.js        # datas, moeda e formatação
├── vercel.json             # configuração da publicação
└── README.md
```

## Dicas de uso

- **Mensalidade fixa**: cadastre com `Repetir → Todo mês` e `12` parcelas para gerar o ano inteiro.
- **Recebeu?** Clique no ✓ do item — ele guarda a data do recebimento e entra no total "Recebido no mês".
- **Cobrança parecida**: use o ⧉ para duplicar e só ajustar a data.
- **Telefone**: pode digitar com máscara — `(11) 98888-7777` funciona. O DDI 55 é acrescentado sozinho.
