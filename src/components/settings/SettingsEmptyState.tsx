import Stack from "@mui/material/Stack";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { layout } from "@/lib/design-tokens";

type Props = {
  /** Ícone grande e discreto do objeto (ex: <CategoryIcon sx={{ fontSize: 48 }} />) */
  icon?: ReactNode;
  /** Título curto, sem ponto final */
  title: string;
  /** obrigatória: é a frase que explica o que o objeto faz */
  description: string;
  /** ação primária (Button variant="contained" size="small") */
  action?: ReactNode;
  /** atalho de preset/importação (Button variant="outlined" size="small") */
  shortcut?: ReactNode;
  /** Densidade: "default" para a página inteira, "compact" para dentro de card/aba */
  size?: "default" | "compact";
};

/**
 * Estado vazio das páginas de Configurações (Spec 67 §2.2, regra 6).
 *
 * Envolve o `EmptyState` do design system em vez de reimplementá-lo: a única
 * coisa que falta lá é o SEGUNDO slot de ação — o atalho de preset/importação
 * ("Usar preset padrão", "Importar de arquivo"). Como `EmptyState` expõe um
 * `action` só, os dois botões são compostos aqui e entregues por aquele slot.
 *
 * Diferença de contrato em relação ao `EmptyState`: aqui `description` é
 * OBRIGATÓRIA. A frase do que o objeto faz é o que desfaz a ambiguidade entre
 * "Modelos", "Templates" e "Tipos de tabela" — sem ela o estado vazio não
 * cumpre a regra 6.
 */
export function SettingsEmptyState({
  icon,
  title,
  description,
  action,
  shortcut,
  size = "default",
}: Props) {
  // Ordem do frame: primária à esquerda, atalho à direita. Sem atalho, o
  // `action` vai puro para não embrulhar um botão só num Stack à toa.
  const composedAction = shortcut ? (
    <Stack
      direction="row"
      spacing={layout.inline}
      justifyContent="center"
      // Em telas estreitas os dois botões quebram para linhas separadas em vez
      // de estourar a largura do estado vazio (que é centralizado e limitado).
      flexWrap="wrap"
      useFlexGap
    >
      {action}
      {shortcut}
    </Stack>
  ) : (
    action
  );

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={composedAction}
      size={size}
    />
  );
}
