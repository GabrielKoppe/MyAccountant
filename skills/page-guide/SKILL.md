# SKILL — Guia de página (PageInfoButton / PageInfoDialog)

## Quando usar

Sempre que uma página/hub precisar de conteúdo **educativo e contextual** ("o que é isso e como uso"), exibido sob demanda num dialog paginado. É o padrão único do projeto para "ajuda da página" — não invente um popover/tooltip/drawer alternativo.

Exemplos em produção: `net-worth` (`NetWorthManager`), `forecast` (`ForecastManager`), `planning` (hub, `planning/layout.tsx`).

---

## 1. Peças

| Arquivo | Papel |
|---|---|
| `src/lib/page-guide.ts` | Tipos (`GuideBlock`, `GuidePage`, `PageGuide`). Só tipos, sem runtime. |
| `src/components/ui/PageInfoDialog.tsx` | Dialog paginado (usa `DialogShell`). Renderiza o vocabulário fixo de blocos. |
| `src/components/ui/PageInfoButton.tsx` | `IconButton` discreto (info) que abre o dialog. Único ponto de consumo na UI. |
| `src/lib/messages/pt-BR.ts` | Conteúdo dos guias (`<feature>.guide satisfies PageGuide`). |

---

## 2. Vocabulário de blocos (`GuideBlock`)

Union discriminada por `kind`. **Não adicione um `kind` novo sem também:** (a) adicionar o `case` em `GuideBlockView` (o `default: never` do switch força isso no typecheck), e (b) atualizar esta tabela.

| `kind` | Campos | Uso |
|---|---|---|
| `text` | `text` | Parágrafo corrido. |
| `list` | `items[]` | Bullets (não ordenada). |
| `steps` | `items[]` | Passos numerados. |
| `tip` | `tone: "info"\|"warning"\|"success"`, `text`, `title?` | Destaque (`Alert`). Tom = significado, não decoração. |
| `example` | `title`, `text` | Caixa de exemplo (borda + `background.subtle`). |

---

## 3. Convenções

- **1 `PageInfoButton` por página/hub**, sempre no `actions` do `PageHeader` (primeiro item, antes das ações de mutação). Aparece para **todos os papéis** (inclusive `viewer`) — o guia é informativo.
- **Conteúdo sempre em `pt-BR.ts`** como `<feature>.guide`, tipado com **`satisfies PageGuide`** (preserva a union discriminada de `kind`, sem widening para `string`). Nunca strings soltas no componente.
- **Consuma só via `PageInfoButton`.** Não instancie `PageInfoDialog` direto na página.
- **Só tokens semânticos** (`accent.primary`, `border.subtle`, `background.subtle`, etc.). Zero hex.
- **Motion**: só `opacity`/`transform` (ver skill `mui-motion`); fallback `prefers-reduced-motion` obrigatório.
- **Densidade**: mantenha cada página do guia leve; se um passo acumular texto + `steps` longos + `tip`, prefira quebrar em duas páginas.

---

## 4. Exemplo mínimo

```ts
// pt-BR.ts
netWorth: {
  guide: {
    title: "Patrimônio",
    pages: [
      {
        heading: "O que é",
        blocks: [
          { kind: "text", text: "Acompanhe a evolução do seu patrimônio." },
          { kind: "tip", tone: "info", text: "Contas paradas ~35 dias ficam desatualizadas." },
        ],
      },
    ],
  } satisfies PageGuide,
},
```

```tsx
// PageHeader da página
<PageHeader
  title={m.netWorth.title}
  actions={<PageInfoButton guide={m.netWorth.guide} />}
/>
```
