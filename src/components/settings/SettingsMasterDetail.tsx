"use client";

import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import type { ReactNode } from "react";

import { SettingsEmptyState } from "@/components/settings/SettingsEmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout, typography } from "@/lib/design-tokens";

/**
 * Largura da lista mestre.
 *
 * A Spec 69 §2.1 pede 216–260px; 248 é o ponto em que o resumo do frame
 * (`8 col · pílulas · 2 modelos`) cabe numa linha só na tipografia real do projeto.
 * Abaixo de ~240 o resumo passa a ser truncado logo no primeiro tipo com nome
 * comprido, e o resumo é exatamente a informação que justifica a lista mestre.
 */
const MASTER_WIDTH = 248;

/** Largura de cada item quando a lista vira faixa horizontal (abaixo de `md`). */
const MASTER_STRIP_ITEM_WIDTH = 184;

/**
 * Altura reservada para a linha do nome (px).
 *
 * O `StatusBadge` mede ~21px (12px × 1,4 de entrelinha + 2px de padding em cada
 * lado) contra os ~19px da linha do nome sozinha. Sem reservar a altura, o item
 * COM selo ficaria 2px mais alto que os vizinhos e a régua de divisórias da lista
 * sairia do passo. A reserva vale para todos os itens, com selo ou sem.
 */
const MASTER_NAME_ROW_HEIGHT = "21px";

export type SettingsMasterDetailItem = {
  id: string;
  name: string;
  /** Linha secundária: "8 col · pílulas · 2 modelos", "cartão de crédito · 6 transações". */
  summary?: string;
  /**
   * Selo ao lado do nome ("Padrão"). Opcional: as páginas que não têm um item
   * distinto na lista (Modelos, e as Specs 70–72) simplesmente não o passam, e
   * a altura da linha não muda por causa disso.
   */
  badge?: string;
  /** Item esmaecido (no frame: tipo sem nenhum modelo). Continua selecionável. */
  dimmed?: boolean;
};

export type SettingsMasterDetailProps = {
  items: SettingsMasterDetailItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Título do estado vazio, quando `items` está vazia. */
  emptyLabel: string;
  /**
   * Frase do que o objeto faz (regra 6 da Spec 67).
   *
   * Opcional AQUI — e não no `SettingsEmptyState` — porque o master-detail sempre
   * mora dentro do `SettingsPageShell`, cujo cabeçalho já carrega a frase de
   * propósito obrigatória da página.
   */
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  /** Ação primária do estado vazio ("Novo tipo"). */
  emptyAction?: ReactNode;
  /** Nome acessível da lista mestre — uma lista sem nome é só "navegação". */
  ariaLabel: string;
  /**
   * Rodapé **da coluna de detalhe** (o `<SettingsSaveBar>` das páginas de Tipos e
   * Modelos).
   *
   * Por que ele entra aqui e não no `dirtyCount` do `SettingsPageShell`: o rodapé do
   * shell é irmão da área de conteúdo, então ocupa a largura INTEIRA do painel e
   * corre por baixo da coluna da lista mestre (medido: barra de 1436px sobre uma
   * lista que começa no mesmo x). No frame (telas 05/06) o `.foot` está dentro da
   * coluna de detalhe, ao lado da lista — porque é do detalhe que ele fala: "Salvar
   * tipo" salva o tipo selecionado, não a lista.
   *
   * As páginas de formulário (arquétipo D), que não têm lista mestre, continuam
   * usando o rodapé do shell.
   */
  footer?: ReactNode;
  /** O painel de detalhe. */
  children: ReactNode;
};

/**
 * Arquétipo C da Spec 67: lista mestre à esquerda, detalhe à direita.
 *
 * Usar SEMPRE dentro de um `SettingsPageShell` com `disableContentPadding` — a
 * lista encosta na borda do painel (decisão D16 da Spec 67), e o padding do shell
 * abriria uma faixa morta entre a lista e a divisória.
 *
 * **Dois scrollers, não três.** O shell já cria um contêiner rolável para o
 * conteúdo; se este componente também rolasse por inteiro, a lista e o detalhe
 * rolariam JUNTOS dentro de um terceiro scroller e o teclado nunca saberia qual
 * mover (a Spec 68 já pagou por isso na tabela). Por isso a raiz aqui é
 * `flex: 1; min-height: 0` e NÃO rola: quem rola é a coluna da esquerda e o painel
 * da direita, cada um por si.
 */
