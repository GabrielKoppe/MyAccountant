# Spec 72 — Configurações · Família 5: Conta (somente owner)

> Status: draft
> Insumo: frames **"MyAccountant Settings — Arquitetura"** e **"MyAccountant Settings — Todas as Páginas v2"** (telas 13 Geral, 14 Membros, 15 Trilha de auditoria; modal M6 Convidar membro)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)
> Depende de: **Spec 67** (shell, modais, papéis) · **Spec 68** (Responsáveis — vínculo membro↔responsável)

---

## 0. Blueprint

As telas 13, 14 e 15 do frame v2 são normativas. É a família de **baixa frequência e alto impacto** — isolada no fim do nav, visível apenas para `owner`. Membros e Auditoria mudam pouco em relação ao que existe; **Geral** ganha quatro blocos novos.

---

## 1. Problema

- **CTA-01 · Sem backup**: não existe forma de o usuário levar seus dados embora nem de restaurá-los. Para um app de finanças pessoais isso é um risco de confiança, não um recurso avançado.
- **CTA-02 · Sem retorno ao setup**: quem passou pela configuração inicial e depois quer revisar seções, categorias, instituições e o primeiro modelo não tem por onde recomeçar.
- **CTA-03 · Sinal ao mover transação entre seções**: mover uma transação de uma seção de saída para uma de entrada (ou o contrário) hoje mantém o valor como está, produzindo somas erradas silenciosamente. Com o `sectionKind` da Spec 68 isso passa a ser decidível — mas precisa ser uma **escolha explícita da conta**.
- **CTA-04 · Sem saída para o owner**: só existe "excluir a conta". Um owner que quer sair sem destruir a conta da família não tem caminho.
- **CTA-05 · Zona de perigo sem rede**: "Excluir conta" é irreversível e não sugere backup antes.
- **CTA-06 · Papéis não explicados**: `owner`, `editor`, `viewer` aparecem como rótulos sem dizer o que cada um pode fazer — inclusive no momento do convite, que é justamente quando importa.
- **CTA-07 · Convites sem visibilidade**: convite enviado desaparece da tela; não se sabe se está pendente, quando expira, nem como reenviar.
- **CTA-08 · Auditoria sem recorte por família**: a trilha lista eventos sem indicar de qual família de configuração vieram, o que a torna difícil de varrer.

---

## 2. Solução

### 2.1 Geral — arquétipo D, quatro blocos novos

Chip `owner` ao lado do título. Propósito: "Identidade, padrões e manutenção desta conta. Afetam todos os membros."

**Bloco 1 · Identidade** — Nome da conta; Início do ano fiscal.

**Bloco 2 · Padrões financeiros** — Moeda; Fuso horário; Fechamento do mês. Mais o toggle novo:

- **Inverter sinal ao mover entre convenções diferentes** — **NOVA FUNCIONALIDADE** (CTA-03), em cartão com descrição completa: "Ao mover uma transação de uma seção de saída para uma de entrada (ou o contrário), o valor troca de sinal automaticamente. Desligado, o valor é mantido como está e você ajusta na mão." Depende do `sectionKind` da Spec 68.

**Bloco 3 · Backup da conta** — **NOVA FUNCIONALIDADE** (CTA-01), dois cartões lado a lado:
- **Exportar tudo** — "Meses, transações e todas as configurações em um único arquivo", com a data do último backup e o botão "Gerar backup";
- **Importar backup** — "Restaura em uma conta nova ou mescla nesta. **Mostra o que será criado antes de aplicar.**"

**Bloco 4 · Configuração assistida** — **NOVA FUNCIONALIDADE** (CTA-02): cartão de acento com o **Tour de configuração** — "Percorre seções, categorias, instituições e o primeiro modelo de tabela", com a data de conclusão e o botão "Refazer tour", explicitando que **refazer não apaga nada**.

**Bloco 5 · Zona de perigo**, dois itens (CTA-04, CTA-05):
- **Sair desta conta** — "Você perde o acesso e deixa de ser owner. **Exige transferir a propriedade para outro membro antes.**" (botão `outlined` de erro);
- **Excluir esta conta** — com o inventário real do que será destruído ("Remove 12 meses, 1.482 transações e todas as configurações") e a instrução "Irreversível — **gere um backup antes**" (botão `contained` de erro).

### 2.2 Membros — arquétipo A

Colunas: **Pessoa** (avatar + nome + e-mail) · **Papel** · **Último acesso** · **Responsável** · menu. Chip de contagem `3 · 1 convite`.

