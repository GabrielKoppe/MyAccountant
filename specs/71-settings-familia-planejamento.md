# Spec 71 — Configurações · Família 4: Planejamento

> Status: draft
> Insumo: frames **"MyAccountant Settings — Arquitetura"** e **"MyAccountant Settings — Todas as Páginas v2"** (telas 11 Projeção, 12 Checklist mensal)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)
> Depende de: **Spec 67** (shell, status, modais) · **Spec 69** (o widget "Checklist do mês" consome a definição desta spec)

---

## 0. Blueprint

As telas 11 e 12 do frame v2 são normativas. Duas páginas pequenas, mas com a decisão conceitual mais importante da série: **configuração define, o mês executa**. Nada de progresso, marcação ou estado de execução vive em `/settings`.

---

## 1. Problema

- **PLA-01 · Projeção não tem onde ser configurada**: a página `/forecast` desenha cenários a partir de parâmetros embutidos no código (horizonte, janela de média, fatores otimista/conservador, saldo de partida). O usuário não consegue ajustá-los.
- **PLA-02 · Parâmetros sem explicação**: "janela de 6 meses" não diz nada isolado. Sem entender o efeito, o usuário não mexe — ou mexe e não entende o resultado.
- **PLA-03 · Efeito invisível**: alterar um parâmetro de projeção só se percebe indo à outra página e comparando de memória.
- **PLA-04 · Metas × parâmetros confundidos**: a versão anterior desenhou uma grade de metas por categoria dentro de Projeção. Metas por categoria são um **objeto de planejamento próprio**, não parâmetros do gráfico de `/forecast` — misturar os dois criava uma tela que não servia bem a nenhum dos dois.
- **PLA-05 · Checklist mistura definição e execução**: a tela atual tem barra de progresso, "4/11", caixas de marcar e botão de reiniciar. Isso é execução de um mês específico dentro de uma tela de configuração da conta — a marcação fica órfã de contexto de mês.
- **PLA-06 · Checklist sem estrutura**: lista plana de 11 itens sem grupos, sem frequência (todo mês / trimestral / anual) e sem responsável.
- **PLA-07 · Sem ciclo de vida do item**: remover um item do ritual apaga o histórico dos meses em que ele existiu.

---

## 2. Solução

### 2.1 Projeção — arquétipo D com preview ao vivo, **REFEITA** (PLA-01…04)

Página de **parâmetros do `/forecast`**, dividida em três blocos rotulados à esquerda e **gráfico de preview fixo à direita (396px)**. Cada campo carrega um `FormHelperText` que explica **o que muda** — não o que o campo é.

**Bloco 1 · Alcance**
- **Horizonte de projeção** (slider, meses): "Quantos meses à frente o gráfico desenha. Horizontes longos ampliam o erro da estimativa."
- **Janela de estimativa** (slider, meses): "Quantos meses passados formam a média de cada categoria. Janela curta reage rápido a mudanças; longa é mais estável."

**Bloco 2 · Cenários**
- **Cenário padrão ao abrir a página** (`ToggleButtonGroup`: Conservador · Base · Otimista): "Qual das três linhas fica em destaque quando o usuário entra. As outras duas continuam visíveis, mais claras."
- **Fator otimista** (+%, stepper): "Quanto o cenário bom melhora o resultado: mais receita ou menos despesa que a média."
- **Fator conservador** (−%, stepper): "Quanto o cenário ruim piora o resultado. Costuma ser maior que o otimista, por prudência."

**Bloco 3 · Ponto de partida**
- **Saldo de partida** (valor): "De onde a curva começa no primeiro mês projetado."
- **Origem do saldo** (select: calcular do último mês fechado / valor fixo informado): "Ou informar um valor fixo, se a conta não tiver histórico completo."
- Toggle **"Incluir parcelas já lançadas em meses futuros"**: "Compromissos conhecidos entram como despesa certa, fora da média."

**Preview ao vivo** (PLA-03) — **NOVA FUNCIONALIDADE**: gráfico com as três linhas (Otimista / Base / Conservador) e legenda, recalculado a cada mudança de parâmetro; abaixo, o **saldo projetado no fim do horizonte** no cenário base com a variação percentual, e dois cartões menores com o valor final otimista e conservador. Ações do header: **"Voltar ao padrão"** e **"Abrir /forecast"**.

