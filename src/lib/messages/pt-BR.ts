import type { PageGuide } from "@/lib/page-guide";

export const messages = {
  common: {
    save: "Salvar",
    cancel: "Cancelar",
    delete: "Deletar",
    edit: "Editar",
    create: "Criar",
    loading: "Carregando...",
    error: "Ocorreu um erro. Tente novamente.",
    success: "Operação realizada com sucesso.",
    confirm: "Confirmar",
    close: "Fechar",
    none: "Nenhum",
    createNamed: (name: string) => `Criar "${name}"`,
    removeNamed: (name: string) => `Remover "${name}"`,
    moreActions: "Mais ações",
    pageInfo: {
      ariaLabel: "Sobre esta página",
      prev: "Voltar",
      next: "Próximo",
      done: "Entendi",
    },
  },
  auth: {
    login: "Entrar",
    logout: "Sair",
    signup: "Criar conta",
    email: "Email",
    password: "Senha",
    name: "Nome",
    confirmPassword: "Confirmar senha",
    forgotPassword: "Esqueci minha senha",
    loginWithGoogle: "Entrar com Google",
    emailOrPasswordIncorrect: "Email ou senha incorretos.",
    emailAlreadyRegistered: "Este email já está cadastrado.",
    invalidEmail: "Email inválido.",
    passwordTooShort: "Senha deve ter pelo menos 8 caracteres.",
    passwordNeedsLetter: "Senha deve conter ao menos uma letra.",
    passwordNeedsNumber: "Senha deve conter ao menos um número.",
    passwordMismatch: "As senhas não coincidem",
    accountCreated: "Conta criada com sucesso!",
    signingIn: "Entrando...",
    creatingAccount: "Criando conta...",
    emailNotAllowed:
      "Este email não tem permissão para se cadastrar. Entre em contato com o administrador.",
    tagline: "Organização financeira colaborativa",
    noAccountQuestion: "Não tem conta?",
    haveAccountQuestion: "Já tem conta?",
    orDivider: "ou",
    forgotPasswordTitle: "Recuperar senha",
    forgotPasswordDescription: "Informe seu email e enviaremos um link de recuperação.",
    sendResetLink: "Enviar link de recuperação",
    resetLinkSent:
      "Se este email estiver cadastrado, você receberá um link de recuperação em breve.",
  },
  account: {
    selectAccount: "Selecionar conta",
    createAccount: "Criar conta",
    newAccount: "Nova conta",
    newAccountTitle: "Nova conta financeira",
    newAccountSubtitle: "Escolha um nome para identificar este novo espaço financeiro.",
    accountNameDuplicate: "Você já tem uma conta com este nome.",
    accountName: "Nome da conta",
    inviteMember: "Convidar membro",
    roles: {
      owner: "Proprietário",
      editor: "Editor",
      viewer: "Visualizador",
    },
    settings: {
      title: "Configurações da conta",
      dangerZone: "Zona de perigo",
      dangerZoneHint: "Contém ações irreversíveis que afetam toda a conta",
      leaveAccount: "Sair desta conta",
      leaveAccountHint: "Você precisará de um novo convite para retornar.",
      leaveAccountConfirm:
        "Tem certeza que deseja sair desta conta? Você precisará de um novo convite para voltar.",
      deleteAccount: "Deletar conta",
      deleteAccountHint: "Ação permanente — todos os dados serão apagados.",
      deleteAccountAlert: "Esta ação é permanente e não pode ser desfeita.",
      deleteAccountConfirm: 'Para confirmar, digite o nome da conta abaixo e clique em "Deletar".',
      deleteAccountSuccess: "Conta deletada com sucesso.",
      leaveAccountSuccess: "Você saiu da conta.",
    },
    invite: {
      title: "Convidar membro",
      emailLabel: "Email do convidado",
      roleLabel: "Papel",
      sendButton: "Enviar convite",
      sending: "Enviando...",
      success: "Convite enviado!",
      pendingError: "Já existe um convite pendente para este email.",
      alreadyMemberError: "Este email já é membro desta conta.",
    },
    members: {
      title: "Membros",
      noMembers: "Nenhum membro encontrado.",
      pendingInvites: "Convites pendentes",
      noPendingInvites: "Nenhum convite pendente.",
      removeButton: "Remover",
      removeTitle: "Remover membro",
      removeSelf: "Você não pode remover a si mesmo.",
      removeConfirm: "Tem certeza que deseja remover este membro?",
      removeSuccess: "Membro removido.",
      revokeButton: "Revogar",
      revokeConfirm: "Tem certeza que deseja revogar este convite?",
      revokeSuccess: "Convite revogado.",
      roleUpdated: "Papel atualizado.",
      lastOwnerError: "Não é possível realizar esta ação: a conta ficaria sem proprietário.",
      joined: "Entrou em",
      invitedAt: "Convidado em",
      expiresAt: "Expira em",
    },
    acceptInvite: {
      title: "Aceitar convite",
      loading: "Verificando convite...",
      acceptButton: "Aceitar e entrar",
      declineButton: "Recusar",
      accepting: "Aceitando...",
      declining: "Recusando...",
      accepted: "Convite aceito! Redirecionando...",
      declined: "Você recusou o convite.",
      invalidToken: "Convite inválido ou expirado.",
      wrongEmail: "Este convite não é para o seu email.",
      alreadyMember: "Você já é membro desta conta.",
      // Tela pública de aceite
      eyebrow: "Convite",
      invitedByShort: (inviter: string) => `${inviter} convidou você para`,
      roleBadge: (role: string) => `Acesso de ${role.toLowerCase()}`,
      newUserHint: "Crie sua conta para aceitar e começar a colaborar.",
      confirmHint: "O convite expira em 7 dias.",
      createAccountCta: "Criar conta para aceitar",
      loginCta: "Já tenho conta",
      expired: "Este convite expirou. Peça um novo à pessoa que convidou você.",
      revoked: "Este convite foi revogado.",
      alreadyAccepted: "Este convite já foi aceito.",
      wrongEmailDetail: (email: string) =>
        `Este convite é para ${email}. Entre com esse email para aceitar.`,
      goToApp: "Ir para o início",
    },
  },
  settings: {
    nav: {
      general: "Geral",
      forecast: "Projeção",
      sections: "Seções",
      categories: "Categorias",
      institutions: "Instituições",
      tableTypes: "Tipos de tabela",
      templates: "Templates de importação",
      analyses: "Análises Salvas",
      members: "Membros",
      responsibles: "Responsáveis",
      checklist: "Checklist mensal",
      aliases: "Apelidos",
      connectors: "Conectores de IA",
      audit: "Trilha de auditoria",
      account: "Conta",
      visualization: "Visualização",
      dashboards: {
        monthly: "Dashboard Mensal",
        yearly: "Dashboard Anual",
        monthSummary: "Resumo do Mês",
      },
      // Spec 65 §7.2/§10.3 (P7) — famílias do sidebar de Configurações.
      // Spec 67 §6 — reclassificado para 5 famílias por intenção:
      // Estrutura · Apresentação · Entrada de dados · Planejamento · Conta.
      groups: {
        structure: "Estrutura",
        presentation: "Apresentação",
        dataEntry: "Entrada de dados",
        planning: "Planejamento",
        account: "Conta",
        dashboardsLabel: "Dashboards",
      },
    },

    // Spec 67 §2.2 — moldura única de todas as páginas de configuração.
    shell: {
      breadcrumbRoot: "Configurações",
      breadcrumbLabel: "Trilha de navegação",
      ownerOnly: "owner",
      searchPlaceholder: "Buscar…",
      searchLabel: "Buscar nesta lista",
      // Busca sem resultado ≠ lista vazia. O texto da lista vazia é do objeto da
      // página ("Nenhum apelido cadastrado"); aqui o que falhou foi o filtro, e
      // dizer a mesma coisa nos dois casos faria parecer que os itens sumiram.
      searchNoResults: "Nenhum resultado",
      searchNoResultsHint: "Nenhum item desta lista corresponde ao que você buscou.",
      noChanges: "Nenhuma alteração",
      unsavedChanges: (n: number) =>
        n === 1 ? "1 alteração não salva" : `${n} alterações não salvas`,
      // Texto ESTÁVEL da live region da barra de salvar. O contador muda a cada
      // tecla; se ele estivesse dentro do `aria-live`, o leitor de tela enfileiraria
      // "1 alteração…", "2 alterações…", "3…" a cada digitação. A contagem fica
      // visível (e `aria-hidden`) e o que se anuncia é só a virada de estado.
      unsavedChangesLive: "Há alterações não salvas",
      save: "Salvar",
      discard: "Descartar",
      addRow: "Adicionar…",
      cancelRow: "Cancelar",
      rowMenu: {
        trigger: "Ações desta linha",
        edit: "Editar",
        duplicate: "Duplicar",
        activate: "Ativar",
        deactivate: "Desativar",
        viewUsage: "Ver uso",
        merge: "Mesclar",
        delete: "Excluir",
      },
      status: {
        toggleLabel: "Ativo",
        deactivated: "desativado",
        neverUsed: (gender: "f" | "m") => (gender === "f" ? "nunca usada" : "nunca usado"),
      },
      pagination: {
        rowsPerPage: "Por página",
        // MUI passa { from, to, count }; count = -1 enquanto o total é desconhecido.
        displayedRows: ({ from, to, count }: { from: number; to: number; count: number }) =>
          `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`,
        // Rótulo acessível dos botões de navegação — o default do MUI é em inglês
        // ("Go to next page") e vazaria para leitores de tela.
        itemAriaLabel: (type: "first" | "last" | "next" | "previous") =>
          type === "first"
            ? "Primeira página"
            : type === "last"
              ? "Última página"
              : type === "next"
                ? "Próxima página"
                : "Página anterior",
      },
    },

    // Spec 67 §2.1 — hub em /settings.
    hub: {
      title: "Configurações",
      subtitle: "Estrutura, entrada e apresentação dos dados desta conta.",
      ownerOnlyBadge: "somente owner",
      attention: (n: number) => (n === 1 ? "1 item pede atenção" : `${n} itens pedem atenção`),
      review: "Revisar",
      // Rótulo acessível do ícone de alerta na linha do card — a cor de aviso
      // sozinha não informa nada a quem não a distingue.
      rowNeedsAttention: "Este item pede atenção",
      signals: {
        aliasIncomplete: (n: number) =>
          n === 1
            ? "1 apelido não preenche nenhum campo"
            : `${n} apelidos não preenchem nenhum campo`,
        templateBroken: (n: number) =>
          n === 1
            ? "1 template de importação com referência quebrada"
            : `${n} templates de importação com referência quebrada`,
        checklistNotStarted: (monthLabel: string) => `Checklist de ${monthLabel} não iniciado`,
      },
      // Rótulos das contagens baratas do chip (hub + nav). Cada função devolve a
      // string COMPLETA do chip para que a lógica de plural viva num lugar só —
      // `getSettingsCounts` só passa os números.
      counts: {
        sections: (total: number, inactive: number) =>
          inactive > 0
            ? `${total} · ${inactive} ${inactive === 1 ? "inativa" : "inativas"}`
            : String(total),
        categories: (categories: number, subcategories: number) =>
          subcategories > 0 ? `${categories} · ${subcategories} sub` : String(categories),
        connectors: (n: number) => (n === 1 ? "1 conectado" : n > 0 ? `${n} conectados` : "0"),
        members: (members: number, invites: number) =>
          invites > 0
            ? `${members} · ${invites} ${invites === 1 ? "convite" : "convites"}`
            : String(members),
        // Dashboards não tem "itens" para contar: `DashboardLayout` é 1 linha por
        // contexto e só existe quando o layout foi personalizado. A contagem
        // honesta e barata é quantos dos contextos saíram do padrão.
        // Dashboards NÃO tem contagem: as três páginas (mensal, anual, resumo)
        // são fixas, então qualquer número ali é ruído — "3" é constante e
        // "N personalizados" mede uma coisa que o usuário não pediu para saber.
        // A linha do hub e o item do nav saem sem número, de propósito.
      },
      rows: {
        sections: "Abas de cada mês",
        categories: "Classificação das transações",
        institutions: "Bancos e cartões",
        responsibles: "Quem paga ou recebe",
        tableTypes: "Colunas, densidade e layout da linha",
        models: "Tabelas criadas a cada novo mês",
        dashboards: "Mensal · anual · resumo",
        templates: "Mapeamento de CSV/XLSX",
        aliases: "Descrição bruta → nome limpo",
        connectors: "Classificação automática",
        forecast: "Parâmetros da projeção",
        checklist: "Ritual de fechamento",
        general: "Nome, moeda, fuso",
        members: "Convites e papéis",
        audit: "Últimos 90 dias",
      },
    },

    // Spec 67 §2.2 regra 3 e §7.5 — a frase de propósito de cada página,
    // extraída do frame v2. É o que desfaz a ambiguidade entre "Tipos de
    // tabela", "Modelos de tabela" e "Templates de importação" sem renomear
    // nada. Centralizadas aqui porque são o texto da MOLDURA, não do conteúdo.
    purposes: {
      sections:
        "As abas de cada mês. A ordem aqui é a ordem das abas. Seção inativa não aparece em meses novos nem aceita modelos.",
      categories:
        "Classificam cada transação. Usadas por apelidos, templates de importação e widgets de dashboard.",
      institutions:
        "Bancos, cartões, corretoras e empresas. Campo opcional da transação e agrupador da importação.",
      responsibles:
        "Quem paga ou recebe. Um responsável pode agrupar vários membros da conta, ou nenhum — é só um rótulo da transação.",
      tableTypes: "Definem colunas visíveis, densidade e formato da linha para cada tabela do mês.",
      models:
        "Tabelas financeiras pré-montadas, com suas transações. Usadas ao criar um mês novo e ao adicionar uma tabela dentro de um mês.",
      dashboards:
        "Monte cada página arrastando widgets no grid. O que você vê aqui é exatamente o que o usuário vê na página.",
      templates:
        "Cada etapa do parsing tem sua aba. O preview à direita reprocessa o arquivo de amostra a cada mudança.",
      aliases:
        "Regra de reconhecimento por descrição do extrato. Pode preencher qualquer campo da transação — os que você deixar em branco continuam em branco, sem alerta.",
      connectors:
        "Expõem os dados desta conta para a IA que você já usa, via MCP. A plataforma não guarda chave de IA nem chama modelo nenhum.",
      forecast:
        "Parâmetros que alimentam o gráfico da página de projeção. Cada campo explica o que muda — e o gráfico reage na hora.",
      checklist:
        "A definição do ritual de fechamento. Não há progresso aqui — quem marca é o widget de Checklist, dentro de cada mês.",
      general: "Identidade, padrões e manutenção desta conta. Afetam todos os membros.",
      members:
        "Quem acessa esta conta e com qual papel. Owner vê tudo; editor não acessa a família Conta; viewer só lê.",
      audit: "Toda alteração de estrutura, papel e exclusão em massa. Somente leitura.",
    },
    audit: {
      emptyTitle: "Nenhum evento registrado",
      emptyDescription:
        "Ações sensíveis — troca de papel de membro, convites e redefinição de senha — aparecerão aqui.",
      unknownActor: "Sistema",
      actionLabel: (action: string) => {
        const labels: Record<string, string> = {
          "member.role_changed": "Papel de membro alterado",
          "member.removed": "Membro removido",
          "member.left": "Membro saiu da conta",
          "invite.sent": "Convite enviado",
          "invite.accepted": "Convite aceito",
          "invite.revoked": "Convite revogado",
          "auth.password_reset": "Senha redefinida",
        };
        return labels[action] ?? action;
      },
    },
    dashboards: {
      pageTitle: (context: string) => {
        const labels: Record<string, string> = {
          monthly: "Dashboard Mensal",
          yearly: "Dashboard Anual",
          month_summary: "Resumo do Mês",
        };
        return labels[context] ?? context;
      },
      pageSubtitle: "Arraste para reordenar. Clique em + para adicionar. × para remover.",
      activeWidgets: "Widgets ativos",
      availableWidgets: "Widgets disponíveis",
      noActiveWidgets: "Nenhum widget ativo. Adicione da lista abaixo.",
      noAvailableWidgets: "Todos os widgets estão ativos.",
      saved: "Layout salvo.",
      saveError: "Erro ao salvar layout.",
      hideWidget: "Ocultar widget",
      showWidget: "Mostrar widget",
      dragWidget: "Arrastar para reposicionar",
      widgetTypes: {
        kpi: "KPI",
        chart: "Gráfico",
        table: "Tabela",
        panel: "Painel",
      },
      paletteTitle: "Widgets disponíveis",
      paletteHint: "Arraste um widget para a grade para adicioná-lo.",
      paletteEmpty: "Todos os widgets já estão no painel.",
      widgetOptions: "Opções do widget",
      duplicate: "Duplicar",
      remove: "Remover",
      adjustSize: "Ajustar tamanho",
      gridFull: "Sem espaço na grade para adicionar este widget.",
      sizeNoRoom: "Sem espaço na grade para este tamanho. Mova ou remova outros widgets.",
      widgetSettingsTitle: "Configurações do widget",
      sizeSection: "Tamanho",
      actionsSection: "Ações",
      variantsTitle: "Tamanho do widget",
      variantsHint: "Escolha como o widget ocupa a grade.",
      backToPalette: "Voltar para a lista de widgets",
      resizeWidget: "Redimensionar widget",
      variants: {
        default: "Padrão",
        compact: "Compacto",
        large: "Grande",
        wide: "Largo",
        small: "Pequeno",
        expanded: "Expandido",
        medium: "Médio",
        giant: "Gigante",
      },
      configSection: "Configuração",
      configSave: "Salvar",
      configSaved: "Configuração salva.",
      config: {
        // money-flow
        groupByLabel: "Agrupar por",
        groupBySection: "Por seção",
        groupByCategory: "Por categoria",
        // category-treemap
        topNLabel: "Categorias exibidas",
        topNAll: "Todas",
        topNValue: (n: number) => `Top ${n}`,
        // budgets
        showOnlyLabel: "Exibir",
        showOnlyAll: "Todos os orçamentos",
        showOnlyNearLimit: "Apenas próximas do limite",
        // top-transactions / filtered-transactions
        limitLabel: "Quantidade",
        excludeSectionsLabel: "Ignorar seções",
        // kpi-custom
        labelLabel: "Rótulo",
        labelPlaceholder: "Ex.: Gastos com lazer",
        metricLabel: "Métrica",
        sectionsLabel: "Seções",
        categoriesLabel: "Categorias",
        membersLabel: "Membros",
        institutionsLabel: "Instituições",
        responsibleLabel: "Responsáveis",
        pendingLabel: "Apenas pendentes",
        favoriteLabel: "Apenas favoritas",
        allOption: "Todas",
        noneSelected: "Sem filtro",
        // member-breakdown
        viewLabel: "Visualização",
        viewDonut: "Rosca",
        viewBars: "Barras",
        // section-breakdown / category-breakdown
        chartTypeLabel: "Tipo de gráfico",
        chartTypePie: "Pizza",
        chartTypeBar: "Barras (lista)",
        chartTypeHBar: "Barras horizontais",
        chartTypeVBar: "Colunas verticais",
        // daily-heatmap
        heatmapMetricLabel: "Exibir",
        heatmapMetricExpense: "Despesas",
        heatmapMetricAll: "Toda atividade",
        heatmapColorByLabel: "Colorir por",
        heatmapColorByIntensity: "Volume de gasto (padrão)",
        heatmapColorByExpenseType: "Tipo de gasto (fixo/variável/único)",
        // top-categories (reusa topNLabel/topNValue/topNAll)
        // analysis (widget instanciável)
        analysisYearNote: "Período: ano atual do dashboard (automático)",
        // week-chart (Spec 38)
        weekMetricLabel: "Exibir",
        weekMetricExpense: "Despesas",
        weekMetricIncome: "Entradas",
        weekMetricBoth: "Despesas e entradas",
        // Spec 41 Fase 14 — filtros por expenseType e source
        expenseTypeFilterLabel: "Filtrar por tipo de gasto",
        expenseTypeAll: "Todos os tipos",
        expenseTypeFixed: "Somente fixos",
        expenseTypeVariable: "Somente variáveis",
        expenseTypeOneTime: "Somente eventos únicos",
        sourceFilterLabel: "Filtrar por origem",
        sourceAll: "Todas as origens",
        sourceManual: "Lançado manualmente",
        sourceCsvImport: "Importado via CSV",
        sourceXlsxImport: "Importado via XLSX",
        sourceTemplate: "Aplicação de template",
        sourceAutoTemplate: "Template automático",
        sourceDuplicate: "Duplicado",
        paymentMethodFilterLabel: "Filtrar por método de pagamento",
        tagFilterLabel: "Filtrar por tags",
        // kpi-transaction-count (Spec 38)
        countInMonthLabel: "Escopo",
        countInMonthAll: "Todas as tabelas",
        countInMonthOnly: "Somente tabelas que contam no mês",
        sectionTypeLabel: "Tipo de transação",
        sectionTypeAll: "Todas",
        sectionTypeExpense: "Somente despesas",
        sectionTypeIncome: "Somente entradas",
        includePendingLabel: "Incluir pendentes",
      },
      addWidget: "Adicionar widget",
      addAll: "Adicionar todos",
      resetToDefault: "Restaurar padrão",
      resetToDefaultConfirmTitle: "Restaurar layout padrão?",
      resetToDefaultConfirmDescription:
        "O layout voltará ao arranjo padrão. Posições, tamanhos e configurações personalizadas serão perdidos.",
      resetToDefaultConfirm: "Restaurar",
      resetToDefaultSuccess: "Layout restaurado ao padrão.",
      removeWidget: "Remover widget",
      widgetTypeKpi: "Indicador",
      widgetTypePanelHalf: "Painel · Metade",
      widgetTypePanelFull: "Painel · Inteiro",
      kpisGroup: "Indicadores",
      panelsGroup: "Painéis",
    },
    general: {
      title: "Configurações gerais",
      accountNameLabel: "Nome da conta",
      currencyLabel: "Moeda",
      monthStartDayLabel: "Início do mês (dia)",
      monthStartDayHelper: "Transações a partir deste dia são contadas no mês seguinte.",
      defaultResponsibleLabel: "Responsável padrão",
      defaultResponsibleNone: "Nenhum",
      invertSignOnMoveLabel: "Inverter sinal ao mover entre convenções diferentes",
      invertSignOnMoveHelper:
        "Ao mover transações entre uma seção que subtrai e uma que soma (ou vice-versa), inverte o sinal do valor por padrão para preservar o significado exibido. Você ainda pode ajustar a cada movimentação.",
      saved: "Configurações salvas.",
    },
    forecast: {
      title: "Projeção de fluxo de caixa",
      description:
        "Ajuste como a projeção de saldo futuro é calculada a partir dos seus recorrentes, parcelas e hábitos de gasto recentes. Essas preferências valem para a página de Projeção e para o widget do dashboard anual.",
      horizonLabel: "Horizonte da projeção",
      horizonHelper: "Quantos meses à frente projetar, a partir do mês atual.",
      horizonOptionLabel: (months: number) => `${months} meses`,
      scenarioLabel: "Cenário padrão",
      scenarioHelper:
        "Cenário exibido ao abrir a página de Projeção. Pode ser alternado por lá a qualquer momento, sem afetar esta preferência.",
      scenarios: {
        optimistic: "Otimista",
        realistic: "Realista",
        conservative: "Conservador",
      },
      optimisticPctLabel: "Fator otimista",
      optimisticPctHelper:
        "Reduz a magnitude da estimativa de gastos não-comprometidos neste percentual.",
      conservativePctLabel: "Fator conservador",
      conservativePctHelper:
        "Aumenta a magnitude da estimativa de gastos não-comprometidos neste percentual.",
      variableWindowLabel: "Janela de estimativa",
      variableWindowHelper:
        "Quantos meses fechados usar na média de hábitos de gasto não-comprometidos (fora recorrentes e parcelas).",
      variableWindowOptionLabel: (months: number) => `${months} meses`,
      startBalanceLabel: "Saldo de partida (opcional)",
      startBalanceHint: "Deixe vazio para usar o acumulado dos meses já lançados.",
      saved: "Configurações de projeção salvas.",
    },
    // Spec 68 — Família 1 · Estrutura. Strings das quatro listas (Seções, Categorias,
    // Instituições, Responsáveis) e do que elas compartilham. As chaves de CRUD legadas
    // continuam nos blocos `sections`/`categories`/… abaixo.
    structure: {
      dragHandleLabel: "Reordenar",
      ghostHint: "Enter cria e abre a próxima linha · Esc cancela",
      reordered: "Ordem salva.",

      // ── Seções ──────────────────────────────────────────────────────────
      sections: {
        columnName: "Nome",
        columnKind: "Tipo",
        columnModels: "Modelos",
        columnStatus: "Status",
        addRow: "Adicionar seção…",
        // Spec 68 D1 — os quatro rótulos SÃO os quatro valores de `countType`. Os
        // nomes antigos ("Somar"/"Subtrair") descreviam a operação aritmética; estes
        // descrevem o que acontece com o dinheiro, que é o que o usuário pensa.
        kindLabels: {
          subtract: "Saída",
          add: "Entrada",
          neutral: "Neutra",
          ignore: "Ignorada",
        },
        kindHints: {
          subtract: "sai da conta",
          add: "entra na conta",
          neutral: "entra no total como informativo",
          ignore: "não entra no total do mês",
        },
        legendLabel: "Tipos",
        colorLabel: "Cor da seção",
        colorNone: "Sem cor definida",
        modelsEmpty: "—",
        modelsHint:
          "Modelos = quantos Modelos de tabela criam tabelas nesta seção. Contagem barata; a de transações fica no menu da linha.",
        colorHint:
          "A cor é a identidade da seção — a mesma usada em Categorias e nos dashboards. O tipo fica no badge, nunca na cor.",
        // Estado vazio da lista (P2/Spec 68) — sem seção nenhuma cadastrada ainda.
        emptyTitle: "Nenhuma seção ainda",
        emptyDescription: "As seções são as abas de cada mês. Crie a primeira pela linha abaixo.",
        deactivateTitle: (name: string) => `Desativar "${name}"?`,
        deactivateBody:
          "A seção deixa de aparecer em meses novos e não aceita modelos. Os meses já criados continuam intactos e você pode reativar quando quiser.",
      },

      // ── Categorias ──────────────────────────────────────────────────────
      // "Seção padrão" saiu da lista nesta revisão de estilo (decisão do
      // desenvolvedor: a coluna nunca fez sentido). `Category.defaultSectionId`
      // continua no schema do banco, deprecado — ver o comentário lá.
      categories: {
        columnName: "Nome",
        columnStatus: "Status",
        addRow: "Adicionar categoria…",
        addSubRow: "Adicionar subcategoria…",
        subCount: (n: number) => `${n} sub`,
        searchPlaceholder: "Buscar categoria…",
        sortLabel: "Ordenar",
        sortManual: "Ordem manual",
        sortAlphabetical: "Alfabética",
        // NÃO é "mais usadas": contar uso varreria `Transaction` em lista, o que o
        // SET-07 da Spec 67 proíbe. `lastUsedAt` responde de graça.
        sortRecent: "Usadas recentemente",
        collapseAll: "Recolher tudo",
        expandAll: "Expandir tudo",
        expandRow: (name: string) => `Expandir ${name}`,
        collapseRow: (name: string) => `Recolher ${name}`,
        importExport: "Importar / Exportar",
        importMenuItem: "Importar categorias…",
        exportCsvMenuItem: "Exportar CSV",
        exportJsonMenuItem: "Exportar JSON",
        footnote:
          'O botão "Nova categoria" do cabeçalho rola até a última linha e foca o campo — não abre modal.',
        deactivateTitle: (name: string) => `Desativar "${name}"?`,
        deactivateBody:
          "A categoria deixa de aparecer nos seletores de transação. As transações já classificadas com ela continuam como estão.",
      },

      // ── Instituições ────────────────────────────────────────────────────
      institutions: {
        columnName: "Nome",
        columnKind: "Tipo",
        columnDetails: "Detalhes",
        columnStatus: "Status",
        addRow: "Adicionar instituição…",
        kindLabels: {
          bank: "Banco",
          card: "Cartão",
          broker: "Corretora",
          wallet: "Carteira",
          company: "Empresa",
        },
        // `kind` é nullable: as instituições anteriores à Spec 68 têm só nome, e nada
        // é inferido a partir dele (§4).
        kindUnset: "—",
        kindUnsetOption: "Sem tipo",
        kindUnsetHint: "defina o tipo para ver os detalhes",
        emptyTitle: "Nenhuma instituição ainda",
        emptyDescription:
          "Bancos, cartões, corretoras e empresas. Cadastre a primeira pela linha abaixo.",
        /** "corretora não tem detalhes" — o tipo em minúscula, como no frame. */
        noDetailsFor: (kindLabel: string) => `${kindLabel.toLowerCase()} não tem detalhes`,
        detailsEmpty: "—",
        fields: {
          last4: "Final",
          closingDay: "Fecha dia",
          dueDay: "Vence dia",
          branch: "Agência",
          accountNo: "Conta",
          taxId: "CNPJ",
        },
        /** "•••• 4471 · fecha 8 / vence 15" */
        cardDetails: (last4: string | null, closingDay: number | null, dueDay: number | null) => {
          const parts: string[] = [];
          if (last4) parts.push(`•••• ${last4}`);
          if (closingDay !== null && dueDay !== null) parts.push(`fecha ${closingDay} / vence ${dueDay}`);
          else if (closingDay !== null) parts.push(`fecha ${closingDay}`);
          else if (dueDay !== null) parts.push(`vence ${dueDay}`);
          return parts.join(" · ");
        },
        /** "ag. 0192 · cc 34567-8" */
        bankDetails: (branch: string | null, accountNo: string | null) => {
          const parts: string[] = [];
          if (branch) parts.push(`ag. ${branch}`);
          if (accountNo) parts.push(`cc ${accountNo}`);
          return parts.join(" · ");
        },
        companyDetails: (taxId: string) => `CNPJ ${taxId}`,
        footnote:
          "Detalhes renderiza só o que existe para o tipo: cartão mostra final + fechamento/vencimento; banco, agência e conta; empresa, CNPJ; carteira e corretora, nada.",
        deactivateTitle: (name: string) => `Desativar "${name}"?`,
        deactivateBody:
          "A instituição deixa de aparecer nos seletores de transação e no agrupamento da importação. As transações já vinculadas continuam como estão.",
      },

      // ── Responsáveis ────────────────────────────────────────────────────
      // "Tudo é responsável": UMA tabela para todo mundo — pessoal (automático) e
      // comum (0..N membros) lado a lado, como o frame v2 desenha. Não há mais uma
      // listagem separada para os "pessoais".
      responsibles: {
        columnName: "Nome",
        columnMembers: "Membros vinculados",
        columnStatus: "Status",
        addRow: "Adicionar responsável…",
        // Spec 68 D4 — 0..N para qualquer responsável comum. Sem ninguém, o
        // responsável é só um rótulo da transação, e a célula precisa dizer isso em
        // vez de ficar vazia.
        noMembers: "nenhum — só rótulo",
        linkMember: "Vincular membro",
        linkMemberFor: (name: string) => `Vincular membro a ${name}`,
        unlinkMember: (memberName: string) => `Desvincular ${memberName}`,
        allMembersLinked: "Todos os membros já estão vinculados",
        // Indicativo discreto na célula de membros da linha `personal` — não vira uma
        // segunda coluna: só troca o botão "+" por um ícone de cadeado com esta dica.
        autoLinked: "Vínculo automático — criado para o membro da conta",
        // Aria-label do avatar clicável (ícone/cor/membros) — distinto do "Editar: nome"
        // do clique no texto do nome (renomear inline), que usa outro gesto.
        personalizeFor: (name: string) => `Personalizar ${name}`,
        footnote:
          'Sem toolbar de busca (lista curta). A coluna "Padrão em" não existe: modelos de tabela são da conta e não carregam responsável — o responsável vive em cada transação do modelo.',
        deactivateTitle: (name: string) => `Desativar "${name}"?`,
        deactivateBody:
          "O responsável deixa de aparecer nos seletores de transação. As transações já atribuídas a ele continuam como estão.",
      },
    },

    // Spec 68 §2.5 / §2.6 — os quatro diálogos compartilhados pelas páginas de
    // Estrutura: M5 (mesclar), M3 (ver uso), M2 (excluir com realocação) e M4
    // (importar categorias).
    structureDialogs: {
      /** Nome da entidade no título e nos textos. */
      entityLabels: {
        category: "categoria",
        subcategory: "subcategoria",
        institution: "instituição",
        responsibleParty: "responsável",
      },
      /** Rótulo de cada tipo de referência de configuração (`ReferenceKind`). */
      referenceKinds: {
        aliases: "Apelidos",
        templateDefaults: "De-para em templates",
        templateItems: "Transações de modelos",
        widgetFilters: "Filtros de widget",
        accountDefault: "Padrão da conta",
      },

      // ── M5 · Mesclar ────────────────────────────────────────────────────
      merge: {
        title: "Mesclar",
        description:
          "Resolve o caso mais comum de bagunça: dois objetos que significam a mesma coisa.",
        absorbLabel: "Absorver",
        absorbHint: "Será excluída",
        keepLabel: "Manter",
        keepHint: "Recebe tudo",
        placeholder: "Escolha…",
        whatMoves: "O que será movido",
        transactionsChip: (n: number) => (n === 1 ? "1 transação" : `${n} transações`),
        countingTransactions: "contando transações…",
        // D5 — não há undo. O aviso diz isso com todas as letras: é o único momento
        // em que o usuário pode desistir.
        irreversible:
          "A mesclagem é registrada na Trilha de auditoria e NÃO pode ser desfeita. Confira antes de confirmar.",
        confirm: "Mesclar",
        // §2.5 — o botão nomeia o total movido, como o do M2. Numa operação sem undo,
        // o tamanho do que está sendo movido precisa estar no próprio gesto de
        // confirmar, não só numa lista acima dele.
        confirmWithTotal: (total: number) =>
          `Mesclar ${total} ${total === 1 ? "item" : "itens"}`,
        sameObject: "Escolha dois objetos diferentes.",
        success: (absorbed: string, kept: string) => `"${absorbed}" foi mesclada em "${kept}".`,
      },

      // ── M3 · Ver uso ────────────────────────────────────────────────────
      usage: {
        title: (name: string) => `Uso de "${name}"`,
        transactions: "Transações",
        months: "Meses",
        lastUse: "Último uso",
        never: "nunca",
        byMonth: "Por mês",
        noUsage: "Nenhuma transação usa este objeto.",
        countedAt: (when: string) => `Contado em ${when} · cache de 24 h`,
        recount: "Recontar",
        viewTransactions: "Ver as transações",
        close: "Fechar",
      },

      // ── M2 · Excluir com realocação ─────────────────────────────────────
      remove: {
        title: (entityLabel: string, name: string) => `Excluir a ${entityLabel} "${name}"?`,
        description:
          "Referências de configuração são verificadas na hora. O uso em transações precisa ser contado — é o que trava a exclusão.",
        configRefs: "Referências de configuração",
        verified: "verificadas",
        noRefs: "Nenhuma configuração aponta para este objeto.",
        realTransactions: "Transações reais",
        transactionCount: (transactions: number, months: number) =>
          `${transactions} ${transactions === 1 ? "transação" : "transações"} em ${months} ${
            months === 1 ? "mês" : "meses"
          }`,
        countedNow: "contado agora",
        noTransactions: "Nenhuma transação usa este objeto.",
        reallocateTo: "Realocar para",
        // "Sem categoria" é escolha explícita, nunca default silencioso (§2.6).
        noneOption: (entityLabel: string) => `Sem ${entityLabel}`,
        requiredHint:
          'Obrigatório enquanto houver referências. Escolher "sem destino" também é uma opção explícita.',
        // O botão nomeia o total: quem clica sabe o tamanho do que está movendo.
        confirmWithTotal: (total: number) =>
          `Realocar ${total} ${total === 1 ? "item" : "itens"} e excluir`,
        confirmSimple: "Excluir",
        success: "Excluído.",
      },

      // ── M4 · Importar categorias ────────────────────────────────────────
      import: {
        title: "Importar categorias",
        description: "Nada é gravado antes de você conferir esta lista.",
        chooseFile: "Escolher arquivo",
        changeFile: "Trocar arquivo",
        // "Seção padrão" saiu da UI (revisão de estilo) — `seção` e `cor` continuam
        // aceitas no arquivo (planilha antiga não pode quebrar), só que sem destino:
        // a classificação as reporta como ignoradas, nunca as grava.
        fileHint:
          "CSV, XLSX ou JSON com as colunas: nome, pai (seção e cor são aceitas, mas ignoradas)",
        fileSummary: (rows: number) => `${rows} ${rows === 1 ? "linha" : "linhas"}`,
        create: "Criar",
        update: "Atualizar",
        skip: "Ignorar",
        error: "Erro",
        columnAction: "Ação",
        columnName: "Nome",
        columnParent: "Pai",
        columnNote: "Observação",
        actionLabels: {
          create: "criar",
          update: "atualizar",
          skip: "ignorar",
          error: "erro",
        },
        deactivateMissing: "Desativar categorias que não estão no arquivo",
        deactivateMissingHint: "Elas continuam existindo, com as transações intactas.",
        apply: (changes: number) =>
          `Aplicar ${changes} ${changes === 1 ? "mudança" : "mudanças"}`,
        nothingToApply: "Nada a aplicar",
        emptyFile: "O arquivo não tem linhas legíveis.",
        parseError: "Não foi possível ler o arquivo.",
        success: (created: number, updated: number) =>
          `${created} criadas · ${updated} atualizadas.`,
      },
    },

    sections: {
      title: "Seções",
      createButton: "Nova seção",
      createTitle: "Nova seção",
      editTitle: "Editar seção",
      deleteTitle: "Excluir seção",
      nameLabel: "Nome",
      countTypeLabel: "Tipo de contagem",
      isActiveLabel: "Seção ativa",
      isActiveHint: "Seções inativas não aparecem nas páginas de mês",
      countTypes: {
        add: "Somar",
        subtract: "Subtrair",
        ignore: "Ignorar",
        neutral: "Neutro",
      },
      countTypeHints: {
        add: "Valores positivos aumentam o total do mês",
        subtract: "Valores positivos reduzem o total do mês",
        ignore: "Não entra no total do mês",
        neutral: "Entra no total como informativo",
      },
      created: "Seção criada.",
      updated: "Seção atualizada.",
      deleted: "Seção deletada.",
      deleteConfirm: "Tem certeza que deseja deletar esta seção? Esta ação não pode ser desfeita.",
      deleteBlockedByTables:
        "Não é possível deletar: há tabelas financeiras associadas a esta seção.",
      noSections: "Nenhuma seção cadastrada.",
    },
    categories: {
      title: "Categorias",
      createButton: "Nova categoria",
      createSubButton: "Nova subcategoria",
      editTitle: "Editar categoria",
      deleteTitle: "Excluir categoria",
      nameLabel: "Nome",
      created: "Categoria criada.",
      updated: "Categoria atualizada.",
      deleted: "Categoria deletada.",
      subCreated: "Subcategoria criada.",
      subUpdated: "Subcategoria atualizada.",
      subDeleted: "Subcategoria deletada.",
      deleteConfirm:
        "Excluir esta categoria também removerá todas as suas subcategorias. Transações que usavam esta categoria mantêm o histórico, mas sem o vínculo.",
      deleteSubConfirm:
        "Transações vinculadas a esta subcategoria mantêm o histórico, mas perdem o vínculo com ela.",
      noCategories: "Nenhuma categoria cadastrada.",
    },
    backup: {
      title: "Backup da conta",
      description:
        "Exporte toda a conta (configurações, meses, transações, patrimônio) em um arquivo JSON, ou importe um backup.",
      exportButton: "Exportar",
      exportButtonLoading: "Exportando…",
      importButton: "Importar",
      dialogTitle: "Importar backup",
      dialogDescription: "Selecione um arquivo JSON exportado do MyAccountant.",
      chooseFileButton: "Escolher arquivo",
      noFileSelected: "Nenhum arquivo selecionado.",
      parseError: "Arquivo inválido — não é um backup do MyAccountant.",
      previewTitle: "Prévia do backup",
      previewAccountName: (name: string) => `Conta: ${name}`,
      previewTransactions: (n: number) => `${n} transações`,
      previewMonths: (n: number) => `${n} meses`,
      previewCategories: (n: number) => `${n} categorias`,
      modeLabel: "Como importar",
      modeNew: "Nova conta",
      modeOverwrite: "Sobrescrever esta conta",
      modeNewHint: "Cria uma conta nova a partir do backup. Nada da conta atual é alterado.",
      modeOverwriteHint:
        "Substitui TODOS os dados desta conta pelos do backup. Não pode ser desfeito.",
      overwriteAlert: "Isto apaga todos os dados atuais desta conta e substitui pelos do backup.",
      overwriteConfirmLabel: (name: string) => `Digite "${name}" para confirmar`,
      submitButton: "Importar",
      submitButtonLoading: "Importando…",
      importSuccessNew: "Backup importado em uma nova conta.",
      importSuccessOverwrite: "Conta restaurada do backup.",
      importError: "Falha ao importar o backup.",
    },
    institutions: {
      title: "Instituições",
      createButton: "Nova instituição",
      deleteTitle: "Excluir instituição",
      nameLabel: "Nome",
      created: "Instituição criada.",
      updated: "Instituição atualizada.",
      deleted: "Instituição deletada.",
      deleteConfirm:
        "Tem certeza que deseja deletar esta instituição? Transações associadas mantêm o histórico.",
      noInstitutions: "Nenhuma instituição cadastrada.",
    },
    checklist: {
      title: "Checklist mensal",
      subtitle:
        "Tarefas recorrentes que se repetem todo mês (ex.: pagar aluguel, conferir fatura). O estado de conclusão zera a cada mês.",
      createButton: "Nova tarefa",
      addPlaceholder: "Adicionar tarefa…",
      labelLabel: "Descrição",
      labelRequired: "Descrição obrigatória",
      deleteTitle: "Excluir tarefa",
      deleteConfirm:
        "Tem certeza que deseja excluir esta tarefa? Ela some de todos os meses (o histórico de conclusão é perdido).",
      created: "Tarefa criada.",
      updated: "Tarefa atualizada.",
      deleted: "Tarefa excluída.",
      empty: "Nenhuma tarefa cadastrada.",
      moveUp: "Mover para cima",
      moveDown: "Mover para baixo",
    },
    // "Tudo é responsável" (revisão da Spec 68 D4): a UI não distingue mais "grupo" de
    // "pessoa externa" — os dois eram só "responsável com 0..N membros". Criar pela
    // lista nasce sempre `group`, com 0 (nomear alguém externo), 1 (uma persona) ou N
    // membros (um grupo de verdade). `createGroup`/`createExternal`/`addButton` e os
    // textos de modal antigos (`deleteTitle`, `deleteConfirm`, `deleteWarnCount`,
    // `archive`/`unarchive`/`archivedBadge`) saíram: eram do fluxo por modal que o
    // `SettingsGhostRow` + M2/M8 (`structureDialogs`) substituíram, e já estavam
    // mortos (zero referência) antes desta revisão.
    responsibleParties: {
      title: "Responsáveis",
      nameLabel: "Nome",
      iconLabel: "Ícone",
      iconHint: "Opcional — escolha um ícone para representar visualmente.",
      colorLabel: "Cor",
      colorHint: "Opcional — dá um destaque de cor à persona.",
      noneOption: "Nenhum",
      membersLabel: "Membros vinculados",
      // A frase anterior ("Selecione ao menos 2 membros.") descrevia uma regra que não
      // existe mais e mentiria para o usuário: sem ninguém vinculado, o responsável é
      // só um rótulo da transação — é esse o caminho que hoje nomeia alguém externo.
      membersHint: "Vincule quantos membros quiser. Sem nenhum, o responsável é só um rótulo.",
      // Linha de propósito do diálogo, como os outros modais da família Estrutura.
      styleDialogDescription: "Identidade visual e quem este responsável representa.",
      kindPersonal: "Pessoal",
      // `kindGroup`/`kindExternal` só sobrevivem para o agrupamento do seletor de
      // responsável da transação (`ResponsiblePartySelect`, que preserva `kind` no
      // banco). A criação em Configurações não escolhe mais entre eles.
      kindGroup: "Grupo",
      kindExternal: "Externo",
      created: "Responsável criado.",
      updated: "Responsável atualizado.",
      archived: "Responsável arquivado.",
      unarchived: "Responsável reativado.",
      personalHint: "(automático — membro da conta)",
    },
    tableTypes: {
      title: "Tipos de tabela",
      createButton: "Novo tipo",
      createTitle: "Novo tipo de tabela",
      editTitle: "Editar tipo de tabela",
      deleteTitle: "Excluir tipo de tabela",
      createHelperText: "As colunas visíveis podem ser configuradas após criar o tipo.",
      deleteWarning: (n: number) =>
        `Atenção: ${n} tabela(s) usam este tipo. Elas manterão suas configurações atuais após a exclusão.`,
      nameLabel: "Nome do tipo",
      defaultBadge: "Padrão",
      columnsLabel: "Colunas visíveis",
      alwaysVisible: "Sempre visíveis",
      configurable: "Configuráveis",
      layoutLabel: "Layout da linha",
      layoutColumns: "Colunas",
      layoutRich: "Rico (pílulas)",
      layoutColumnsHelp: "Colunas explícitas, com ordenação e busca por coluna.",
      layoutRichHelp: "Descrição em destaque com os demais campos como pílulas.",
      layoutDefaultLocked: "O tipo padrão usa o layout de colunas.",
      created: "Tipo criado.",
      updated: "Tipo atualizado.",
      deleted: "Tipo deletado.",
      deleteConfirm: "Tem certeza? Tabelas que usam este tipo manterão suas configurações.",
      deleteBlockedByTables: "Não é possível deletar: há tabelas financeiras usando este tipo.",
      cannotDeleteDefault: "O tipo padrão não pode ser deletado.",
      noTableTypes: "Nenhum tipo de tabela cadastrado.",
    },
    transactionAliases: {
      title: "Apelidos de Transação",
      subtitle:
        "Um gatilho de texto associado a valores para preencher automaticamente lançamentos recorrentes, na entrada manual e na importação.",
      createButton: "Novo apelido",
      createTitle: "Novo apelido",
      editTitle: "Editar apelido",
      empty: "Nenhum apelido cadastrado.",
      emptyHint:
        "Crie um apelido para preencher categoria, responsável, tags e outros campos automaticamente quando o gatilho aparecer na descrição.",
      triggerLabel: "Gatilho",
      triggerHint: "Texto que, ao aparecer na descrição, sugere este apelido.",
      triggerShortWarning: "Gatilho curto pode casar demais.",
      triggerRegexModeHint:
        "Modo regex ativado: este campo é a expressão regular usada na descrição.",
      priorityLabel: "Prioridade",
      priorityHint:
        "Usada para decidir qual apelido vence quando mais de um casa a mesma transação.",
      priorityHigh: "Alta",
      priorityMedium: "Média",
      priorityLow: "Baixa",
      descriptionLabel: "Descrição a aplicar",
      descriptionHint:
        "Substitui a descrição do lançamento ao aplicar. Deixe em branco para não alterar.",
      swapTriggerDescription: "Trocar gatilho e descrição",
      amountLabel: "Valor a aplicar",
      amountHint: "Deixe em branco para não definir um valor.",
      formIntro:
        "Um apelido guarda um conjunto de campos e os preenche automaticamente quando o gatilho aparece na descrição de um lançamento — na entrada manual e na importação.",
      classificationSectionLabel: "Classificação",
      classificationHint: "Categoria, instituição, responsável e como o lançamento é classificado.",
      advancedSectionLabel: "Gatilho avançado",
      advancedSectionHint:
        "Regras extras para decidir quando este apelido casa. Deixe como está para o comportamento padrão (contém, sem restrições).",
      triggerModeLabel: "Modo do gatilho",
      triggerModeContains: "Contém",
      triggerModeRegex: "Expressão regular (regex)",
      conditionInstitutionLabel: "Instituição (condição)",
      conditionInstitutionHint: "Casa apenas transações desta instituição, além do gatilho.",
      minAmountLabel: "Valor de",
      maxAmountLabel: "Valor até",
      amountRangeHint: "Faixa de valor da transação (opcional). Deixe em branco para não limitar.",
      behaviorSectionLabel: "Valor e status",
      behaviorHint:
        "Valor sugerido e marcadores de status. O valor não é aplicado na importação — o do extrato sempre prevalece.",
      foreignCurrencySectionLabel: "Moeda estrangeira",
      foreignCurrencyHint:
        "Preenchida na importação apenas quando o extrato não traz moeda estrangeira.",
      tagsNotesSectionLabel: "Tags e anotações",
      tagsNotesHint: "Tags e uma anotação livre aplicadas junto com o apelido.",
      tagsLabel: "Tags a aplicar",
      isPendingUnset: "Não definir",
      isPendingTrue: "Pendente",
      isPendingFalse: "Confirmado",
      isFavoriteUnset: "Não definir",
      isFavoriteTrue: "Favorito",
      isFavoriteFalse: "Não favorito",
      expenseTypeClearHint: "Clique novamente no ícone selecionado para limpar.",
      created: "Apelido criado.",
      updated: "Apelido atualizado.",
      archived: "Apelido arquivado.",
      unarchived: "Apelido reativado.",
      deleted: "Apelido excluído.",
      archive: "Arquivar",
      unarchive: "Reativar",
      archivedBadge: "Arquivado",
      deleteTitle: "Excluir apelido",
      deleteConfirm: "Tem certeza? Esta ação não pode ser desfeita.",
      detailsToggle: (n: number) => `${n} ${n === 1 ? "detalhe" : "detalhes"}`,
      showDetailsAria: "Ver detalhes do apelido",
      hideDetailsAria: "Ocultar detalhes do apelido",
      keepsDescription: "mantém a descrição",
      transformAria: (trigger: string, description: string) =>
        `Ao casar "${trigger}", a descrição vira "${description}"`,
    },
  },
  setup: {
    steps: {
      sections: "Seções",
      monthPage: "Página de Mês",
      settings: "Configurações",
      done: "Pronto",
    },
    skip: "Pular",
    next: "Próximo",
    finish: "Concluir",
    sections: {
      title: "Configure suas seções",
      description:
        "Seções organizam suas finanças em grupos (Renda, Gastos, Investimentos). Dentro de cada seção você criará Tabelas Financeiras para registrar suas transações.",
      financeTablesTitle: "Como funcionam as Tabelas Financeiras",
      financeTablesDesc:
        "Dentro de cada seção, crie tabelas para agrupar transações relacionadas. Por exemplo, na seção 'Gastos Fixos' pode criar as tabelas 'Aluguel', 'Internet', 'Streaming'.",
      suggestionsLabel: "Sugestões",
      suggestionsHint: "Clique para pré-preencher o formulário abaixo",
      nameLabel: "Nome da seção",
      countTypeLabel: "Tipo de contagem",
      addButton: "Adicionar seção",
      addedTitle: "Seções adicionadas",
      emptyHint: "Nenhuma seção adicionada. Você pode criar depois em Configurações → Seções.",
      added: "Seção adicionada.",
      deleted: "Seção removida.",
    },
    monthPage: {
      title: "Como funciona a página de mês",
      description:
        "A página de mês é onde você registra e acompanha suas finanças. Cada mês é independente e contém suas seções e tabelas.",
      card1Title: "Criação de meses",
      card1Desc:
        "Cada mês é criado individualmente. Ao criar um mês, suas seções aparecem automaticamente. Navegue entre meses pelo menu superior.",
      card2Title: "Seções e Tabelas",
      card2Desc:
        "Dentro de cada mês, adicione Tabelas Financeiras nas seções. Uma tabela agrupa transações relacionadas (ex: 'Cartão de crédito', 'Conta corrente').",
      card3Title: "Registro de transações",
      card3Desc:
        "Em cada tabela, registre suas transações com data, valor, descrição, categoria, instituição e mais. Importação em massa via CSV/XLSX também é suportada.",
      card4Title: "Totais automáticos",
      card4Desc:
        "O app calcula totais por tabela, por seção e o saldo geral do mês com base no tipo de contagem configurado em cada seção.",
    },
    settings: {
      title: "Configure mais quando quiser",
      description:
        "Acesse Configurações no menu superior para personalizar o app. Principais recursos disponíveis:",
      card1Title: "Categorias",
      card1Desc:
        "Classifique transações por tipo (Alimentação, Transporte, Saúde…). Subcategorias permitem maior granularidade.",
      card2Title: "Instituições",
      card2Desc:
        "Vincule transações a bancos, carteiras ou corretoras para rastrear de onde vem e para onde vai o dinheiro.",
      card3Title: "Colunas Customizadas",
      card3Desc:
        "Adicione campos extras às suas tabelas (ex: Responsável, Parcela, Tipo de Investimento) conforme sua necessidade.",
    },
    done: {
      title: "Tudo pronto!",
      subtitle: "Sua conta está configurada.",
      sectionsCreated: (n: number) =>
        n === 1 ? "1 seção configurada" : `${n} seções configuradas`,
      noSections:
        "Você ainda não criou seções — transações precisam de seções para ser organizadas. Você pode criá-las em Configurações → Seções.",
      createMonth: "Criar meu primeiro mês",
      goToAccount: "Ir para minha conta",
    },
    tour: {
      resetTitle: "Tour de configuração",
      resetDescription:
        "Refaça o tour inicial para relembrar as principais funcionalidades do app.",
      resetButton: "Refazer tour",
      resetSuccess: "Tour reiniciado.",
      resetConfirmTitle: "Refazer o tour?",
      resetConfirmDescription:
        "Você será redirecionado ao tour de configuração no próximo acesso a esta conta.",
      resetConfirm: "Reiniciar",
    },
  },
  onboarding: {
    title: "Criar sua conta financeira",
    subtitle: "Escolha um nome para identificar seu espaço financeiro.",
    accountNameLabel: "Nome da conta",
    accountNamePlaceholder: "Ex: Minha Família, Pessoal",
    createButton: "Criar conta",
    creating: "Criando...",
    created: "Conta criada com sucesso!",
  },
  months: {
    title: "Meses",
    newMonth: "Novo mês",
    noMonths: "Nenhum mês criado ainda.",
    noMonthsSubtitle: "Crie seu primeiro mês para começar a registrar suas finanças.",
    createFirst: "Criar primeiro mês",
    createTitle: "Novo mês",
    yearLabel: "Ano",
    monthLabel: "Mês",
    creating: "Criando...",
    created: "Mês criado com sucesso!",
    autoAppliedAll: (n: number) => `${n} tabela(s) criada(s) automaticamente.`,
    autoAppliedPartial: (ok: number, total: number) =>
      `${ok} de ${total} tabela(s) criada(s) automaticamente.`,
    autoAppliedFailed: "Falha ao criar tabela automaticamente.",
    autoAppliedDetails: "Ver detalhes",
    autoAppliedSuccess: "Criada com sucesso",
    autoAppliedError: "Falha ao criar",
    duplicateError: "Este mês já existe.",
    deleteTitle: "Deletar mês",
    deleteConfirm: "Digite o nome do mês para confirmar:",
    deleteWithTransactionsWarning:
      "Este mês possui transações. Todos os dados serão apagados permanentemente.",
    deleteSuccess: "Mês deletado.",
    summary: "Resumo",
    monthTotal: "Total do mês",
    sectionTotal: "Total da seção",
    noTables: "Nenhuma tabela nesta seção.",
    noTablesSubtitle: "Crie uma tabela financeira para registrar transações.",
    addTable: "Adicionar tabela",
    prevMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    selectMonth: "Selecionar mês",
    // Passo "Automações" do dialog de novo mês (spec 73 §2.4)
    automations: {
      title: (monthLabel: string) => `Automações · ${monthLabel}`,
      description: "Revise o que será criado junto com o mês.",
      continue: "Continuar",
      back: "Voltar",
      create: "Criar mês",
      loading: "Verificando automações...",
      loadError: "Não foi possível verificar as automações. O mês será criado sem elas.",
      kindTableTemplate: "Modelos de tabela",
      kindPendingInstallment: "Parcelas previstas",
      selectedCount: (selected: number, total: number) =>
        `${selected} de ${total} ${total === 1 ? "marcado" : "marcados"}`,
      templateItems: (n: number) => `${n} ${n === 1 ? "item" : "itens"}`,
      installmentPosition: (n: number, total: number) => `${n}/${total}`,
      originManual: "criada na mão",
      originImport: "vem da fatura (import)",
      totalToLaunch: (amount: string, count: number) =>
        `Total a lançar: ${amount} · ${count} ${count === 1 ? "transação" : "transações"}`,
      blocked: {
        missing_section: "seção não configurada no modelo",
        missing_table_type: "tipo de tabela não configurado no modelo",
        section_not_found: "seção destino não encontrada ou inativa",
        table_type_not_found: "tipo de tabela destino não encontrado",
      },
      nothingSelected: "Nenhuma automação marcada — o mês será criado vazio.",
    },
  },
  sections: {
    title: "Seções",
    countTypes: {
      add: "Somar",
      subtract: "Subtrair",
      ignore: "Ignorar",
      neutral: "Neutro",
    },
  },
  financeTables: {
    createButton: "Nova tabela",
    createTitle: "Nova tabela financeira",
    editTitle: "Editar tabela",
    nameLabel: "Nome da tabela",
    sectionLabel: "Seção",
    sourceMethodLabel: "Como criar",
    sourceMethods: {
      empty: "Tabela vazia",
      copy: "Copiar de outra tabela",
      template: "Usar modelo",
    },
    tableTypeLabel: "Tipo de tabela",
    countInMonthLabel: "Contar no total do mês",
    groupByDateLabel: "Agrupar por data",
    groupByDateOn: "Agrupar por data",
    groupByDateOff: "Desagrupar por data",
    resetSort: "Voltar à visualização padrão",
    sourceTableLabel: "Tabela de origem",
    includeTransactions: "Incluir transações",
    updateDates: "Ajustar datas para este mês",
    markAsPending: "Marcar transações como pendentes",
    created: "Tabela criada.",
    updated: "Tabela atualizada.",
    deleted: "Tabela deletada.",
    duplicated: "Tabela duplicada.",
    deleteConfirm: "Tem certeza? Todas as transações desta tabela serão apagadas.",
    menuRename: "Renomear",
    menuChangeType: "Alterar tipo de tabela",
    changeTypeTitle: "Alterar tipo de tabela",
    changeTypeHelperText: "O tipo define quais colunas ficam visíveis nesta tabela.",
    menuDuplicate: "Duplicar",
    menuDelete: "Deletar tabela",
    noTables: "Nenhuma tabela nesta seção.",
    noTablesHint: "Adicione uma tabela para registrar transações.",
    moveTitle: (n: number) => `Mover ${n} transação(ões)`,
    moveNewTableSection: "Configurar nova tabela",
    moveSuccess: (n: number, name: string) => `${n} transação(ões) movida(s) para "${name}".`,
    moveSignHeading: "Sinal do valor",
    moveSignExplanation:
      "As seções de origem e destino tratam o sinal de formas opostas. Escolha o que fazer com o valor:",
    moveSignSample: (v: string) => `Exemplo — hoje lê ${v} na seção atual.`,
    moveSignSampleMulti: (v: string) =>
      `Exemplo (1ª transação selecionada) — hoje lê ${v} na seção atual.`,
    moveSignInvertLabel: "Inverter sinal (preserva o valor exibido)",
    moveSignPreserveLabel: "Preservar valor armazenado",
    moveSignResult: (v: string) => `No destino lerá ${v}`,
  },
  transactions: {
    title: "Transações",
    newTransaction: "Nova transação",
    created: "Transação adicionada",
    confirmDelete: "Deletar esta transação?",
    deleted: "Transação deletada",
    deletedMultiple: "transações deletadas",
    undoDelete: "Desfazer",
    deleteError: "Erro ao deletar. As transações foram restauradas.",
    bulkDeleteTitle: "Deletar transações",
    bulkDeleteConfirm: (n: number) =>
      `Tem certeza que deseja deletar ${n} transação(ões)? Esta ação não pode ser desfeita.`,
    bulkDeleteSuccess: (n: number) => `${n} transação(ões) deletada(s).`,
    investmentTypeLabel: "Tipo de investimento",
    investmentTypeNone: "Nenhum",
    investmentTypes: {
      Ações: "Ações",
      ETF: "ETF",
      FII: "FII",
      "Tesouro Direto": "Tesouro Direto",
      CDB: "CDB",
      "LCI/LCA": "LCI/LCA",
      Fundos: "Fundos",
      Previdência: "Previdência",
      Criptomoedas: "Criptomoedas",
      Outros: "Outros",
    },
    expenseTypeLabel: "Tipo de transação",
    expenseTypeNone: "Não classificado",
    expenseTypes: {
      fixed: "Transação fixa",
      variable: "Transação variável",
      one_time: "Evento único",
    } as Record<string, string>,
    expenseTypeTooltips: {
      fixed: "Transação fixa — se repete todo mês (aluguel, salário, assinatura)",
      variable: "Transação variável — valor muda mês a mês (mercado, transporte)",
      one_time: "Evento único — acontecimento pontual (viagem, presente, IPTU)",
    } as Record<string, string>,
    paymentMethodLabel: "Método de pagamento",
    paymentMethodColumn: "Método",
    paymentMethodNone: "Nenhum",
    paymentMethods: {
      pix: "PIX",
      cash: "Dinheiro",
      credit_card: "Cartão de crédito",
      debit_card: "Cartão de débito",
      bank_transfer: "Transferência",
      boleto: "Boleto",
      other: "Outro",
    } as Record<string, string>,
    sourceLabel: "Origem do lançamento",
    // Barra de ações em massa (BulkActionBar) — Spec 66 BULK-01/02/03. Os
    // setters de campo (categoria, tipo de gasto, forma de pagamento,
    // favoritar) ficam consolidados no diálogo "Editar em massa"; as demais
    // strings da barra reusam chaves já existentes (m.common.*,
    // m.transactions.tags.*, bulkDelete*, expenseType*, paymentMethod*,
    // fields.category) — não duplicadas aqui.
    bulk: {
      // Frame §4: contador em texto puro (não pílula), plural natural.
      selected: (n: number) => `${n} ${n === 1 ? "selecionada" : "selecionadas"}`,
      editTitle: "Editar em massa",
      markPaid: "Marcar pago",
      tags: "Tags",
      delete: "Excluir",
      apply: "Aplicar",
      fieldUnchanged: "(não alterar)",
      categoryRemove: "Remover categoria",
      favorite: "Favoritar",
      markPending: "Marcar pendente",
      unmarkPending: "Desmarcar pendente",
      move: "Mover",
      tagNameLabel: "Nome da tag",
      selectTagPlaceholder: "Selecionar tag...",
    },
    tags: {
      addPlaceholder: "Adicionar tag...",
      noTags: "Sem tags",
      addTooltip: "Adicionar tag",
      removeTooltip: "Remover tag",
      createNew: (name: string) => `Criar "${name}"`,
      limitReached: "Limite de 10 tags atingido",
      editTitle: "Tags",
      colorLabel: "Cor",
      renameLabel: "Renomear",
      deleteLabel: "Remover tag",
      usageCount: (n: number) => `Usada em ${n} transação(ões)`,
      bulkAdd: "Adicionar tag",
      bulkRemove: "Remover tag",
      added: "Tag adicionada.",
      removed: "Tag removida.",
      filterLabel: "Tags",
      loadError: "Erro ao carregar tags.",
    },
    sources: {
      manual: "Lançado manualmente",
      csv_import: "Importado via CSV",
      xlsx_import: "Importado via XLSX",
      template: "Criado por modelo",
      auto_template: "Modelo automático",
      duplicate: "Duplicado",
    } as Record<string, string>,
    fields: {
      occurredOn: "Data",
      amount: "Valor",
      description: "Descrição",
      notes: "Notas",
      notesPlaceholder: "Adicionar nota... (suporta Markdown)",
      category: "Categoria",
      subcategory: "Subcategoria",
      institution: "Instituição",
      isPending: "Pendente",
      // Frame §3: o chip na linha é minúsculo e sem ícone ("pendente").
      isPendingChip: "pendente",
      isFavorite: "Favorito",
      responsibleUser: "Responsável",
      cardInstallment: "Parcela do cartão",
      investmentType: "Tipo de investimento",
      expenseType: "Tipo de transação",
      paymentMethod: "Método de pagamento",
      tags: "Tags",
      source: "Origem",
    },
    installments: {
      badge: (current: number, total: number) => `${current}/${total}`,
      badgeTooltip: (current: number, total: number, description: string) =>
        `Parcela ${current} de ${total} — ${description}`,
      column: "Parcela",
      newInstallment: "Novo parcelamento",
      createTitle: "Criar parcelamento",
      createDescription: "Descrição da compra",
      totalAmount: "Valor total",
      installmentCount: "Número de parcelas",
      perInstallment: "por parcela",
      firstInstallmentDate: "Data da 1ª parcela",
      destinationSection: "Seção destino (parcelas futuras)",
      destinationTableType: "Tipo de tabela destino (opcional)",
      downPayment: "Adicionar entrada diferente",
      downPaymentAmount: "Valor da entrada",
      preview: (count: number, amount: string) => `${count}x ${amount}/mês`,
      createButton: "Criar parcelamento",
      createSuccess: (count: number) =>
        `Parcelamento criado — parcela 1 adicionada, ${count - 1} pendente${count - 1 !== 1 ? "s" : ""}.`,
      convertedOnMonthCreate: (count: number) =>
        `${count} parcelamento${count !== 1 ? "s" : ""} vinculado${count !== 1 ? "s" : ""} automaticamente.`,
      futureInstallmentsInfo: (count: number) =>
        `Parcelas 2–${count} serão criadas automaticamente ao abrir os meses futuros.`,
      panelTitle: "Grupo de parcelamento",
      // Frame §10: cabeçalho do painel = overline "Parcelamento" + descrição em
      // destaque + grid Total/Parcelas/Entrada + barra de progresso.
      panelOverline: "Parcelamento",
      totalShort: "Total",
      installmentsShort: "Parcelas",
      downPaymentShort: "Entrada",
      perInstallmentValue: (count: number, amount: string) => `${count}× ${amount}`,
      launchedProgress: (launched: number, total: number, paid: string) =>
        `${launched} de ${total} lançadas · ${paid} pagos`,
      itemTitle: (n: number, total: number) => `Parcela ${n}/${total}`,
      itemCurrentSuffix: "atual",
      itemForecastSuffix: "prevista",
      itemNotLaunched: "ainda não lançada",
      settleShort: "Quitar parcelas",
      installmentPosition: (current: number, total: number) => `Parcela ${current} de ${total}`,
      statusPaid: "Pago",
      statusPending: "Pendente",
      statusWaiting: "Aguardando mês",
      statusForecast: "prevista",
      paidCount: (paid: number, total: number) =>
        `${paid} de ${total} paga${paid !== 1 ? "s" : ""}`,
      totalLabel: "Total da compra",
      settleButton: "Quitar antecipado",
      settleTitle: "Quitação antecipada",
      settleRemainingLabel: "Parcelas restantes",
      settleTotalRemainingLabel: "Valor total restante",
      settleTargetTableLabel: "Tabela de destino",
      settleModeLabel: "Forma de quitação",
      settleModeIndividual: "Registrar parcelas individuais",
      settleModeIndividualDesc:
        "Cada parcela restante vira uma transação no valor de cada parcela.",
      settleModeConsolidated: "Registrar quitação única",
      settleModeConsolidatedDesc: (total: string) =>
        `Uma única transação de ${total} com descrição "Quitação antecipada — ..."`,
      settleConfirmButton: "Confirmar quitação",
      settleSuccessIndividual: (count: number) =>
        `${count} parcela${count !== 1 ? "s" : ""} registrada${count !== 1 ? "s" : ""} com sucesso.`,
      settleSuccessConsolidated: "Quitação consolidada registrada com sucesso.",
      settleNoTables: "Nenhuma tabela encontrada neste mês.",
      launchNextButton: "Lançar próxima",
      launchNextNoMonth: "Nenhum mês aberto para a próxima parcela",
      launchNextSuccess: "Parcela criada no mês com sucesso.",
      loadError: "Não foi possível carregar as parcelas.",
      undoButton: "Desfazer grupo",
      undoConfirmTitle: "Desfazer grupo de parcelas?",
      undoConfirmBody:
        "As parcelas já lançadas viram transações normais (desvinculadas) e as parcelas futuras pendentes são removidas. Esta ação não pode ser desfeita.",
      undoConfirmCta: "Desfazer grupo",
      undoSuccess: "Grupo de parcelamento desfeito.",
      // Parcela marcada como paga fora do app (spec 73 §2.5)
      itemSettledSuffix: "paga (histórico)",
      itemSettledNote: "paga fora do app",
      markSettled: "Marcar como paga (histórico)",
      unmarkSettled: "Desfazer marcação de paga",
      markSettledSuccess: "Parcela marcada como paga (histórico).",
      unmarkSettledSuccess: "Marcação de paga desfeita.",
      // Criação automática ao abrir mês novo (spec 73 §2.4)
      autoCreateLabel: "Criar automaticamente ao abrir mês novo",
      autoCreateHintOn: "As parcelas futuras entram sozinhas quando você cria o mês.",
      autoCreateHintOff:
        "As parcelas vêm da fatura importada — não são lançadas na criação do mês.",
      autoCreateUpdated: "Preferência de criação automática salva.",
    },
    rowState: {
      hasNote: "tem nota",
      foreignCurrency: "moeda estrangeira",
      links: (n: number) => `${n} ${n === 1 ? "vínculo" : "vínculos"}`,
    },
    attachments: {
      expand: "Ver detalhes da linha",
      collapse: "Ocultar detalhes da linha",
      viewGroup: "Ver grupo",
    },
    actions: {
      viewDetails: "Ver detalhes",
      edit: "Editar",
      duplicate: "Duplicar",
      moveTo: "Mover para…",
      createAlias: "Criar apelido",
      delete: "Deletar",
      addNote: "Adicionar nota",
      hideNotes: "Ocultar notas",
      save: "Salvar",
      cancel: "Cancelar",
      markAsDone: "Marcar como concluída",
      markAsPending: "Marcar como pendente",
      quickConfirm: "Confirmar transação",
      quickMarkPending: "Marcar como pendente",
      quickDuplicate: "Duplicar",
      addToFavorites: "Adicionar aos favoritos",
      removeFromFavorites: "Remover dos favoritos",
      more: "Mais ações",
    },
    aliasSuggestion: {
      header: "Apelido",
      // Frame §11: o cabeçalho do popover nomeia o gatilho casado — Apelido "NETFLIX".
      headerWithTrigger: (trigger: string) => `Apelido "${trigger}"`,
      tooltip: (trigger: string) => `Aplicar apelido "${trigger}"`,
      applyButton: "Aplicar",
      cancelButton: "Agora não",
      applied: (trigger: string, count: number) =>
        `Apelido "${trigger}" aplicado — ${count} campo${count !== 1 ? "s" : ""} atualizado${count !== 1 ? "s" : ""}.`,
      undo: "Desfazer",
      noApplicableFields:
        "Nenhum campo aplicável aqui — os valores já coincidem ou usam campos não suportados nesta tela (ex.: tags).",
    },
    // Modal de detalhe (TransactionDetailDialog) — Spec 66 P3, modelo em abas
    // somente leitura. `title` do DialogShell é neutro (titleNeutral); o valor
    // em destaque vai no cabeçalho do corpo (MoneyValue). Rótulos de campo
    // reusam `fields.*`/`paymentMethods.*`/`expenseTypes.*`/`links.*` — não
    // duplicados aqui.
    detail: {
      titleNeutral: "Transação",
      close: "Fechar",
      // Frame §9: rótulos curtos e valor ausente explícito (traço, não sumir).
      paymentMethodShort: "Forma pagto",
      emptyValue: "—",
      linksTitle: "Vínculos",
      createdBy: "Criada por",
      updatedBy: "Editada por",
      removedUser: "Usuário removido",
      tabs: {
        summary: "Resumo",
        classification: "Classificação",
        installmentsLinks: "Parcelas",
        history: "Histórico",
      },
      emptySummary: "Nenhum detalhe adicional",
      emptyClassification: "Sem classificação preenchida",
      emptyInstallmentsLinks: "Sem parcelas ou vínculos",
      loading: "Carregando…",
      loadError: "Não foi possível carregar os vínculos.",
      reload: "Recarregar",
      openLinked: "Abrir transação vinculada",
    },
    errors: {
      invalidDate: "Data inválida",
      requiredAmount: "Valor é obrigatório",
    },
    filters: {
      title: "Filtros",
      searchPlaceholder: "Buscar por descrição...",
      categories: "Categorias",
      institutions: "Instituições",
      responsible: "Responsável",
      pending: "Pendentes",
      favorite: "Favoritas",
      expenseType: "Tipo de transação",
      source: "Origem",
      tags: "Tags",
      clearAll: "Limpar tudo",
      clearFilters: "Limpar filtros",
      noResults: "Nenhuma transação encontrada",
      noResultsHint: "Nenhuma transação corresponde aos filtros ativos.",
      filteredOf: "de",
      filteredLabel: "filtrado",
    },
    foreignCurrency: {
      label: "Moeda estrangeira",
      currencyLabel: "Moeda (ex.: USD)",
      exchangeRateLabel: "Taxa (R$/unidade)",
      originalAmountLabel: "Valor original",
      fillOriginalAmount: "Preencher valor original",
      calculatedRate: "Taxa calculada automaticamente",
      rateDisplay: (rate: number) => `câmbio R$${rate.toFixed(2)}`,
    },
    links: {
      title: "Vínculos",
      addLink: "Vincular transação",
      manage: "Gerenciar vínculos",
      removeLink: "Remover vínculo",
      types: {
        reimbursed_by: "Reembolsado por",
        paid_for: "Pago por mim para",
        relates_to: "Relacionado a",
      } as Record<string, string>,
      typeHint: {
        reimbursed_by: "Esta despesa foi reembolsada por outra transação",
        paid_for: "Paguei por outra pessoa; esta é a despesa original",
        relates_to: "Vínculo neutro entre as duas transações",
      } as Record<string, string>,
      searchPlaceholder: "Buscar transação por descrição...",
      noResults: "Nenhuma transação encontrada",
      selectType: "Tipo de vínculo",
      confirm: "Vincular",
      empty: "Nenhum vínculo registrado",
      badge: "Tem vínculos",
      notesLabel: "Observação (opcional)",
    },
    // Criação inline de categoria/subcategoria/instituição a partir da linha de
    // transação (CreatableEntitySelect — Spec V3 · Model D).
    options: {
      created: "Opção criada.",
      createError: "Não foi possível criar a opção.",
      noOptions: "Nenhuma opção encontrada",
    },
    // Captura rápida global (Spec 65 NAV-03). Só as strings exclusivas do
    // quick-add moram aqui; título/valor/data/categoria etc. reusam
    // `m.transactions.newTransaction`/`fields.*`/`common.*` (zero duplicação).
  },
  dashboards: {
    title: "Dashboards",
    yearlyTitle: "Visão Anual",
    monthlyTitle: "Mês em detalhe",
    noData: "Nenhum dado para este período.",
    noDataHint: "Crie um mês para começar.",
    yearLabel: "Ano",
    kpi: {
      yearTotal: "Total do Ano",
      monthlyAvg: "Média Mensal",
      bestMonth: "Melhor Mês",
      worstMonth: "Pior Mês",
      pendingCount: "Transações Pendentes",
      monthTotal: "Total do Mês",
      income: "Entradas",
      expenses: "Saídas",
      savingsRate: "Taxa de Poupança",
      topCategory: "Maior Categoria",
      // Spec 38
      budgetHealth: "Saúde do Orçamento",
      transactionCount: "Transações",
    },
    sections: {
      monthlyChart: "Totais por Mês",
      topCategories: "Top Categorias",
      sectionBreakdown: "Por Seção",
      categoryBreakdown: "Por Categoria",
      biggestTransactions: "Maiores Transações",
      favorites: "Favoritas",
      topInstitutions: "Top Instituições",
      evolution: "Evolução Mensal",
      calendarHeatmap: "Gastos por Dia",
      categoryTreemap: "Distribuição por Categoria",
      moneyFlow: "Fluxo de Dinheiro",
      memberBreakdown: "Gastos por Membro",
      memberRadar: "Comparação por Categoria",
      memberTrend: "Tendência por Membro",
      // Spec 38
      institutionBreakdown: "Gastos por Instituição",
      weekChart: "Gastos por Semana",
      memberYearly: "Gastos por Membro no Ano",
    },
    members: {
      unassigned: "Sem responsável",
      formerMemberSuffix: "(ex-membro)",
      uncategorized: "Sem categoria",
      others: "Outros",
      whoSpentMost: "Quem mais gastou",
      viewDonut: "Rosca",
      viewBars: "Barras",
      shareLabel: "Participação",
      emptyTopCategory: "—",
    },
    comparison: {
      label: "Comparar com",
      prevMonth: "Mês anterior",
      prevYear: "Mesmo mês ano anterior",
      avg3months: "Média 3 meses",
      none: "Sem comparação",
      vsPrevMonth: "vs mês anterior",
      vsPrevYear: "vs mesmo mês ano anterior",
      vsAvg3m: "vs média 3 meses",
      noData: "Sem dados para comparar",
    },
    drillDown: {
      title: "Transações",
      empty: "Nenhuma transação neste agrupamento.",
      close: "Fechar",
    },
    heatmap: {
      dayLabel: (day: number) => `Dia ${day}`,
      tooltip: (count: number, value: string) => `${count} transação(ões) · ${value}`,
      noData: "Sem gastos registrados neste dia",
    },
    sankey: {
      total: "Total Disponível",
      savings: "Sobra / Poupança",
      other: "Outros gastos",
      noIncome: "Sem entradas registradas neste mês.",
    },
    treemap: {
      drillHint: "Clique para ver subcategorias",
      back: "← Todas as categorias",
    },
    insights: {
      cardTitle: "Insights",
      spikeTitle: (category: string) => `Pico de gasto em ${category}`,
      spikeBody: (pct: number, current: string, avg: string) =>
        `Você gastou ${current} este mês — ${pct}% acima da média recente (${avg}).`,
      newCategoryTitle: (category: string) => `Nova categoria: ${category}`,
      newCategoryBody: (amount: string) => `Primeira vez com gastos nesta categoria: ${amount}.`,
      budgetRiskTitle: (label: string) => `Orçamento perto do limite: ${label}`,
      budgetRiskBodyCurrent: (percent: number, days: number) =>
        `Você já usou ${percent}% do orçamento e ${
          days === 1 ? "falta 1 dia" : `faltam ${days} dias`
        } no mês.`,
      budgetRiskBodyHistoric: (percent: number) => `Atingiu ${percent}% do orçamento neste mês.`,
      viewBudgetAction: "Ver orçamentos",
      adherenceTitle: (label: string) => `Orçamento sob controle: ${label}`,
      adherenceBody: (months: number) =>
        `Você ficou dentro do limite por ${months} meses seguidos. Continue assim!`,
    },
    nav: {
      yearly: "Anual",
      monthly: "Por Mês",
    },
    widgets: {
      monthly: {
        "kpi-month-total": "Total do Mês",
        "kpi-income": "Entradas",
        "kpi-expenses": "Saídas",
        "kpi-savings-rate": "Taxa de Poupança",
        "kpi-top-category": "Maior Categoria",
        "kpi-pending": "Transações Pendentes",
        budgets: "Orçamentos",
        "daily-heatmap": "Gastos por Dia",
        "category-treemap": "Distribuição por Categoria",
        "money-flow": "Fluxo de Dinheiro",
        "section-breakdown": "Por Seção",
        "category-breakdown": "Por Categoria",
        "top-transactions": "Maiores Transações",
        insights: "Insights",
        "member-breakdown": "Gastos por Membro",
        "member-list": "Ranking de Membros",
        "member-radar": "Comparação por Categoria",
        analysis: "Análise",
        "kpi-custom": "Indicador Personalizado",
        // Spec 38
        "kpi-budget-health": "Saúde do Orçamento",
        "kpi-transaction-count": "Volume de Transações",
        "institution-breakdown": "Gastos por Instituição",
        "week-chart": "Gastos por Semana",
      },
      yearly: {
        "kpi-year-total": "Total do Ano",
        "kpi-income": "Entradas",
        "kpi-expenses": "Saídas",
        "kpi-savings-rate": "Taxa de Poupança",
        "kpi-monthly-avg": "Média Mensal",
        "kpi-best-month": "Melhor Mês",
        "kpi-worst-month": "Pior Mês",
        "kpi-pending": "Transações Pendentes",
        "month-card-grid": "Grid de Meses",
        "monthly-bar-chart": "Totais por Mês",
        "top-categories": "Top Categorias",
        "member-trend": "Tendência por Membro",
        analysis: "Análise",
        "kpi-custom": "Indicador Personalizado",
        // Spec 38
        "kpi-transaction-count": "Volume de Transações",
        "member-yearly": "Gastos por Membro no Ano",
        // Spec 46
        "net-worth-evolution": "Evolução do Patrimônio",
        // Spec 48
        "cashflow-forecast": "Projeção de Caixa",
        // Spec 47
        "goal-progress": "Progresso das Metas",
      },
      month_summary: {
        "kpi-income": "Entradas",
        "kpi-expenses": "Saídas",
        "kpi-balance": "Saldo",
        budgets: "Orçamentos",
        "section-cards": "Resumo por Seção",
        "activity-lists": "Atividade Recente",
        "pending-transactions": "Pendentes",
        "favorite-transactions": "Favoritas",
        "recent-transactions": "Últimas Adicionadas",
        insights: "Insights",
        "kpi-custom": "Indicador Personalizado",
        "filtered-transactions": "Transações Filtradas",
        checklist: "Checklist do Mês",
        // Spec 38
        "kpi-pending": "Transações Pendentes",
        "kpi-transaction-count": "Volume de Transações",
      },
      descriptions: {
        monthly: {
          "kpi-month-total": "Saldo total de entradas e saídas",
          "kpi-income": "Total de entradas no período",
          "kpi-expenses": "Total de saídas no período",
          "kpi-savings-rate": "Percentual da renda poupada",
          "kpi-top-category": "Categoria com maior gasto",
          "kpi-pending": "Transações pendentes no mês",
          budgets: "Progresso dos orçamentos",
          "daily-heatmap": "Intensidade de gastos por dia",
          "category-treemap": "Distribuição visual por categoria",
          "money-flow": "Diagrama Sankey de entradas e saídas",
          "section-breakdown": "Proporção de gastos por seção",
          "category-breakdown": "Proporção de gastos por categoria",
          "top-transactions": "Maiores transações do período",
          insights: "Destaques automáticos: picos, orçamentos em risco e categorias novas",
          "member-breakdown": "Distribuição e ranking de despesas por pessoa no mês",
          "member-list": "Ranking de membros por valor gasto no mês",
          "member-radar": "Gráfico de radar comparando gastos por categoria entre membros",
          analysis: "Gráfico configurável a partir de uma análise",
          "kpi-custom": "Indicador de uma métrica à sua escolha",
          // Spec 38
          "kpi-budget-health": "Percentual médio de utilização dos orçamentos",
          "kpi-transaction-count": "Quantidade de transações no período",
          "institution-breakdown": "Distribuição de saídas por instituição financeira",
          "week-chart": "Gastos agregados por semana do período do mês",
        },
        yearly: {
          "kpi-year-total": "Saldo acumulado no ano",
          "kpi-income": "Total de entradas no ano",
          "kpi-expenses": "Total de saídas no ano",
          "kpi-savings-rate": "Taxa média de poupança anual",
          "kpi-monthly-avg": "Média do saldo por mês",
          "kpi-best-month": "Mês com maior saldo positivo",
          "kpi-worst-month": "Mês com menor saldo",
          "kpi-pending": "Total de transações pendentes",
          "month-card-grid": "Cards com resumo de cada mês",
          "monthly-bar-chart": "Barras de totais e seções por mês",
          "top-categories": "Categorias com maiores gastos",
          "member-trend": "Evolução da despesa de cada pessoa ao longo do ano",
          analysis: "Gráfico configurável a partir de uma análise",
          "kpi-custom": "Indicador de uma métrica à sua escolha",
          // Spec 38
          "kpi-transaction-count": "Quantidade de transações no ano",
          "member-yearly": "Ranking consolidado de gastos por pessoa no ano inteiro",
          // Spec 46
          "net-worth-evolution": "Evolução do patrimônio líquido ao longo do ano",
          // Spec 48
          "cashflow-forecast": "Projeção do seu saldo para os próximos meses, a partir de hoje.",
          // Spec 47
          "goal-progress": "Progresso e ritmo das suas metas de poupança ativas",
        },
        month_summary: {
          "kpi-income": "Total de entradas no período",
          "kpi-expenses": "Total de saídas no período",
          "kpi-balance": "Saldo do mês",
          budgets: "Progresso dos orçamentos",
          "section-cards": "Totais e tabelas por seção",
          "activity-lists": "Transações pendentes, favoritas e recentes",
          "pending-transactions": "Transações aguardando confirmação",
          "favorite-transactions": "Transações marcadas como favoritas",
          "recent-transactions": "Últimas transações registradas no mês",
          insights: "Destaques automáticos: picos, orçamentos em risco e categorias novas",
          "kpi-custom": "Indicador de uma métrica à sua escolha",
          "filtered-transactions": "Lista de transações de um recorte filtrado",
          checklist: "Tarefas recorrentes a concluir no mês",
          // Spec 38
          "kpi-pending": "Transações aguardando confirmação no mês",
          "kpi-transaction-count": "Quantidade de transações no período",
        },
      },
    },
    checklistWidget: {
      addPlaceholder: "Adicionar tarefa…",
      addAria: "Adicionar tarefa",
      empty: "Nenhuma tarefa configurada.",
      emptyEditor: "Nenhuma tarefa ainda. Adicione a primeira abaixo.",
      completedBy: (name: string) => `Concluída por ${name}`,
      completedByUnknown: "Concluída",
      addError: "Não foi possível adicionar a tarefa.",
      toggleError: "Não foi possível atualizar a tarefa.",
      // Vínculo de transação
      linkAction: "Vincular transação",
      unlinkAction: "Desvincular transação",
      linkDialogTitle: "Vincular transação",
      linkSearchPlaceholder: "Buscar transação do mês…",
      linkNoResults: "Nenhuma transação neste mês.",
      linkConfirm: "Vincular",
      linkHint: "Vincular marca a tarefa como concluída.",
      linked: "Transação vinculada.",
      unlinked: "Vínculo removido.",
      linkError: "Não foi possível vincular a transação.",
      unlinkError: "Não foi possível remover o vínculo.",
      linkedNoDescription: "Sem descrição",
    },
    sandbox: {
      title: "Sandbox de Análise",
      openSandbox: "Abrir Sandbox",
      noData: "Sem dados para a configuração selecionada.",
      addToDashboard: "Adicionar ao dashboard",
      addToDashboardTitle: "Adicionar ao dashboard",
      addToDashboardDescription: "Escolha em qual dashboard este gráfico será adicionado.",
      addToDashboardContextLabel: "Dashboard de destino",
      addToDashboardContextMonthly: "Dashboard Mensal",
      addToDashboardContextYearly: "Dashboard Anual",
      addToDashboardConfirm: "Adicionar",
      addToDashboardSuccess: "Análise adicionada ao dashboard.",
      addToDashboardError: "Não foi possível adicionar a análise.",
      controls: {
        period: "Período",
        periodYearAll: "Ano todo",
        periodLast3: "Últimos 3 meses",
        periodLast6: "Últimos 6 meses",
        periodCurrentMonth: "Mês atual",
        year: "Ano",
        month: "Mês",
        groupBy: "Agrupar por",
        groupByMonth: "Meses",
        groupBySection: "Seções",
        groupByCategory: "Categorias",
        groupByInstitution: "Instituições",
        groupByTableType: "Tipos de tabela",
        groupByExpenseType: "Tipos de transação",
        groupBySource: "Origens",
        groupByPaymentMethod: "Métodos de pagamento",
        seriesBy: "Séries por",
        seriesBySection: "Seções",
        seriesByCategory: "Categorias",
        seriesByMember: "Responsáveis",
        seriesByInstitution: "Instituições",
        seriesByTableType: "Tipos de tabela",
        seriesByExpenseType: "Tipos de transação",
        seriesBySource: "Origens",
        seriesByPaymentMethod: "Métodos de pagamento",
        seriesByNone: "Nenhuma",
        metric: "Métrica",
        metricTotal: "Total",
        metricIncome: "Entradas",
        metricExpense: "Saídas",
        metricCount: "Qtd. transações",
        metricAvg: "Média por transação",
        chartType: "Tipo de gráfico",
        chartBarGrouped: "Barras agrupadas",
        chartBarStacked: "Barras empilhadas",
        chartLine: "Linhas",
        chartArea: "Área",
        chartPie: "Pizza",
        chartDonut: "Rosca",
        filters: "Filtros",
        filterSections: "Seções",
        filterCategories: "Categorias",
        filterMembers: "Responsáveis",
        allSelected: "Todas",
      },
    },
  },
  tableModels: {
    title: "Modelos de tabela",
    createButton: "Novo modelo",
    createFromTableButton: "Salvar como modelo",
    saveAsModelTitle: "Salvar tabela como modelo",
    saveModelButton: "Salvar modelo",
    saveModelHelperText: "As transações atuais serão salvas como itens do modelo.",
    renameTitle: "Renomear modelo",
    deleteTitle: "Excluir modelo",
    nameLabel: "Nome do modelo",
    descriptionLabel: "Descrição (opcional)",
    tableTypeLabel: "Tipo de tabela padrão",
    countInMonthLabel: "Contar no total do mês",
    noModels: "Nenhum modelo salvo.",
    noModelsHint: "Salve uma tabela financeira como modelo para reutilizá-la em outros meses.",
    itemCount: (n: number) => `${n} item(ns)`,
    created: "Modelo criado.",
    updated: "Modelo atualizado.",
    deleted: "Modelo deletado.",
    deleteConfirm:
      "Deletar este modelo? Os itens serão removidos, mas as tabelas já criadas a partir dele permanecem.",
    editItems: "Editar itens",
    addItem: "Adicionar item",
    itemDeleted: "Item removido.",
    dayLabel: "Dia do mês",
    applyTitle: "Usar modelo",
    applyButton: "Criar a partir do modelo",
    applied: "Tabela criada a partir do modelo.",
    sourceMethods: {
      template: "Usar modelo",
    },
    autoApplySectionTitle: "Aplicação automática",
    autoApplyLabel: "Aplicar automaticamente ao criar mês",
    autoApplyHint:
      "Ao criar um novo mês, este modelo gerará uma tabela automaticamente na seção configurada.",
    autoApplySection: "Seção de destino",
    autoApplyTableType: "Tipo de tabela",
    autoApplyBadge: "Automático",
  },
  templates: {
    title: "Templates de importação",
    createButton: "Novo template",
    renameTitle: "Renomear template",
    deleteTitle: "Excluir template",
    noTemplates: "Nenhum template salvo.",
    noTemplatesHint: "Templates são criados durante o processo de importação.",
    nameLabel: "Nome do template",
    created: "Template criado.",
    updated: "Template atualizado.",
    deleted: "Template deletado.",
    deleteConfirm: "Tem certeza que deseja deletar este template?",
    mappingLabel: "Configurações de mapeamento",
  },
  csvImport: {
    importButton: "Importar",
    wizardTitle: "Importar arquivo",
    steps: {
      upload: "Upload",
      mapping: "Mapeamento",
      preview: "Pré-visualização",
      config: "Configuração",
    },
    wizard: {
      back: "Voltar",
      next: "Próximo",
      importing: "Importando...",
      noFile: "Selecione um arquivo primeiro.",
      noMapping: "Mapeie as colunas de data e valor.",
      noValidRows: "Nenhuma linha válida para importar.",
      noTableName: "Informe o nome da tabela.",
      noSection: "Selecione uma seção.",
      noTemplateName: "Informe o nome do template.",
      stillParsing: "Aguarde a leitura do arquivo terminar.",
    },
    upload: {
      dropzone: "Arraste o arquivo aqui ou clique para selecionar",
      dropzoneActive: "Solte o arquivo aqui",
      accept: "Aceito: .csv, .xlsx, .xls — Máximo 5 MB",
      invalidType: "Formato inválido. Use .csv, .xlsx ou .xls",
      tooLarge: "Arquivo muito grande. Máximo 5 MB.",
      parseError: "Não foi possível ler o arquivo.",
      rowCount: (n: number) => `${n} linha(s) encontrada(s)`,
      changeFile: "Clique para trocar o arquivo",
    },
    mapping: {
      templateLabel: "Usar template salvo",
      templateNone: "Sem template",
      mapIntro:
        "Ligue cada coluna do arquivo a um campo da transação. A amostra reflete suas escolhas.",
      groupDate: "Data",
      groupAmount: "Valor",
      groupCategorization: "Categorização",
      readingTitle: "Leitura do arquivo",
      sampleTitle: "Amostra do arquivo",
      rawLinesTitle: "Linhas do arquivo",
      derivedTableTitle: "Tabela reconhecida",
      skipRowsHint:
        "Pule as linhas de metadados do banco no topo do arquivo até a linha com os títulos das colunas.",
      lineSkipped: "pulada",
      lineHeader: "cabeçalho",
      rawLineEmpty: "(linha vazia)",
      skippingLines: (n: number) => `pulando ${n} linha${n > 1 ? "s" : ""}`,
      columnsTitle: "Mapeamento de colunas",
      formatTitle: "Formato",
      clearTemplate: "Limpar template e voltar ao padrão",
      dateColumn: "Coluna de data *",
      amountColumn: "Coluna de valor *",
      amountSourceLabel: "Origem do valor",
      amountSourceSingle: "Coluna única",
      amountSourceCreditDebit: "Entrada e saída",
      amountCreditColumn: "Coluna de entrada (crédito) *",
      amountDebitColumn: "Coluna de saída (débito) *",
      amountCreditDebitHint:
        "Valor = entrada − saída. Cada coluna é lida em módulo; o sinal vem de qual coluna tem valor.",
      descriptionColumn: "Coluna de descrição",
      notesColumn: "Colunas de notas",
      notesHint: 'Cada coluna vira uma linha "Nome da coluna: valor" nas notas da transação.',
      categoryColumn: "Coluna de categoria",
      subcategoryColumn: "Coluna de subcategoria",
      institutionColumn: "Coluna de instituição",
      cardInstallmentColumn: "Coluna de parcela (ex: 3/12)",
      investmentTypeColumn: "Coluna de tipo de investimento",
      responsibleUserColumn: "Coluna de responsável (nome no cartão, etc.)",
      fxAmountColumn: "Coluna de valor original (ex: Valor em US$)",
      fxRateColumn: "Coluna de taxa de câmbio (ex: Cotação em R$)",
      fxCurrencyColumn: "Coluna de moeda (ex: USD, EUR)",
      fxCurrencyDefault: "Moeda padrão (quando não há coluna)",
      fxCurrencyDefaultHint: "Código ISO 4217 — ex: USD, EUR, GBP",
      fxSection: "Moeda estrangeira (opcional)",
      responsibleUserMappingsTitle: "Mapear nomes para membros",
      responsibleUserMappingsHint:
        "Cada texto único encontrado na coluna pode ser associado a um membro da conta.",
      noMapping: "— Não mapear —",
      additionalFields: "Campos adicionais",
      dateFormatLabel: "Formato de data",
      amountFormatLabel: "Formato de valor",
      amountSignLabel: "Sinal do valor",
      amountFormats: { brl: "BRL (1.234,56)", us: "US (1,234.56)" },
      amountSigns: { raw: "Manter", invert: "Inverter", abs: "Sempre positivo" },
      advancedTitle: "Opções avançadas",
      createCategoriesLabel: "Criar categorias não encontradas automaticamente",
      createSubcategoriesLabel: "Criar subcategorias não encontradas automaticamente",
      createInstitutionsLabel: "Criar instituições não encontradas automaticamente",
      hasHeaderLabel: "Arquivo tem cabeçalho",
      skipRowsLabel: "Pular linhas iniciais",
      delimiterLabel: "Separador CSV",
      encodingLabel: "Codificação do arquivo",
      formatSuggestion: (fmt: string) => `Amostra parece ${fmt} — aplicar`,
    },
    preview: {
      title: "Pré-visualização",
      statusOk: "OK",
      statusError: "Erro",
      statusIgnored: "Ignorado",
      summary: (ok: number, ignored: number, errors: number) =>
        `${ok} linha(s) serão importadas, ${ignored} ignoradas, ${errors} com erro.`,
      showAll: "Mostrar todas",
      showErrors: "Mostrar só erros",
      okChip: (n: number) => `${n} para importar`,
      ignoredChip: (n: number) => `${n} ignorada(s)`,
      errorChip: (n: number) => `${n} com erro`,
      showingFirst: (n: number) => `exibindo as primeiras ${n} linhas`,
      toggleToIgnore: "Será importada — clique para ignorar",
      toggleToImport: "Ignorada por você — clique para importar",
      statusManualIgnored: "Ignorada (sua escolha)",
      toggleHint: "Clique no status de uma linha válida para ignorá-la (ex: duplicada).",
      aliasChip: (n: number) => `${n} linha${n !== 1 ? "s" : ""} com apelido`,
      aliasOnHeader: (trigger: string) => `Apelido "${trigger}" aplicado nesta linha`,
      aliasOffHeader: (trigger: string) =>
        `Apelido "${trigger}" desativado nesta linha — valores originais do extrato`,
      aliasAlsoDefines: "Também define:",
      aliasClickToIgnore: "Clique para não aplicar nesta linha",
      aliasClickToApply: "Clique para aplicar nesta linha",
      aliasToggleAria: (trigger: string) => `Alternar aplicação do apelido "${trigger}"`,
    },
    config: {
      tableNameLabel: "Nome da tabela",
      sectionLabel: "Seção",
      tableTypeLabel: "Tipo de tabela",
      countInMonthLabel: "Contar no total do mês",
      countInMonthHint: "Desmarque para uma tabela de referência que não soma no resumo do mês.",
      saveTemplateLabel: "Salvar mapeamento como template",
      saveTemplateHint: "Reutilize este mapeamento na próxima importação deste banco.",
      templateNameLabel: "Nome do template",
      confirmButton: "Confirmar importação",
      destinationTitle: "Destino",
      templateTitle: "Mapeamento",
      readySummary: (n: number) => `${n} transação(ões) prontas para importar`,
      destinationPreview: "Vai criar",
    },
    result: {
      success: "Importação concluída",
      importedCount: (n: number) => `${n} transação(ões) importada(s)`,
      skippedCount: (n: number) => `${n} linha(s) ignorada(s)`,
      errorCount: (n: number) => `${n} linha(s) com erro`,
      viewTable: "Ver tabela",
      importAnother: "Importar outro arquivo",
      errorsTitle: "Linhas com erro",
      moreErrors: (n: number) => `... e mais ${n} erro(s)`,
      installmentGroupsCreated: (n: number) => `${n} parcelamento(s) criado(s)`,
      installmentGroupsLinked: (n: number) =>
        `${n} parcela(s) vinculada(s) a parcelamento existente`,
      installmentLinesSkipped: (n: number) =>
        `${n} linha(s) importada(s) sem vínculo — a parcela já estava lançada no grupo`,
    },
    // Vínculo com parcelamento existente no preview (spec 73 §2.3)
    installments: {
      linkToExisting: "vincular ao existente",
      createNewGroup: "criar novo grupo",
      /** Nome acessível do seletor de vínculo (não é texto visível) */
      linkChoiceLabel: (groupDescription: string) => `Vínculo de ${groupDescription}`,
      matchDetail: (installmentCount: number, startDate: string, pendingCount: number) =>
        `parcelamento existente · ${installmentCount} parcelas · início ${startDate} · ${pendingCount} prevista(s)`,
      ambiguousMatch: (n: number) =>
        `${n} parcelamentos existentes parecidos — não foi possível decidir; será criado um grupo novo.`,
    },
  },
  export: {
    buttonLabel: "Exportar",
    csvOption: "CSV",
    csvYearOption: "CSV",
    pdfOption: "PDF",
    noData: "Sem transações para exportar neste período.",
    error: "Erro ao exportar. Tente novamente.",
  },
  budgets: {
    // Spec 47 §2.3/§11 (tabela C13): rótulo migrou de Meta(s) para Orçamento(s)
    // — Metas agora designa exclusivamente as metas de acúmulo (m.goals.*).
    // Namespace/chaves mantidos (código não muda), só os VALORES pt-BR.
    title: "Orçamentos",
    nav: "Orçamento",
    createButton: "Novo orçamento",
    createTitle: "Novo orçamento",
    editTitle: "Editar orçamento",
    deleteTitle: "Excluir orçamento",
    deleteConfirm:
      "Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.",
    noMetas: "Nenhum orçamento configurado.",
    noMetasHint: "Defina orçamentos para acompanhar seus gastos mensais.",
    // U10 (fix wave spec 47): caption na barra de ação — espelha m.goals.activeCount
    // (GoalsManager.tsx, mr:"auto").
    activeCount: (n: number) => `${n} ${n === 1 ? "orçamento ativo" : "orçamentos ativos"}`,
    created: "Orçamento criado.",
    updated: "Orçamento atualizado.",
    deleted: "Orçamento excluído.",
    // Widget mensal (BudgetsWidget) — feedback do fetch de transações no modo full.
    loadingTransactions: "Carregando transações…",
    loadError: "Não foi possível carregar as transações.",
    // Textos dos 3 render modes do BudgetsWidget, centralizados (CLAUDE.md §5.10).
    // `count` mantém a contagem "N orçamento(s)" SEM o "ativo(s)" de `activeCount`: o
    // widget pode filtrar por near_limit, então "ativos" seria impreciso.
    widget: {
      empty: "Sem orçamentos.",
      createHint: "Clique em + para criar.",
      count: (n: number) => `${n} ${n === 1 ? "orçamento" : "orçamentos"}`,
      noTransactions: "Nenhuma transação encontrada para este orçamento neste mês.",
      showingLimit: "Exibindo as 100 transações mais recentes.",
      byCategory: "Por categoria",
      // Fallback quando o widget é usado fora do contexto de um mês (sem monthId): o
      // botão de expandir fica desabilitado e este texto explica o porquê no Tooltip.
      detailUnavailable: "Detalhamento indisponível neste contexto.",
      table: {
        date: "Data",
        description: "Descrição",
        category: "Categoria",
        amount: "Valor",
      },
    },
    // Aba Orçamento (planning/budgets) — visão CONFIG agnóstica de mês (Spec 25).
    targetPerMonth: (amount: string) => `${amount} / mês`,
    targetForPeriod: (amount: string, period: string) => `${amount} · ${period}`,
    history: {
      empty: "Nenhum mês registrado ainda.",
      noData: "Sem dados",
      // BudgetHistoryChart (spec 47 §5.9 fix wave): rótulo da ReferenceLine do
      // valor-alvo e da linha "% do limite" no ChartTooltip. `percentOfLimit` é
      // função (formatação centralizada, CLAUDE.md §5.10 — o "% do limite: N%" não
      // é montado por concatenação no componente).
      limitLabel: "Limite",
      percentOfLimit: (percent: number) => `% do limite: ${percent}%`,
    },
    fields: {
      name: "Nome (opcional)",
      namePlaceholder: "Ex: Limite família",
      section: "Seção",
      category: "Categoria",
      member: "Responsável",
      institution: "Instituição",
      tableType: "Tipo de tabela",
      amount: "Valor alvo",
      alertThreshold: "Alertar em (%)",
      alertThresholdHint: "Percentual do limite para exibir alerta amarelo (1–99)",
      isRecurring: "Recorrente (todos os meses)",
      showInSummary: "Mostrar no resumo do mês",
      year: "Ano",
      month: "Mês",
      noDimension: "— Nenhum —",
    },
    // Contagens por status (spec 47 §5.9). A aba Orçamento é uma visão CONFIG
    // agnóstica de mês (Spec 25) — não há "total gasto do mês vigente" único, então
    // NÃO há hero de KPIs como na aba Metas; estas frases são reusadas no resumo do
    // BudgetDetailDialog (contagem de meses ok/atenção/ultrapassado no histórico).
    hero: {
      okCount: (n: number) => `${n} no controle`,
      attentionCount: (n: number) => `${n} em atenção`,
      exceededCount: (n: number) => `${n} ${n === 1 ? "ultrapassado" : "ultrapassados"}`,
    },
    progress: {
      spent: "Gasto",
      goal: "Orçamento",
      exceeded: "Ultrapassado",
      attention: "Atenção",
      onTrack: "No controle",
      goalsTitle: "Orçamentos do mês",
      summaryTitle: "Orçamentos",
      noGoals: "Nenhum orçamento ativo para este mês.",
      addGoal: "Adicionar orçamento",
      collapseGoals: "Ocultar orçamentos",
      expandGoals: "Ver orçamentos",
    },
    // U13 (fix wave, spec 47): BudgetFormDialog.tsx tinha títulos de seção e
    // mensagens de validação hardcoded (CLAUDE.md §5.10) — extraídos aqui. Follow-up
    // (migração pra RHF+Zod) entregue depois: `errors.*` agora é a fonte única
    // consumida pelo `.superRefine`/validações de `schemas/budget.ts` (fieldState.error
    // do form só exibe o que o schema já valida — zero duplicação de regra).
    form: {
      dimensionsTitle: "Dimensões",
      goalTitle: "Meta",
      periodTitle: "Período",
      errors: {
        noDimension: "Selecione pelo menos uma dimensão",
        sectionCategoryConflict: "Seção e categoria não podem ser combinadas",
        sectionTableTypeConflict: "Seção e tipo de tabela não podem ser combinados",
        amountPositive: "Valor deve ser positivo",
        thresholdRange: "Informe um valor entre 1 e 99",
        yearMonthRequired: "Informe o mês e ano",
        recurringWithPeriod: "Orçamentos recorrentes não devem ter mês/ano específico",
      },
    },
    // Modal de detalhe (BudgetDetailDialog, spec 47 §5.9 fix wave) — resumo do
    // histórico + dimensões. Contagens por status reusam `hero.okCount/attentionCount/
    // exceededCount` (mesma frase "N no controle/em atenção/ultrapassado(s)", já usada
    // no hero de KPIs — não duplica).
    detail: {
      viewHistory: "Ver histórico",
      summaryTitle: "Resumo do histórico",
      dimensionsTitle: "Dimensões",
      averageSpent: "Média de gasto",
      lastMonth: "Último mês",
    },
  },
  netWorth: {
    title: "Patrimônio Líquido",
    assets: "Ativos",
    liabilities: "Passivos",
    newAccount: "Nova conta",
    updateBalances: "Atualizar saldos",
    kindAsset: "Ativo",
    kindLiability: "Passivo",
    nameLabel: "Nome",
    institutionLabel: "Instituição (opcional)",
    balanceLabel: "Saldo",
    dateLabel: "Data",
    archive: "Arquivar",
    unarchive: "Desarquivar",
    deleteTitle: "Excluir conta",
    deleteConfirm:
      "Excluir a conta e todo o histórico de saldos? Esta ação não pode ser desfeita. Prefira arquivar para manter o histórico.",
    created: "Conta criada.",
    updated: "Conta atualizada.",
    archived: "Conta arquivada.",
    deleted: "Conta excluída.",
    balancesSaved: "Saldos atualizados.",
    empty: "Cadastre suas contas e bens para acompanhar seu patrimônio.",
    staleSince: "Atualizado {when}",
    navLabel: "Patrimônio",
    vsPrevMonth: "vs. mês anterior",
    guide: {
      title: "Guia: Patrimônio",
      pages: [
        {
          heading: "O que é",
          blocks: [
            {
              kind: "text",
              text: "A página Patrimônio mostra, num único número, quanto você tem hoje: seu patrimônio líquido. Ele é o total dos seus ativos menos o total dos seus passivos.",
            },
            {
              kind: "list",
              items: [
                "Ativos: tudo o que soma a seu favor — conta corrente, poupança, investimentos, um imóvel.",
                "Passivos: tudo o que você deve — saldo de cartão de crédito, financiamento, empréstimo.",
                "Patrimônio líquido: ativos menos passivos, o número em destaque no topo da página.",
              ],
            },
            {
              kind: "text",
              text: "Enquanto o resto do app acompanha o fluxo do mês (entradas e saídas), esta página acompanha o estoque: a foto do que você possui e do que deve, e como isso evolui ao longo do tempo.",
            },
          ],
        },
        {
          heading: "Configuração",
          blocks: [
            {
              kind: "text",
              text: "Antes de ver seu patrimônio, cadastre as contas que compõem ativos e passivos. É rápido:",
            },
            {
              kind: "steps",
              items: [
                'Clique em "Nova conta".',
                "Escolha o tipo: Ativo ou Passivo. Atenção: o tipo não pode ser alterado depois de salvar.",
                'Dê um nome claro (ex.: "Conta Nubank", "Financiamento do carro").',
                "Opcionalmente, escolha a instituição. Se ela ainda não existir, dá para criar na hora pelo próprio campo.",
                "Salve. Repita para cada conta, investimento ou dívida que quiser acompanhar.",
              ],
            },
            {
              kind: "tip",
              tone: "warning",
              title: "O tipo é definitivo",
              text: "Ativo e passivo não podem ser trocados depois de criados, porque isso reescreveria todo o histórico. Se errar, arquive a conta e crie outra.",
            },
          ],
        },
        {
          heading: "Como usar",
          blocks: [
            {
              kind: "text",
              text: "Com as contas cadastradas, mantenha os saldos atualizados para que o patrimônio reflita a realidade.",
            },
            {
              kind: "list",
              items: [
                "Atualizar saldos: registra de uma vez o saldo de todas as contas ativas numa mesma data. É o fluxo ideal do fechamento do mês.",
                "Atualizar uma conta só: pelo menu (três pontos) de cada linha, você registra ou corrige o saldo de uma conta específica.",
                "Um saldo por data: se registrar de novo na mesma data, o valor anterior é substituído — sem duplicar.",
                "Aviso de saldo antigo: se um saldo passar de cerca de 35 dias sem atualização, aparece um selo alertando que ele está desatualizado.",
                "Variação do mês: o topo mostra quanto o patrimônio subiu ou caiu em relação ao mês anterior, com seta e cor.",
                "Gráfico de evolução: acompanha seu patrimônio líquido mês a mês ao longo do último ano.",
                "Arquivar em vez de excluir: ao vender um bem ou quitar uma dívida, arquive a conta — ela sai do cálculo atual mas o histórico do gráfico continua honesto. Excluir apaga tudo, sem volta.",
              ],
            },
            {
              kind: "tip",
              tone: "info",
              text: "Visualizadores (viewer) veem o patrimônio e o gráfico, mas só quem é owner ou editor pode cadastrar contas e atualizar saldos.",
            },
          ],
        },
        {
          heading: "Exemplos",
          blocks: [
            {
              kind: "example",
              title: "Montando o patrimônio",
              text: "Você cadastra como ativos: Conta corrente R$ 4.500,00, Tesouro Direto R$ 22.000,00 e um carro avaliado em R$ 38.000,00. Como passivos: fatura do cartão R$ 3.200,00 e financiamento do carro R$ 19.000,00. O patrimônio líquido fica: 64.500 menos 22.200 = R$ 42.300,00.",
            },
            {
              kind: "example",
              title: "Fechamento do mês",
              text: 'No fim de julho você clica em "Atualizar saldos", confere a data, e digita o saldo de cada conta (o último valor já vem preenchido). Salvando, todos os saldos daquele dia são gravados de uma vez e o gráfico ganha mais um ponto na curva.',
            },
            {
              kind: "example",
              title: "Quitou uma dívida",
              text: "Você terminou de pagar o financiamento do carro. Em vez de excluir, você arquiva o passivo. Ele deixa de pesar no patrimônio de hoje, mas os meses em que a dívida existia continuam corretos no gráfico.",
            },
          ],
        },
        {
          heading: "Dica final",
          blocks: [
            {
              kind: "tip",
              tone: "success",
              title: "Constância vale mais que precisão",
              text: "Atualize os saldos sempre na mesma época do mês, mesmo que alguns valores sejam aproximados. É a regularidade que faz o gráfico de evolução contar uma história útil sobre o seu progresso.",
            },
            {
              kind: "text",
              text: "Os saldos aqui são informados por você — o app não busca valores no banco automaticamente. Passivos aparecem sempre com valor positivo (o quanto você deve) e são destacados como dívida, nunca como ganho.",
            },
          ],
        },
      ],
    } satisfies PageGuide,
  },
  cashflowForecast: {
    navLabel: "Projeção",
    title: "Projeção de Fluxo de Caixa",
    fromToday: "Projeção a partir de hoje",
    description:
      "Estimativa do seu saldo nos próximos meses, com base em recorrentes, parcelas e hábitos recentes.",
    scenarioLabel: "Cenário",
    scenarios: {
      optimistic: "Otimista",
      realistic: "Realista",
      conservative: "Conservador",
    },
    projected: "projetado",
    known: "conhecido",
    estimate: "estimativa",
    estimateWindow: (n: number) => `média ${n}m`,
    recurringIn: "Recorrentes (entrada)",
    recurringOut: "Recorrentes (saída)",
    installments: "Parcelas",
    estimated: "Estimado (hábitos)",
    monthResult: "Resultado do mês",
    balance: "Saldo acumulado",
    runwayTitle: "Ponto de ruptura",
    runwayLabel: "fica negativo",
    runwayBadge: (month: string) => `Fica negativo em ${month}`,
    noRupture: "Sem ruptura no horizonte",
    trough: (value: string, month: string) => `Menor saldo: ${value} · ${month}`,
    lowData: "Estimativa com poucos dados",
    startingAccrued: "Saldo acumulado",
    startingOverride: "Saldo informado",
    emptyTitle: "Sem dados para projetar",
    emptyDescription: "Cadastre recorrentes e parcelas para ver sua projeção.",
    configureLink: "Configurar projeção",
    guide: {
      title: "Guia: Projeção de Fluxo de Caixa",
      pages: [
        {
          heading: "O que é",
          blocks: [
            {
              kind: "text",
              text: "A Projeção de Fluxo de Caixa estima como seu saldo vai evoluir nos próximos meses, mês a mês, a partir de hoje. Em vez de só olhar o passado, ela projeta o futuro.",
            },
            {
              kind: "text",
              text: "A projeção parte de um saldo de partida e soma, para cada mês adiante, três coisas: seus lançamentos recorrentes (entradas e saídas), as parcelas já previstas e uma estimativa dos seus hábitos de gasto recentes.",
            },
            {
              kind: "list",
              items: [
                "Ponto de ruptura: aponta o mês em que o saldo ficaria negativo, se houver.",
                "Menor saldo (vale): o ponto mais baixo do período e quando ele acontece.",
                "Saldo de partida: de onde a projeção começa a contar.",
              ],
            },
            {
              kind: "tip",
              tone: "info",
              text: "A projeção é sempre recalculada na hora. Ela não fica salva: sempre reflete seus dados e configurações mais recentes.",
            },
          ],
        },
        {
          heading: "Configuração",
          blocks: [
            {
              kind: "text",
              text: 'A qualidade da projeção depende das preferências em Configurações → Projeção. Use o botão "Configurar projeção" no topo da página. Ajuste antes de confiar nos números.',
            },
            {
              kind: "steps",
              items: [
                "Horizonte: escolha quantos meses à frente projetar (3, 6, 12 ou 24).",
                "Cenário padrão: qual cenário aparece ao abrir a página (Otimista, Realista ou Conservador).",
                "Fator otimista (%): quanto reduzir a estimativa de gastos no cenário otimista.",
                "Fator conservador (%): quanto aumentar a estimativa de gastos no cenário conservador.",
                "Janela de estimativa: quantos meses já fechados entram na média dos seus hábitos de gasto (3, 6 ou 12).",
                "Saldo de partida (opcional): informe um valor manual ou deixe vazio para usar o acumulado dos meses já lançados.",
              ],
            },
            {
              kind: "tip",
              tone: "warning",
              text: 'Sem dados suficientes a projeção fica vazia ou pobre. Cadastre seus lançamentos recorrentes e parcelas, e tenha ao menos alguns meses lançados, para que a estimativa faça sentido. Um aviso de "Estimativa com poucos dados" aparece quando o histórico é curto.',
            },
          ],
        },
        {
          heading: "Como usar",
          blocks: [
            {
              kind: "text",
              text: "Na página você vê os cards de resumo no topo e o gráfico de saldo ao longo do tempo. Explore assim:",
            },
            {
              kind: "list",
              items: [
                "Alterne entre Otimista, Realista e Conservador pelo seletor de cenário. É só para visualizar: não altera sua configuração salva.",
                "Acompanhe o ponto de ruptura para antecipar meses de aperto de caixa.",
                "Observe o menor saldo para saber qual será seu momento mais apertado e quando.",
                'Confira o saldo de partida: se estiver como "Saldo informado", vem do valor manual; se "Saldo acumulado", vem dos meses lançados.',
              ],
            },
            {
              kind: "tip",
              tone: "info",
              text: "O cenário escolhido no seletor recalcula o ponto de ruptura e o menor saldo na hora, para baterem com a linha exibida no gráfico.",
            },
          ],
        },
        {
          heading: "Exemplos",
          blocks: [
            {
              kind: "example",
              title: "Mês de aperto à vista",
              text: 'Saldo de partida de R$ 4.200,00. Nos próximos meses entram R$ 6.500,00 de recorrentes e saem R$ 5.900,00, mas em março cai a parcela final de uma viagem (R$ 3.100,00). O card de ponto de ruptura aponta "Fica negativo em março" no cenário conservador, avisando com antecedência.',
            },
            {
              kind: "example",
              title: "Comparando cenários",
              text: "No realista o menor saldo do período é R$ 900,00 em abril. Ao trocar para o conservador (fator de 15%), a estimativa de gastos sobe e o menor saldo cai para -R$ 450,00. Isso mostra a margem de segurança que você tem se os gastos vierem acima da média.",
            },
          ],
        },
        {
          heading: "Dica final",
          blocks: [
            {
              kind: "tip",
              tone: "success",
              text: "Use o cenário conservador para planejar com folga e o otimista para enxergar o teto. Se a projeção parecer distante da realidade, ajuste a janela de estimativa e mantenha recorrentes e parcelas em dia: quanto melhor o cadastro, mais fiel a previsão.",
            },
          ],
        },
      ],
    } satisfies PageGuide,
  },
  planning: {
    guide: {
      title: "Guia: Planejamento",
      pages: [
        {
          heading: "Visão geral",
          blocks: [
            {
              kind: "text",
              text: "O Planejamento é a página onde você define para onde seu dinheiro vai daqui pra frente. Ele reúne duas coisas diferentes em abas separadas: Metas e Orçamento.",
            },
            {
              kind: "list",
              items: [
                "Metas: objetivos de poupança. Você define quanto quer juntar e até quando, e acompanha o progresso conforme faz aportes.",
                "Orçamento: limites de gasto por mês. Você define um teto (ex.: gastar no máximo X em Alimentação) e vê quanto já consumiu.",
              ],
            },
            {
              kind: "tip",
              tone: "info",
              title: "Como escolher a aba",
              text: "Regra simples: se você quer JUNTAR dinheiro, use Metas. Se você quer NÃO PASSAR de um valor, use Orçamento. Metas medem acúmulo; Orçamento mede consumo.",
            },
            {
              kind: "text",
              text: "O Planejamento é compartilhado entre todos os membros da conta. Quem tem papel de leitor (viewer) enxerga tudo, mas não cria nem edita.",
            },
          ],
        },
        {
          heading: "Metas",
          blocks: [
            {
              kind: "text",
              text: "Uma meta é um objetivo de poupança com valor-alvo e, opcionalmente, um prazo. O progresso vem dos aportes que você registra ao longo do tempo.",
            },
            {
              kind: "steps",
              items: [
                "Clique em Nova meta e informe um nome (ex.: Reserva de emergência).",
                "Defina o valor-alvo em reais (quanto você quer juntar).",
                "Opcional: escolha um prazo (data-limite) para atingir a meta.",
                "Opcional: associe uma seção ou categoria de poupança para receber sugestões de aporte.",
              ],
            },
            {
              kind: "list",
              items: [
                "Aportar: registre um valor guardado, com data e uma observação opcional. A barra de progresso sobe.",
                "Ritmo: cada meta mostra um selo — No prazo, Adiantado, Atrasado, Sem aportes ou Atingida.",
                "Aporte mensal necessário: se a meta tem prazo, o app mostra quanto guardar por mês para chegar lá.",
                "Detalhes: abra a meta para ver o gráfico de evolução (real x ritmo ideal), o quanto cada membro contribuiu e o histórico de aportes.",
                "Arquivar: guarde metas concluídas ou abandonadas sem apagar o histórico — elas saem do resumo mas podem voltar.",
              ],
            },
            {
              kind: "tip",
              tone: "info",
              text: "Registrar um aporte é apenas uma anotação de progresso na meta. Não move saldo de conta nem cria lançamento — serve para acompanhar quanto você já juntou.",
            },
          ],
        },
        {
          heading: "Orçamento",
          blocks: [
            {
              kind: "text",
              text: "Um orçamento é um limite de gasto mensal. Você escolhe uma dimensão para controlar e um valor máximo; o app compara com o que já foi gasto no mês.",
            },
            {
              kind: "steps",
              items: [
                "Clique em Novo orçamento.",
                "Escolha a dimensão a controlar: seção, categoria, membro, instituição ou tipo de tabela.",
                "Defina o valor-limite mensal.",
                "Opcional: ajuste o limiar de alerta (padrão 80%) e escolha se o orçamento se repete todo mês.",
              ],
            },
            {
              kind: "list",
              items: [
                "Barra de progresso: mostra gasto vs. limite e o percentual usado.",
                "Status por cor: No limite (ok), Atenção (ao passar do limiar de alerta) e Ultrapassado (chegou a 100% ou mais).",
                "Hero de resumo: total orçado, total gasto e a contagem de orçamentos ok / em atenção / ultrapassados.",
                "Também no dashboard: os orçamentos aparecem no dashboard mensal, junto às linhas de gasto e num bloco dedicado.",
              ],
            },
            {
              kind: "tip",
              tone: "info",
              text: "O orçamento considera apenas os gastos (saídas) do mês. Ele controla limite de gasto — não é usado para metas de receita ou de poupança.",
            },
          ],
        },
        {
          heading: "Exemplos e dicas",
          blocks: [
            {
              kind: "example",
              title: "Uma meta de poupança",
              text: "Reserva de emergência: alvo de R$ 10.000 até dez/2026. Você aporta R$ 800 num mês, R$ 1.200 no outro. A barra sobe e o selo mostra se você está No prazo ou Atrasado. Se estiver faltando, o app indica algo como guardar R$ 1.500/mês para chegar no prazo.",
            },
            {
              kind: "example",
              title: "Um orçamento de gasto",
              text: "Alimentação: limite de R$ 1.200/mês. Ao chegar em R$ 960 (80%), a barra fica em atenção. Passando de R$ 1.200, ela marca Ultrapassado — sinal de que você estourou o teto naquele mês.",
            },
            {
              kind: "tip",
              tone: "success",
              text: "Use as duas juntas: Orçamento segura os gastos do mês e libera sobra; Metas transformam essa sobra em objetivos concretos (viagem, reserva, entrada de imóvel).",
            },
            {
              kind: "tip",
              tone: "warning",
              text: "As sugestões de aporte de uma meta só aparecem se você associar a ela uma seção ou categoria que represente poupança. Sem essa dimensão, o recurso fica inativo.",
            },
          ],
        },
      ],
    } satisfies PageGuide,
  },
  goals: {
    // Hub "Planejamento" (§2.2/§5.1, spec 47) — AppBar + PageHeader do shell.
    navLabel: "Planejamento",
    hubTitle: "Planejamento",
    tabs: {
      goals: "Metas",
      budgets: "Orçamento",
    },

    // Aba Metas (§5.2)
    title: "Metas",
    newGoal: "Nova meta",
    editGoal: "Editar meta",
    // Entrada para o drawer de detalhe (§5.3, Fase 9) — mesma nomenclatura/ícone
    // (VisibilityIcon) do "Ver detalhes" da transação (spec 27, TransactionRow.tsx).
    viewDetails: "Ver detalhes",
    deleteGoal: "Excluir meta",
    deleteConfirm: (name: string) =>
      `Tem certeza que deseja excluir a meta "${name}"? Esta ação não pode ser desfeita.`,
    empty: "Nenhuma meta cadastrada.",
    emptyHint: "Crie metas de poupança para acompanhar seu progresso rumo aos seus objetivos.",
    // Zero metas ATIVAS, mas há metas arquivadas — a seção "Arquivadas" continua visível
    // logo abaixo, então o EmptyState não pode soar como se o dado tivesse sumido.
    emptyArchivedOnly: "Nenhuma meta ativa no momento.",
    emptyArchivedOnlyHint:
      "Você tem metas arquivadas — desarquive uma para retomar o acompanhamento, ou crie uma nova meta.",
    activeCount: (n: number) => `${n} ${n === 1 ? "meta ativa" : "metas ativas"}`,

    // Hero KPIs (§4.6/§5.2) — agregado só das metas ativas.
    totalSaved: "Guardado",
    totalTarget: "Alvo total",
    contributedThisMonth: "Aportado este mês",
    nextDeadline: "Próxima meta",
    noUpcomingDeadline: "Nenhum prazo definido",
    statusOverview: "Status das metas",
    onTrackCount: (n: number) => `${n} no prazo`,
    behindCount: (n: number) => `${n} ${n === 1 ? "atrasada" : "atrasadas"}`,
    achievedCount: (n: number) => `${n} ${n === 1 ? "atingida" : "atingidas"}`,

    // Card de meta (§5.2)
    target: "Alvo",
    saved: "Guardado",
    monthlyNeeded: (v: string) => `Faltam ${v}/mês`,
    overTarget: (v: string) => `${v} acima do alvo`,

    // Badge de ritmo (GOAL-06, §5.5) — chaves = union `Pace` de goal-service.ts.
    pace: {
      achieved: "Atingida",
      on_track: "No prazo",
      ahead: "Adiantado",
      behind: "Atrasado",
      no_contribution: "Sem aportes",
    },

    // Dialog "Aportar" (§5.6)
    contribute: "Aportar",
    contributeTitle: "Registrar aporte",
    contributed: "Aporte registrado.",
    deleteContribution: "Excluir aporte",
    // Função (não string fixa) — o drawer de histórico (§5.3) mostra vários aportes;
    // o alvo precisa aparecer na confirmação para o usuário saber qual está excluindo.
    deleteContributionConfirm: (target: string) =>
      `Tem certeza que deseja excluir o aporte de ${target}? Esta ação não pode ser desfeita.`,
    contributionDeleted: "Aporte excluído.",

    // Campos de formulário — criar/editar meta e registrar aporte (§5.6)
    fields: {
      name: "Nome",
      namePlaceholder: "Ex: Viagem ao Japão",
      targetCents: "Valor alvo",
      deadline: "Prazo (opcional)",
      section: "Seção (opcional)",
      category: "Categoria (opcional)",
      noDimension: "— Nenhuma —",
      amount: "Valor",
      date: "Data",
      notes: "Notas (opcional)",
    },

    // Detalhe da meta — drawer (§5.3)
    deadlineLabel: (date: string) => `Vence em ${date}`,
    glidePathTitle: "Progresso vs. ritmo ideal",
    glidePath: {
      actual: "Acúmulo real",
      ideal: "Ritmo ideal",
      target: "Alvo",
    },
    splitTitle: "Split por membro",
    suggestionsTitle: "Aportes sugeridos",
    // Título qualificado com a dimensão da meta (Fase 12, §5.3) — usado quando
    // `dimensionLabel` vem preenchido (meta tem sectionId/categoryId resolvido pela
    // query, goals.ts:getGoalSuggestions); cai para `suggestionsTitle` quando `null`.
    suggestionsTitleWithDimension: (dimension: string) => `Aportes sugeridos em ${dimension}`,
    suggestionsEmpty: "Nenhum aporte sugerido no momento.",
    suggestionLink: "Vincular",
    suggestionConfirm: "Vincular esta transação como aporte à meta?",
    suggestionLinked: "Aporte vinculado à meta.",
    historyTitle: "Histórico de aportes",
    historyEmpty: "Nenhum aporte registrado ainda.",
    // Fallbacks de exibição (§5.3) — mesma redação de m.transactions.removedUser/
    // links.linkedNoDescription, namespace próprio (cada área mantém suas strings).
    noDescription: "Sem descrição",
    removedUser: "Usuário removido",
    linkedToTransaction: "Vinculado a uma transação",

    // Arquivar (§5.2, DD-02)
    archive: "Arquivar",
    unarchive: "Desarquivar",
    archivedSection: "Arquivadas",
    // Badge neutro no header do drawer de detalhe (Fase 12) — substitui o badge de
    // ritmo (pace) quando a meta está arquivada: "Atrasada"/"Adiantada" não faz
    // sentido fora do acompanhamento ativo. Singular (badge é por-meta), diferente
    // de `archivedSection` (plural, label da seção/lista).
    archivedBadge: "Arquivada",
    archived: "Meta arquivada.",
    unarchived: "Meta desarquivada.",

    // Mensagens de sucesso (CRUD da meta)
    created: "Meta criada.",
    updated: "Meta atualizada.",
    deleted: "Meta excluída.",
  },
  mcpConsent: {
    errorTitle: "Não foi possível continuar",
    invalidClient: "Aplicativo desconhecido ou não registrado.",
    invalidRedirectUri: "Endereço de retorno não corresponde ao aplicativo solicitante.",
    invalidRequest: "A solicitação de autorização é inválida.",
    title: "Conceder acesso",
    subtitle: (clientName: string) =>
      `${clientName} está solicitando acesso aos seus dados financeiros.`,
    accountLabel: "Conta",
    noAccounts: "Você não é membro de nenhuma Account para conceder acesso.",
    scopeReadOnly:
      "Acesso somente leitura — o aplicativo não poderá criar, editar ou excluir dados.",
    lgpdNotice: (clientName: string) =>
      `Os dados consultados serão enviados ao ${clientName} e processados pelo provedor dele.`,
    authorize: "Autorizar",
  },
  mcpConnectors: {
    title: "Connectors de IA",
    description:
      "Aplicativos de IA (ex: Claude) autorizados a acessar os dados financeiros desta conta.",
    emptyTitle: "Nenhum connector autorizado",
    emptyDescription:
      "Quando você autorizar um assistente de IA a acessar esta conta, ele aparecerá aqui.",
    appColumn: "Aplicativo",
    grantedAtColumn: "Autorizado em",
    lastUsedColumn: "Último uso",
    actionsColumn: "Ações",
    neverUsed: "Nunca usado",
    revokeButton: "Revogar",
    revokeTitle: "Revogar acesso",
    revokeConfirm: (clientName: string) =>
      `Tem certeza que deseja revogar o acesso de "${clientName}"? O aplicativo perderá acesso aos dados desta conta imediatamente.`,
    revokeSuccess: "Connector revogado com sucesso.",
  },
  notifications: {
    title: "Notificações",
    empty: "Nenhuma notificação.",
    emptyHint: "Quando membros fizerem alterações, você verá aqui.",
    types: {
      transactions_added: (name: string, count: number, month: string) =>
        `${name} adicionou ${count} ${count === 1 ? "transação" : "transações"} em ${month}`,
      transaction_deleted: (name: string, count: number, month: string) =>
        `${name} deletou ${count} ${count === 1 ? "transação" : "transações"} em ${month}`,
      invite_accepted: (name: string, role: string) => `${name} entrou na conta como ${role}`,
    },
  },
  // Spec 65 §7.1/§10.3 (P1) — AppSidebar. Alguns destinos reusam mensagens já
  // existentes (não duplicadas aqui): m.transactions.newTransaction (Nova
  // transação), m.netWorth.navLabel (Patrimônio), m.goals.navLabel
  // (Planejamento), m.cashflowForecast.navLabel (Projeção),
  // m.settings.nav.members (Membros).
  nav: {
    ariaLabel: "Navegação principal",
    groupPrincipal: "Principal",
    groupManagement: "Gestão",
    months: "Meses",
    dashboards: "Dashboards",
    settings: "Configurações",
    recentMonths: "Meses recentes",
    collapse: "Recolher navegação",
    expand: "Expandir navegação",
    // Spec 65 §10.3 (P4) — Drawer mobile (NAV-05): ícone hambúrguer que abre
    // a sidebar como `Drawer` temporário abaixo do breakpoint `md`.
    openMenu: "Abrir menu de navegação",
  },
  errors: {
    unauthorized: "Você precisa estar logado.",
    forbidden: "Você não tem permissão para esta ação.",
    notFound: "Recurso não encontrado.",
    internal: "Erro inesperado. Tente novamente.",
  },
} as const;