- **Papéis explicados** no propósito da página (CTA-06): "Owner vê tudo; editor não acessa a família Conta; viewer só lê."
- Papel editável inline por `Select`, exceto o do próprio owner.
- **Responsável** mostra o responsável vinculado ao membro (Spec 68), ou "—".
- **Convites pendentes** — **NOVA SEÇÃO** (CTA-07): bloco rotulado abaixo dos membros, com e-mail, "enviado há 3 dias · expira em 4", papel e status `aguardando`; menu com reenviar e revogar.
- Nota de rodapé: "Trocar o papel de um membro tem efeito imediato e é registrado na Trilha de auditoria."
- **Convidar** (modal **M6**, 480px): e-mail; **papel em cards de radio com a descrição do que cada um pode** — Editor ("Lança e edita transações e estrutura. Não acessa a família Conta") e Viewer ("Só leitura, inclusive dashboards"); toggle **"Criar um responsável com este nome"** (atalho que resolve o caso mais comum ao adicionar alguém da família).

### 2.3 Trilha de auditoria — arquétipo D, somente leitura

Chip `últimos 90 dias`. Toolbar: busca, filtro por pessoa, filtro por tipo, período. Ação secundária **Exportar CSV**.

Eventos agrupados por dia (`Hoje`, `Ontem · 28 jul`), cada linha com hora, ícone por natureza (criar / editar / excluir / exclusão em massa / membros), a frase do evento com os objetos em negrito e o **delta em texto** ("layout: colunas → pílulas", "6 → 12 meses", "0 transações realocadas"), e um **chip de família** (CTA-08): Estrutura · Apresentação · Entrada · Planejamento · Conta · Transações. Paginação no fim.

O que a trilha registra, no mínimo: alterações de estrutura, mudanças de papel, convites, mesclagens (Spec 68), exclusões com realocação, exclusões em massa de transações, alterações de parâmetros de projeção, publicação de layout de dashboard, revogação de conexão MCP (Spec 70), geração e restauração de backup.

---

## 3. User Stories

- Como owner, quero baixar um arquivo com tudo da minha conta, para não depender da plataforma.
- Como owner, quero restaurar um backup vendo antes o que será criado.
- Como owner, quero refazer o tour de configuração sem medo de perder dados.
- Como owner, quero decidir se mover uma transação entre entrada e saída inverte o valor automaticamente.
- Como owner, quero sair da conta transferindo a propriedade, sem destruí-la.
- Como owner, quero saber exatamente o que será apagado antes de excluir a conta.
- Como owner, quero convidar alguém entendendo o que o papel permite, e já criar o responsável com o nome dela.
- Como owner, quero ver convites pendentes, quando expiram, e reenviá-los.
- Como owner, quero varrer a auditoria filtrando por família e por pessoa.

---

## 4. Critérios de Aceitação

**Acesso:**
- AS TRÊS páginas DEVEM ser acessíveis apenas a `owner`; para outros papéis a rota DEVE redirecionar e os links NÃO DEVEM ser renderizados no nav nem no hub.

**Geral:**
- A página DEVE persistir nome da conta, início do ano fiscal, moeda, fuso horário e dia de fechamento do mês.
- O TOGGLE de inversão de sinal DEVE existir no nível da conta; QUANDO ligado, mover uma transação entre seções de `sectionKind` opostos DEVE inverter o sinal do valor; QUANDO desligado, o valor DEVE ser preservado.
- QUANDO o owner aciona "Gerar backup", O SISTEMA DEVE produzir um arquivo único com meses, transações e todas as configurações, E DEVE registrar a data do backup exibida na tela.
- QUANDO o owner escolhe um arquivo em "Importar backup", O SISTEMA DEVE exibir um resumo do que será criado/mesclado ANTES de aplicar, E NADA DEVE ser gravado sem confirmação.
- O bloco do tour DEVE informar quando foi concluído e permitir refazer; REFAZER NÃO DEVE apagar nem sobrescrever dados existentes.
- A zona de perigo DEVE conter "Sair desta conta" e "Excluir esta conta", nessa ordem, com o inventário real de meses e transações no segundo.
- "Sair desta conta" DEVE exigir transferência de propriedade para outro membro; SE não houver outro membro elegível, A AÇÃO DEVE estar bloqueada com a explicação.
- "Excluir esta conta" DEVE exigir confirmação por digitação do nome da conta e DEVE sugerir gerar backup antes.