**Metas por categoria ficam fora** (PLA-04): registrado explicitamente como decisão. Se o produto quiser metas, é uma **página nova de Metas** — não esta.

### 2.2 Checklist mensal — arquétipo B, **SÓ A DEFINIÇÃO** (PLA-05…07)

Propósito no cabeçalho: "A definição do ritual de fechamento. **Não há progresso aqui — quem marca é o widget de Checklist, dentro de cada mês.**" Na toolbar, uma linha de contexto: "Consumido pelo widget **Checklist do mês**".

Lista hierárquica de **grupos → itens**. Colunas: alça · **Item** · **Frequência** · **Responsável** · **Status** · menu.

- **Grupos** — **NOVA FUNCIONALIDADE** (PLA-06): cabeçalhos arrastáveis com nome, chip de "N itens" e menu próprio (renomear, mover, excluir). Ex.: Importação · Conferência · Fechamento.
- **Frequência** — **NOVA FUNCIONALIDADE**: `todo mês` · `trimestral` · `anual`. Item trimestral/anual só é instanciado nos meses correspondentes.
- **Responsável** — opcional, do cadastro de Responsáveis (Spec 68); "ninguém" é válido e aparece em itálico.
- **Status** — `Switch`: item desativado **não é criado em meses novos**, mas **o histórico dos meses antigos permanece** (PLA-07).
- Linha-fantasma para adicionar item; ação secundária "Novo grupo" no header, primária "Novo item".
- **Saem da tela**: barra de progresso, contador "4/11", botão de reiniciar e as caixas de marcar. Tudo isso é execução, e execução pertence ao mês.

---

## 3. User Stories

- Como usuário, quero ajustar o horizonte e a janela da minha projeção e ver o efeito no gráfico na hora.
- Como usuário, quero entender, lendo uma linha, o que cada parâmetro faz antes de mexer nele.
- Como usuário, quero escolher qual cenário aparece em destaque quando abro a projeção.
- Como usuário, quero que as parcelas que já sei que vou pagar entrem na projeção como despesa certa.
- Como usuário, quero organizar meu ritual de fechamento em grupos, na ordem em que eu faço.
- Como usuário, quero itens que só valem no fim do trimestre sem poluir todos os meses.
- Como usuário, quero atribuir cada item do ritual a uma pessoa.
- Como usuário, quero desativar um item do ritual sem apagar o histórico dos meses em que ele foi feito.

---

## 4. Critérios de Aceitação

**Projeção:**
- A página DEVE persistir, no nível da conta: horizonte (meses), janela de estimativa (meses), cenário padrão, fator otimista, fator conservador, saldo de partida, origem do saldo e o toggle de parcelas futuras.
- CADA campo DEVE exibir um texto de ajuda explicando o efeito da mudança.
- O GRÁFICO de preview DEVE recalcular a cada alteração de parâmetro, sem salvar, e DEVE mostrar as três linhas de cenário.
- O bloco de resultado DEVE exibir o saldo projetado no último mês do horizonte no cenário base, com a variação percentual, e os finais otimista e conservador.
- A página `/forecast` DEVE usar exatamente estes parâmetros — nenhum valor de projeção DEVE permanecer hardcoded.
- "Voltar ao padrão" DEVE restaurar os valores default e marcar a página como alterada (não salva sozinho).
- SE a origem do saldo for "calcular do último mês fechado" E não houver mês fechado, O CAMPO de saldo DEVE cair para valor informado e o hint DEVE explicar.
- A página NÃO DEVE conter grade de metas por categoria.

**Checklist:**
- A página NÃO DEVE exibir progresso, contador de concluídos, caixas de marcar nem botão de reiniciar.
- ITENS DEVEM pertencer a um grupo; grupos e itens DEVEM ser reordenáveis por arraste, e a ordem DEVE ser a ordem exibida no widget do mês.
- CADA item DEVE ter frequência ∈ `monthly | quarterly | yearly`.
- QUANDO um mês é criado, DEVEM ser instanciados os itens ativos cuja frequência se aplica àquele mês; itens desativados NÃO DEVEM ser instanciados.
- QUANDO um item é desativado, AS INSTÂNCIAS de meses anteriores DEVEM permanecer inalteradas, inclusive as marcadas como concluídas.
- CADA item DEVE poder ter 0 ou 1 responsável, exibido como avatar; sem responsável DEVE exibir "ninguém".
- O widget "Checklist do mês" (Spec 69) DEVE ler esta definição, agrupada e na ordem definida.

