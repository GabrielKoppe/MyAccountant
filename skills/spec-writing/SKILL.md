# SKILL — Criação de Specs (Modelo V2+, Specs 18+)

## Quando usar

Sempre que criar ou revisar uma spec no projeto MyAccountant. Este skill define o **formato canônico, estrutura, qualidade e checklist** para specs no estilo "V2+" (a partir da spec 18), que seguem um modelo mais rigoroso, orientado a problemas concretos e critérios verificáveis.

> **Diferença entre V1 (01–17) e V2+ (18+):** Specs V1 são descritivas — explicam o que deve ser construído. Specs V2+ são orientadas a problemas — partem de um problema concreto, propõem solução mínima necessária, e definem critérios de aceitação em formato QUANDO/SE/ENTÃO verificáveis por código ou por teste manual.

---

## Anatomia de uma spec V2+

```
specs/NN-nome-kebab.md
```

### Cabeçalho obrigatório

```markdown
# Spec NN — Título em Português (Imperativo, máx. 60 chars)

> Status: draft | ready | approved
> Insumo: <referência a documento, seção de análise ou código fonte>
> Skills: [`skill-name`](../skills/skill-name/SKILL.md) · ...

---
```

| Campo | Valores e semântica |
|---|---|
| `Status` | `draft` = rascunho em elaboração; `ready` = completo, aguardando aprovação; `approved` = aprovado, pode ser implementado |
| `Insumo` | De onde veio a spec. Referenciar `docs/v2-analysis.md §N UX-XX` (se análise formal existir), seção de SKILL, ou `revisão de código em src/...` para specs de refatoração |
| `Skills` | Todos os skills aplicáveis na implementação, linkados relativamente |

### Seções

| # | Título | Obrigatória | Propósito |
|---|---|---|---|
| 1 | `Problema` | ✅ | Descrever **o que está errado hoje**, com localização exata no código ou UX. Usar bullets com identificadores (`FEAT-01`, `UX-02`, `DLG-03`, etc.) para referenciar nos critérios. |
| 2 | `Solução` | ✅ | Descrever **o que será feito**, mapeado 1-para-1 com os bullets do Problema. Nunca inventar solução para problema não descrito na §1. |
| 3 | `User Stories` | ✅ | Bullets no formato "Como [papel], quero [ação/resultado], para [motivação]." Mínimo 2, máximo 8. |
| 4 | `Critérios de Aceitação` | ✅ | Formato **QUANDO / SE / ENQUANTO + sujeito + DEVE / NÃO DEVE**. Um critério por bullet. Agrupados por identificador de problema quando há múltiplos grupos. |
| 5 | `Fora de Escopo` | ✅ | Bullets listando o que **explicitamente não** está incluso. Fundamental para evitar scope creep. |
| 6 | `Decisões de Design` | ⚠️ Opcional | Tabela de decisões quando há trade-offs que precisam ser registrados. Colunas: Decisão · Escolha · Motivo. |
| 6 ou 7 | `Referências Técnicas` | ✅ | Tabela de itens → arquivos a tocar. Sempre incluir código de referência/implementação para os padrões mais complexos. |

---

## Regras de conteúdo

### §1 Problema — obrigatórios

- **Sempre identificar arquivo e linha** quando o problema é de código. Exemplo: `em TransactionRow.tsx:91–103, saveEdit() não inclui notes no payload`.
- **Identificadores consistentes** (`BUG-01`, `UX-02`, `FEAT-01`, `DLG-03`, etc.): escolher o prefixo pelo tipo do problema e manter no mesmo bloco de specs.
- **Nunca inventar problemas vagos** ("o código poderia ser melhor"). Problema precisa ser observável e localizável.
- **Quantidade**: tipicamente 2 a 8 problemas por spec. Acima disso, considerar dividir em duas specs.

### §2 Solução — obrigatórios

- Deve **mapear 1-para-1** com os identificadores da §1. Se o Problema tem `BUG-01` e `BUG-02`, a Solução deve endereçar `BUG-01` e `BUG-02`.
- **Nunca incluir na solução** algo não descrito na §1 como problema.
- Descrição deve ser **prescritiva mas não excessivamente detalhada** — detalhes de implementação vão na §6/7 Referências Técnicas.
- Para soluções com múltiplas partes, usar subseções `### 2.1` e `### 2.2`.

### §4 Critérios de Aceitação — obrigatórios

- Formato: `QUANDO [contexto/ação], [SUJEITO] DEVE [resultado esperado]`.
- Variantes permitidas: `SE [condição], DEVE...` · `ENQUANTO [estado], DEVE...` · `NÃO DEVE...`.
- Cada critério DEVE ser verificável: pode-se escrever um teste ou checar manualmente com passos definidos.
- **Nunca critério vago**: "deve funcionar corretamente", "deve ser rápido", "deve parecer bom" — descartados.
- Agrupar por identificador do problema quando a spec tem múltiplos grupos (`**BUG-01:**` como subseção).

### §5 Fora de Escopo — obrigatórios

- Listar explicitamente **tudo que poderia ser esperado** mas não está incluído.
- Especialmente importante quando a solução é intencionalmente incompleta (ex: "renderização de Markdown fica para spec futura").
- Serve como registro de decisões de escopo: por que não foi incluído (ex: "paginação — o usuário explicitamente não quer paginação").

### §7 Referências Técnicas — obrigatórios