**Membros:**
- A lista DEVE exibir pessoa, papel, último acesso e responsável vinculado.
- O papel DEVE ser editável inline, EXCETO o do próprio owner autenticado.
- OS CONVITES PENDENTES DEVEM aparecer em bloco próprio com e-mail, tempo desde o envio, prazo de expiração, papel e status; DEVE ser possível reenviar e revogar.
- O DIÁLOGO de convite DEVE apresentar os papéis Editor e Viewer com a descrição do que cada um pode fazer.
- SE o toggle "Criar um responsável com este nome" estiver ligado, UM RESPONSÁVEL DEVE ser criado e vinculado ao membro quando o convite for aceito.
- TODA mudança de papel DEVE ter efeito imediato e DEVE gerar um evento de auditoria.

**Auditoria:**
- A página DEVE ser somente leitura, agrupada por dia, com hora, natureza, descrição com o delta e chip de família por evento.
- A TOOLBAR DEVE permitir buscar e filtrar por pessoa, por tipo e por período.
- "Exportar CSV" DEVE exportar os eventos do filtro corrente.
- OS EVENTOS listados em §2.3 DEVEM ser registrados, cada um com o delta legível.
- A LISTA DEVE paginar.

---

## 5. Fora de Escopo

- Papéis customizados ou permissões granulares além de owner/editor/viewer.
- SSO, 2FA e políticas de senha (autenticação é escopo próprio).
- Backup automático agendado e versionado — aqui é backup **sob demanda**.
- Migração de conta entre organizações / cobrança e planos.
- Retenção configurável da auditoria (fica em 90 dias).
- Notificações por e-mail além do convite já existente.
- Conteúdo do tour de configuração passo a passo — esta spec entrega o gatilho e o estado de conclusão; o tour em si é escopo separado.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Família isolada no rodapé do nav | Sim, só owner | Baixa frequência, alto impacto (SET-01 da Spec 67) |
| Backup | Sob demanda, arquivo único, restauração com preview | Confiança do usuário sobre os próprios dados (CTA-01) |
| Restauração | Sempre com resumo antes de aplicar | Mesmo princípio da importação de categorias (Spec 68) |
| Inversão de sinal | Toggle no nível da conta | Comportamento correto depende da convenção do usuário; não há default universal (CTA-03) |
| Sair da conta | Exige transferência de propriedade | Conta sem owner é estado inválido |
| Excluir conta | Confirmação por digitação + sugestão de backup | Irreversível merece atrito proporcional (CTA-05) |
| Papéis | Descritos no ponto de decisão (convite) | Rótulo sem explicação não informa (CTA-06) |
| Criar responsável no convite | Toggle no diálogo | Resolve o caso mais comum (família) sem uma segunda visita a Responsáveis |
| Auditoria | Chip de família por evento | Torna a varredura possível (CTA-08) |
| Tour | Refazível e não destrutivo | Revisão de setup não deve dar medo (CTA-02) |

---

## 7. Referências Técnicas

| Item | Arquivo(s) |
|---|---|
| Geral | `.../settings/general/page.tsx`, `src/components/settings/general/*` |
| Backup | **novos** `src/components/settings/general/{BackupCard,RestoreBackupDialog}.tsx` + **novas** actions `exportAccountBackupAction`, `previewBackupRestoreAction`, `applyBackupRestoreAction` |
| Tour | **novo** `src/components/settings/general/SetupTourCard.tsx` + campo de conclusão em `Account` |
| Sair da conta | **novo** `src/components/settings/general/LeaveAccountDialog.tsx` + **nova** action `transferOwnershipAndLeaveAction` |
| Membros | `.../settings/members/page.tsx`, `src/components/settings/members/*`; **novo** `PendingInvitesSection.tsx`; diálogo de convite existente estendido |
| Auditoria | `.../settings/audit/page.tsx`, `src/components/settings/audit/*` |
| Registro de auditoria | `src/lib/audit/*` — passar a receber `family` e `delta` em todos os pontos de escrita |
| Sinal ao mover | action de mover transação — consultar o flag da conta + `sectionKind` (Spec 68) |

### 7.1 Prisma

```prisma
model Account {
  // ...
  invertSignOnSectionKindChange Boolean @default(true)   // NOVO (CTA-03)
  setupTourCompletedAt          DateTime?               // NOVO (CTA-02)
  lastBackupAt                  DateTime?               // NOVO (CTA-01)
}

model AuditEvent {
  // ...
  family String   // NOVO — structure | presentation | input | planning | account | transactions
  delta  Json?    // NOVO — { field, from, to } ou resumo em lote
}

model AccountInvite {
  // ...
  expiresAt        DateTime
  createResponsible Boolean @default(false)   // NOVO (M6)
}
```

### 7.2 Inversão de sinal ao mover