---

## 5. Fora de Escopo

- **Página de Metas por categoria** — decisão aberta, registrada no frame v2; não entra em nenhuma spec desta série.
- Execução do checklist (marcar, desmarcar, progresso, reiniciar) — vive no mês / no widget, coberto pela Spec 69 e pelas telas de mês.
- Notificações ou lembretes de itens de checklist pendentes.
- Projeção por categoria individual, sazonalidade ou modelos estatísticos além da média com fatores.
- Múltiplos conjuntos de parâmetros de projeção (cenários salvos nomeados pelo usuário).
- Projeção de patrimônio (a página de Patrimônio tem escopo próprio).

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo da página Projeção | Parâmetros do `/forecast`, nada mais | Separa configuração de gráfico de metas por categoria (PLA-04) |
| Explicação dos campos | Hint de **efeito**, não de definição | O usuário não precisa saber o que é "janela"; precisa saber o que muda (PLA-02) |
| Preview | Gráfico ao vivo ao lado dos controles | Fecha o loop de entendimento sem trocar de página (PLA-03) |
| Fatores de cenário | Percentuais sobre a base | Simples, explicável, suficiente; modelos estatísticos ficam fora |
| Checklist | Só definição | Execução sem contexto de mês é ambígua (PLA-05) |
| Frequência | 3 níveis fixos | Cobre o ritual real (mensal, trimestral, anual) sem cron genérico |
| Desativar item | Não apaga instâncias antigas | Histórico de fechamento é registro, não rascunho (PLA-07) |
| Grupos | Cabeçalhos arrastáveis, não tags | O ritual tem ordem; grupo é etapa, não etiqueta |

---

## 7. Referências Técnicas

| Item | Arquivo(s) |
|---|---|
| Projeção | `.../settings/forecast/page.tsx` (nova rota de settings), **novos** `src/components/settings/forecast/{ForecastParamsForm,ForecastPreviewChart}.tsx` |
| Consumo | `src/app/(app)/[accountId]/forecast/*` — passa a ler os parâmetros da conta |
| Cálculo | **novo/extraído** `src/lib/forecast/project.ts` — função pura usada pelo preview **e** pela página real |
| Checklist | `.../settings/checklist/page.tsx`, **novos** `src/components/settings/checklist/{ChecklistTree,GroupHeaderRow,ItemRow}.tsx` |
| Instanciação | action de criação de mês — instancia os itens aplicáveis |
| Widget | `src/components/dashboards/widgets/ChecklistWidget.tsx` (Spec 69) — consome a definição |

### 7.1 Prisma

```prisma
enum ForecastScenario { conservative base optimistic }
enum BalanceOrigin    { lastClosedMonth fixedValue }
enum ChecklistFrequency { monthly quarterly yearly }

model ForecastSettings {                    // NOVO — 1:1 com Account
  accountId          String @id
  horizonMonths      Int    @default(12)
  estimationWindow   Int    @default(6)
  defaultScenario    ForecastScenario @default(base)
  optimisticFactor   Float  @default(0.12)
  conservativeFactor Float  @default(-0.15)
  balanceOrigin      BalanceOrigin @default(lastClosedMonth)
  fixedStartBalance  BigInt?
  includeFutureInstallments Boolean @default(true)
}

model ChecklistGroup {                       // NOVO
  id        String @id @default(cuid())
  accountId String
  name      String
  order     Int
  status    SettingsStatus @default(active)
}

model ChecklistItem {
  // ...
  groupId            String                    // NOVO
  frequency          ChecklistFrequency @default(monthly)  // NOVO
  responsiblePartyId String?                   // NOVO
  order              Int
  status             SettingsStatus @default(active)       // Spec 67
}

model MonthChecklistInstance {                // execução — vive no mês, não em settings
  id             String @id @default(cuid())
  monthId        String
  checklistItemId String
  completedAt    DateTime?
  completedBy    String?
}
```