- Tabela `Item | Arquivo(s) a tocar` com caminho completo a partir de `src/`.
- Incluir **código de referência** para os padrões mais importantes — o implementador deve ter um exemplo de como fazer certo.
- Se há padrão a **não seguir**, incluir o anti-padrão comentado com `// ❌` ao lado do padrão correto `// ✅`.

---

## Numeração e nomenclatura

- Número sequencial a partir do último spec existente. Nunca reutilizar números.
- Verificar o maior número em `specs/` antes de atribuir: `ls specs/ | sort -n | tail -5`.
- Nome do arquivo: `NN-nome-em-kebab-case.md` — descritivo, sem artigos, máx. 40 chars após o número.
- Título da spec (`# Spec NN —`): em português, começando com substantivo ou gerúndio (não verbo imperativo), máx. 60 chars. Ex: "Reformulação dos Dialogs", "Melhorias de UX nas Transações", "Busca e Filtro de Transações".

---

## Status e fluxo de aprovação

```
draft → ready → approved → implementado (spec não muda mais)
```

- `draft`: rascunho em elaboração. Pode ter seções incompletas. Não implementar.
- `ready`: todas as seções obrigatórias completas, revisado pelo desenvolvedor. Aguarda aprovação formal.
- `approved`: aprovado. Pode ser implementado. Não alterar sem criar nova spec ou atualizar a existente (registrar a mudança).
- **Regra de ouro**: se a implementação divergir do spec, atualizar o spec **antes** de continuar (spec-anchored development).

---

## Checklist de revisão antes de mudar para `ready`

**Cabeçalho**
- [ ] Status, Insumo e Skills preenchidos
- [ ] Skills linkados corretamente (link relativo `../skills/nome/SKILL.md`)

**Conteúdo**
- [ ] §1 Problema: cada problema tem identificador único e localização no código (arquivo:linha quando aplicável)
- [ ] §2 Solução: cada identificador do §1 está endereçado na §2
- [ ] §3 User Stories: ao menos 2 stories, formato "Como [papel], quero..."
- [ ] §4 Critérios: todos no formato QUANDO/SE/ENQUANTO + DEVE/NÃO DEVE; nenhum vago
- [ ] §5 Fora de Escopo: cobre o que poderia ser esperado mas não está incluso
- [ ] §7 Referências: tabela de arquivos preenchida; código de referência incluído quando relevante

**Qualidade**
- [ ] A spec é implementável sem perguntas adicionais ao desenvolvedor
- [ ] A spec não inclui nada que não foi descrito como problema em §1
- [ ] Os critérios são verificáveis (teste ou checklist manual)
- [ ] O escopo está delimitado — não cresce indefinidamente ao implementar

---

## Exemplo de spec bem formada (skeleton)

```markdown
# Spec 33 — Exemplo de Spec Bem Formada

> Status: draft
> Insumo: docs/v2-analysis.md §3 UX-04
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md)

---

## 1. Problema

- **UX-04**: Em `src/components/foo/Bar.tsx:42`, o botão "Confirmar" não exibe loading durante o submit. O usuário não tem feedback visual e pode clicar várias vezes, disparando múltiplas Actions.

---

## 2. Solução

- **UX-04**: Adicionar `isSubmitting` ao `useAction()` hook e usar `disabled={isSubmitting}` + `endIcon={<CircularProgress size={16}>}` no botão.

---

## 3. User Stories

- Como usuário, quero ver um indicador de carregamento ao clicar em "Confirmar", para saber que minha ação está sendo processada.
- Como desenvolvedor, quero um hook padronizado que exponha `isSubmitting`, para não reimplementar o controle de estado em cada form.

---

## 4. Critérios de Aceitação

- QUANDO o usuário clica em "Confirmar", O BOTÃO DEVE ficar desabilitado imediatamente e exibir um `CircularProgress size={16}` no `endIcon`.
- QUANDO a operação completa (sucesso ou erro), O BOTÃO DEVE voltar ao estado normal.
- O botão NÃO DEVE ser clicável enquanto `isSubmitting` for verdadeiro.

---

## 5. Fora de Escopo

- Implementação de debounce ou throttle no clique — o `disabled` já previne cliques múltiplos.
- Loading em outros botões da mesma tela que não fazem submit.

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| UX-04 | `src/components/foo/Bar.tsx` |

```tsx
// ✅ Correto
<Button
  type="submit"
  disabled={isSubmitting}
  endIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
>
  Confirmar
</Button>

// ❌ Anti-padrão
<Button type="submit">
  {isSubmitting ? "Salvando..." : "Confirmar"}
</Button>
```
```

---

## Anti-patterns

❌ **Spec sem Problema concreto** — "Gostaria de melhorar a UX dos dialogs" não é um problema; é uma intenção. O problema deve identificar o que está errado e onde.

❌ **Critérios vagos** — "O sistema deve funcionar corretamente", "O design deve ser bonito" — não são verificáveis.

❌ **Solução sem mapeamento para o Problema** — se a §2 endereça um `UX-07` que não existe na §1, algo está errado.

❌ **Spec sem §5 Fora de Escopo** — sem esta seção, o escopo cresce durante a implementação.

❌ **Número de spec duplicado** — sempre verificar o último número em `specs/` antes de criar.

❌ **Status `approved` sem revisão** — `ready` deve preceder `approved`; não pular a revisão.

❌ **Spec mudando após `approved`** — se o comportamento mudou, criar nova spec ou documentar explicitamente o delta antes de alterar a approved.

❌ **Misturar V1 e V2+ na mesma spec** — specs V1 (descritivas) não devem ser convertidas para V2+ sem revisão completa; manter o estilo original ou reescrever completamente.