export function SettingsMasterDetail({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  emptyDescription,
  emptyIcon,
  emptyAction,
  ariaLabel,
  footer,
  children,
}: SettingsMasterDetailProps) {
  // Sem nenhum item não há o que dividir: a tela inteira vira estado vazio, com o
  // componente do design system (CLAUDE.md proíbe estado vazio sob medida).
  if (items.length === 0) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center" }}>
        <Box sx={{ width: "100%" }}>
          <SettingsEmptyState
            icon={emptyIcon}
            title={emptyLabel}
            description={emptyDescription ?? ""}
            action={emptyAction}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        // Abaixo de `md` a lista vira uma FAIXA ROLÁVEL HORIZONTAL, e não uma
        // lista empilhada de largura total: com 5 tipos de tabela, a lista
        // vertical empurraria o detalhe inteiro para fora da dobra, e o detalhe é
        // o que o usuário veio editar. Colapsar em accordion foi descartado pelo
        // motivo oposto — esconde qual item está selecionado.
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      <Box
        component="nav"
        aria-label={ariaLabel}
        sx={{
          flexShrink: 0,
          width: { xs: "100%", md: MASTER_WIDTH },
          minHeight: 0,
          // Cada eixo rola no breakpoint em que a lista existe naquele eixo.
          overflowX: { xs: "auto", md: "hidden" },
          overflowY: { xs: "hidden", md: "auto" },
          bgcolor: "background.surface",
          // Longhand: o shorthand `borderRight` dentro de um valor responsivo
          // reseta `border-right-color` para `currentColor` e a divisória sai na
          // cor do texto (armadilha da Spec 68 / §15).
          borderRightWidth: { xs: 0, md: "1px" },
          borderRightStyle: "solid",
          borderRightColor: "divider",
          borderBottomWidth: { xs: "1px", md: 0 },
          borderBottomStyle: "solid",
          borderBottomColor: "divider",
        }}
      >
        <List
          disablePadding
          sx={{
            display: { xs: "flex", md: "block" },
            // `min-content` impede o flex de comprimir os itens da faixa
            // horizontal até o resumo virar reticências.
            minWidth: { xs: "min-content", md: 0 },
          }}
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <ListItem key={item.id} disablePadding sx={{ width: { xs: "auto", md: "100%" } }}>
                <ListItemButton
                  selected={selected}
                  onClick={() => onSelect(item.id)}
                  // `selected` do MUI é só classe CSS; sem isto o leitor de tela
                  // não sabe qual item está aberto no detalhe.
                  aria-current={selected || undefined}
                  sx={{
                    borderRadius: 0,
                    display: "block",
                    px: 1.25,
                    py: 1,
                    width: { xs: MASTER_STRIP_ITEM_WIDTH, md: "100%" },
                    // A faixa de 2px é reservada em `transparent` também quando o
                    // item NÃO está ativo — senão o texto salta 2px a cada troca
                    // de seleção.
                    borderLeftWidth: "2px",
                    borderLeftStyle: "solid",
                    borderLeftColor: "transparent",
                    borderBottomWidth: { xs: 0, md: "1px" },
                    borderBottomStyle: "solid",
                    borderBottomColor: "divider",
                    borderRightWidth: { xs: "1px", md: 0 },
                    borderRightStyle: "solid",
                    borderRightColor: "divider",
                    // Mesmo padrão de "ativo" do `SettingsNav`: fundo sutil, barra
                    // de 2px em accent e rótulo em accent/600. A barra fica à
                    // ESQUERDA (o nav a põe à direita) porque aqui a borda direita
                    // já é a divisória com o painel de detalhe — duas linhas no
                    // mesmo lugar leriam como uma borda grossa.
                    "&.Mui-selected": {
                      bgcolor: "background.subtle",
                      borderLeftColor: "accent.primary",
                      "& .MuiListItemText-primary": {
                        color: "accent.primary",
                        fontWeight: typography.fontWeight.semibold,
                      },
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      // Linha própria (e não `item.name` cru) porque o selo precisa
                      // ficar NA linha do nome, sem empurrar o resumo para baixo:
                      // o nome encolhe e vira reticências, o selo nunca.
                      <Box
                        component="span"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: layout.inline,
                          minWidth: 0,
                          minHeight: MASTER_NAME_ROW_HEIGHT,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </Box>
                        {item.badge && (
                          <Box component="span" sx={{ flexShrink: 0, display: "inline-flex" }}>
                            <StatusBadge variant="neutral">{item.badge}</StatusBadge>
                          </Box>
                        )}
                      </Box>
                    }
                    secondary={item.summary}
                    primaryTypographyProps={{
                      noWrap: true,
                      fontSize: "0.79rem",
                      fontWeight: typography.fontWeight.medium,
                      // Esmaecido = `text.tertiary`, nunca `text.disabled`: o nome
                      // do item é informação, e em `text.disabled` mede ~2,1:1.
                      color: item.dimmed ? "text.tertiary" : "text.secondary",
                    }}
                    secondaryTypographyProps={{
                      noWrap: true,
                      fontSize: "0.68rem",
                      color: "text.tertiary",
                    }}
                    sx={{ my: 0, minWidth: 0 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Coluna de detalhe: o conteúdo rola, o rodapé fica preso embaixo DELA. */}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {children}
        </Box>

        {footer && <Box sx={{ flexShrink: 0 }}>{footer}</Box>}
      </Box>
    </Box>
  );
}