### 7.2 Função de projeção única

```tsx
// ✅ Correto — pura; o preview e a página /forecast chamam a mesma função
export function project(history: MonthlyAggregate[], params: ForecastParams): ProjectionResult;

// preview em settings
const preview = project(history, draftParams);          // não salva
// página real
const real = project(history, savedParams);

// ❌ Anti-padrão — preview aproximado em settings e cálculo "de verdade" no /forecast
```

### 7.3 Instanciação por frequência

```tsx
// ✅ Correto — a frequência decide se o item nasce naquele mês
const applies = (item: ChecklistItem, month: { year: number; month: number }) =>
  item.status === "active" &&
  (item.frequency === "monthly" ||
   (item.frequency === "quarterly" && month.month % 3 === 0) ||
   (item.frequency === "yearly" && month.month === 12));

// ❌ Anti-padrão — instanciar tudo e esconder na UI
```

### 7.4 Restrições do design system

- Sliders com `Slider size="small"` + `Chip` mostrando o valor corrente (não `valueLabel` flutuante — o valor precisa ficar sempre visível).
- Steppers de percentual com `TextField size="small" type="number"` + `InputAdornment` "%" e setas; nunca input livre sem limite.
- Cenário padrão com `ToggleButtonGroup exclusive`.
- Hints sempre em `FormHelperText` — nunca `Tooltip`: a explicação é permanente, não sob demanda.
- Gráfico com a biblioteca já adotada; cores dos cenários por token (`success` / `accent.primary` / `warning`), nunca hex.
- Cabeçalho de grupo do checklist: `TableRow` com `TableCell colSpan` contendo alça, `Typography variant="overline"`, `Chip` de contagem e `IconButton` de menu.

---

## 8. Critérios de Teste

**E2E:**
- Alterar horizonte de 12 para 24 → gráfico do preview estende para 24 pontos e o saldo final muda; salvar → `/forecast` reflete.
- Alterar fator conservador → apenas a linha conservadora e o cartão correspondente mudam.
- Selecionar cenário padrão "Otimista" → abrir `/forecast` mostra a linha otimista em destaque.
- Desligar "incluir parcelas futuras" → saldo projetado sobe (as parcelas deixam de ser despesa certa).
- "Voltar ao padrão" → campos voltam aos defaults, rodapé marca alterações não salvas, `/forecast` só muda depois de salvar.
- Checklist: criar grupo, criar três itens, arrastar o segundo para o topo → widget do mês reflete a ordem.
- Item trimestral: criar mês de março → item instanciado; criar mês de abril → não instanciado.
- Desativar item que tem instâncias concluídas em meses anteriores → meses antigos continuam mostrando o item marcado; mês novo não o recebe.
- A página de checklist não apresenta checkbox, progresso nem botão de reiniciar (asserção negativa).

**Unit:**
- `project()`: janela maior que o histórico disponível; conta sem mês fechado; fatores 0%; horizonte 1 mês.
- `applies()` para as três frequências em 12 meses.
- Fallback de `balanceOrigin` quando não há mês fechado.
- Ordenação estável de grupos e itens após múltiplos arrastes.

---

## 9. Plano de Migração Incremental

1. Extrair o cálculo de projeção atual para `src/lib/forecast/project.ts` **puro**, com os valores hoje hardcoded como defaults. `/forecast` passa a usá-lo sem mudança de comportamento.
2. Prisma: `ForecastSettings` (criar registro default por conta no backfill), `ChecklistGroup`, campos novos em `ChecklistItem`, `MonthChecklistInstance` (migrar as marcações atuais para instâncias por mês).
3. Página de Projeção: formulário + hints, lendo/gravando `ForecastSettings`.
4. `ForecastPreviewChart` chamando `project()` com o draft.
5. `/forecast` passa a ler `ForecastSettings` (remover defaults hardcoded).
6. Checklist: criar grupos (backfill: um grupo "Geral" com todos os itens atuais), adicionar frequência e responsável.
7. Remover progresso/checkbox/reiniciar da tela de settings; garantir que o widget do mês (Spec 69) é a única superfície de execução.
8. Instanciação por frequência na criação de mês (feature flag).
9. `pnpm typecheck` + `pnpm test` + e2e a cada passo.