```tsx
// ✅ Correto — decisão explícita da conta + tipo das seções envolvidas
function resolveAmount(amountCents: bigint, from: SectionKind, to: SectionKind, invert: boolean) {
  if (!invert) return amountCents;
  const flips = from !== to && from !== "neutral" && to !== "neutral";
  return flips ? -amountCents : amountCents;
}

// ❌ Anti-padrão — inverter sempre, ou nunca, sem consultar o flag e o kind
```

### 7.3 Auditoria com delta legível

```tsx
// ✅ Correto — o evento carrega família e delta; a UI só formata
await recordAudit({
  accountId, actorId,
  family: "presentation",
  action: "tableType.update",
  target: { type: "TableType", id, name },
  delta: { field: "rowLayout", from: "columns", to: "pills" },
});
// → "Gabriel alterou o tipo de tabela Cartão de crédito · layout: colunas → pílulas"

// ❌ Anti-padrão — mensagem pronta em string no ponto de escrita (não filtrável, não traduzível)
```

### 7.4 Restrições do design system

- Zona de perigo: `Paper variant="outlined"` com `bgcolor: "error.subtle"`; "Sair" como `Button variant="outlined" color="error"`, "Excluir" como `variant="contained" color="error"`.
- Exclusão de conta: `Dialog` 420px com `TextField` de confirmação por digitação; primária desabilitada até o texto casar.
- Cartões de backup e tour: `Paper variant="outlined"` + `Stack`; tour usa `bgcolor: "accent.subtle"` e borda de acento.
- Papéis no convite: `RadioGroup` em cards com título + descrição — nunca `Select` seco.
- Convites pendentes: mesmo `Table` dos membros, com bloco `Typography variant="overline"` e linhas com opacidade reduzida.
- Auditoria: `List` com cabeçalhos de dia sticky, ícone por natureza em cor semântica (`warning` editar, `success` criar, `error` excluir), chip de família `size="small"`.

---

## 8. Critérios de Teste

**E2E:**
- `editor` acessando `/settings/general`, `/members`, `/audit` é redirecionado; os links não aparecem no nav nem no hub.
- Alterar nome da conta e moeda → rodapé marca alterações, salvar reflete no `AccountSwitcher`.
- Toggle de inversão ligado: mover transação de seção de saída para entrada inverte o sinal; desligado: preserva.
- Gerar backup → arquivo baixado contém meses, transações e configurações; `lastBackupAt` atualizado na tela.
- Importar backup → resumo exibido; cancelar não grava; aplicar cria exatamente o resumido.
- Refazer tour → dados existentes intactos após concluir.
- "Sair desta conta" com um único membro → ação bloqueada com explicação; com dois membros → transferência de propriedade concluída e acesso removido.
- "Excluir conta" só habilita após digitar o nome exato.
- Convidar com "Criar um responsável com este nome": aceitar o convite cria o responsável vinculado.
- Convite pendente mostra expiração; reenviar renova o prazo; revogar remove da lista.
- Trocar papel de Marina para Viewer → efeito imediato e evento na auditoria com delta "editor → viewer".
- Auditoria: filtrar por família Apresentação retorna só eventos dessa família; exportar CSV respeita o filtro.

**Unit:**
- `resolveAmount` para as 9 combinações de `sectionKind` × flag ligado/desligado.
- Serialização do backup: round-trip export → preview → apply preserva contagens.
- Elegibilidade para transferência de propriedade (nenhum outro membro / só viewer / editor disponível).
- Formatação de delta para os tipos de evento listados em §2.3.
- Cálculo de expiração de convite e idempotência do reenvio.

---

## 9. Plano de Migração Incremental

1. Prisma: campos novos em `Account`, `AuditEvent` (`family`, `delta`), `AccountInvite.createResponsible`. Backfill: `family` derivada da action de origem; `delta` nulo para eventos legados (UI mostra só a frase base).
2. Geral: migrar para o shell (se ainda não feito) e adicionar o toggle de inversão de sinal — depende do `sectionKind` da Spec 68 estar em produção.
3. Fiar `resolveAmount` na action de mover transação, atrás de feature flag.
4. Backup: `exportAccountBackupAction` primeiro (só leitura, risco baixo); depois preview de restauração; por último a aplicação.
5. Tour: `setupTourCompletedAt` + cartão com "Refazer".
6. Zona de perigo: "Sair desta conta" com transferência de propriedade; reforçar a confirmação por digitação em "Excluir conta".
7. Membros: bloco de convites pendentes; diálogo de convite com descrição de papéis + criar responsável.
8. Auditoria: propagar `family`/`delta` em todos os pontos de escrita (varredura por `recordAudit`), depois chips e filtros na UI, depois exportar CSV.
9. `pnpm typecheck` + `pnpm test` + e2e a cada passo.
