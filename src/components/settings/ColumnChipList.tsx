"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { m } from "@/lib/messages";

const t = m.settings.presentation.tableTypes.columns;
/** Rótulos neutros do modo `toggle`: ali o chip liga/desliga um atributo — não é
 * "remover uma coluna", e "Remover coluna Data da linha anterior" mentiria. */
const chip = m.settings.presentation.chip;

export type ColumnChipItem = {
  key: string;
  label: string;
  /**
   * Coluna obrigatória (Data, Descrição, Valor): sem × e sem alça.
   * Continua ocupando seu lugar na ordem e pode ser contornada por outras.
   */
  locked?: boolean;
  /**
   * Só no modo `toggle`: chip ligado (accent, clique desliga via `onRemove`) ×
   * desligado (esmaecido com `+`, clique liga via `onAdd`). Ignorado nos demais
   * modos — em `visible` todo chip está ligado, em `available` nenhum está.
   */
  selected?: boolean;
};

export type ColumnChipListVariant =
  /** Colunas ativas: arrastáveis pela alça, removíveis pelo ×. */
  | "visible"
  /** Colunas fora da tabela: esmaecidas, com `+` que adiciona ao fim. */
  | "available"
  /** Liga/desliga sem ordem e sem × ("fixadas à esquerda", "ao criar linha nova, herdar"). */
  | "toggle";

export type ColumnChipListProps = {
  items: ColumnChipItem[];
  /** Default `visible`. */
  variant?: ColumnChipListVariant;
  /** Só em `visible`: recebe a lista COMPLETA de chaves já reordenada. */
  onReorder?: (keys: string[]) => void;
  /** `visible`: o ×. `toggle`: desligar um chip ligado. */
  onRemove?: (key: string) => void;
  /** `available`: o `+`. `toggle`: ligar um chip desligado. */
  onAdd?: (key: string) => void;
  /** Frase mostrada quando `items` está vazia. */
  emptyLabel: string;
  /** Nome acessível do grupo de chips. */
  ariaLabel?: string;
  /**
   * Lista inteira sem efeito: chips continuam LEGÍVEIS (eles são o readout do que
   * está configurado) mas param de aceitar clique, arraste e foco.
   *
   * `disabled` NATIVO no `<button>`, e não `pointer-events: none` num contêiner: o
   * segundo só desliga o ponteiro — o chip continuaria tabulável, anunciado como
   * acionável, e disparando pelo Enter.
   */
  disabled?: boolean;
};

/**
 * Chips de coluna (Spec 69 §2.1 / APR-04).
 *
 * **A regra que define este componente: o CORPO DO CHIP É INERTE.** Só a alça
 * arrasta e só o × remove; clicar no rótulo não seleciona, não remove e não
 * reordena. É o que elimina a ambiguidade "arrastar × selecionar" que o protótipo
 * anterior tinha — e é por isso que o rótulo é um `<span>` sem `onClick`, e não um
 * botão com handlers que "não fazem nada": um botão inerte ainda recebe foco,
 * ainda é anunciado como clicável e ainda convida o clique.
 *
 * Nos modos `available` e `toggle` o corpo do chip É clicável, e isso é
 * deliberado: sem arraste e com uma ação única, não existe a ambiguidade que o
 * APR-04 combate — ali o alvo grande é ganho, não risco.
 */
export function ColumnChipList({
  items,
  variant = "visible",
  onReorder,
  onRemove,
  onAdd,
  emptyLabel,
  ariaLabel,
  disabled = false,
}: ColumnChipListProps) {
  // O @dnd-kit gera ids de acessibilidade que divergem entre SSR e cliente; sem
  // este gate o React derruba a hidratação da página inteira. Mesmo padrão de
  // `SortableRows` e `DashboardGridCanvas`.
  //
  // Aqui os `<div>` que o `DndContext` injeta são inofensivos (estamos dentro de
  // `<div>`, não de `<tbody>`) — o gate existe pela hidratação, não pelo HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    // 5px antes de considerar arraste: sem isso um clique no × (que fica no mesmo
    // chip, a poucos pixels da alça) vira início de drag e o botão nunca dispara.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const keys = items.map((item) => item.key);
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = [...keys];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder?.(next);
  }

  const empty = items.length === 0;

  const chips = empty ? (
    <Typography variant="body2" sx={{ color: "text.tertiary" }}>
      {emptyLabel}
    </Typography>
  ) : (
    items.map((item) =>
      variant === "visible" ? (
        <SortableColumnChip key={item.key} item={item} onRemove={onRemove} disabled={disabled} />
      ) : (
        <ActionColumnChip
          key={item.key}
          item={item}
          variant={variant}
          onRemove={onRemove}
          onAdd={onAdd}
          disabled={disabled}
        />
      ),
    )
  );

  const row = (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}
    >
      {chips}
    </Box>
  );

  // Só o modo `visible` ganha a moldura do frame (caixa com borda e fundo de
  // superfície): é o container que diz "esta é a tabela que você está montando".
  // `available` e `toggle` são listas soltas sob o rótulo do bloco.
  const body =
    variant === "visible" ? (
      <Box
        sx={{
          p: 1.25,
          borderRadius: "8px",
          border: 1,
          borderColor: "border.default",
          bgcolor: "background.surface",
        }}
      >
        {row}
      </Box>
    ) : (
      row
    );

  if (variant !== "visible" || empty || !mounted) return body;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {/* `rectSortingStrategy` e não a horizontal: os chips quebram em várias
          linhas, e a estratégia horizontal assume uma fila só. */}
      <SortableContext items={items.map((item) => item.key)} strategy={rectSortingStrategy}>
        {body}
      </SortableContext>
    </DndContext>
  );
}

/** Chip do modo `visible`: alça + rótulo inerte + ×. */
function SortableColumnChip({
  item,
  onRemove,
  disabled = false,
}: {
  item: ColumnChipItem;
  onRemove?: (key: string) => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    // Coluna obrigatória não é ARRASTÁVEL, mas continua sendo alvo de soltura:
    // com `droppable` desligado, arrastar um chip por cima dela travaria a
    // reordenação no meio da lista.
    disabled: { draggable: Boolean(item.locked) || disabled, droppable: false },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { opacity: 0.5 } : {}),
  };

  return (
    <ChipShell
      tone="active"
      disabled={disabled}
      nodeRef={setNodeRef}
      style={style}
      title={item.locked ? t.locked : undefined}
      leading={
        // Sem alça quando a lista está desabilitada: ela não arrasta mais, e um
        // cursor `grab` sobre algo imóvel promete o que não acontece.
        item.locked || disabled ? undefined : (
          <Box
            component="span"
            {...attributes}
            {...listeners}
            aria-label={t.drag(item.label)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              cursor: "grab",
              touchAction: "none",
              "&:active": { cursor: "grabbing" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "accent.primary" },
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 14 }} />
          </Box>
        )
      }
      trailing={
        item.locked ? undefined : (
          <IconButton
            size="small"
            aria-label={t.remove(item.label)}
            onClick={() => onRemove?.(item.key)}
            disabled={disabled}
            sx={{ p: 0.125, color: "inherit" }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        )
      }
    >
      {item.label}
    </ChipShell>
  );
}

/** Chip dos modos `available` e `toggle`: o chip inteiro é o botão. */
function ActionColumnChip({
  item,
  variant,
  onRemove,
  onAdd,
  disabled = false,
}: {
  item: ColumnChipItem;
  variant: Exclude<ColumnChipListVariant, "visible">;
  onRemove?: (key: string) => void;
  onAdd?: (key: string) => void;
  disabled?: boolean;
}) {
  // Em `available` nada está ligado; em `toggle` o próprio item diz.
  const on = variant === "toggle" ? Boolean(item.selected) : false;
  const actionLabel =
    variant === "toggle"
      ? on
        ? chip.toggleOff(item.label)
        : chip.toggleOn(item.label)
      : t.add(item.label);

  if (item.locked) {
    return (
      <ChipShell tone={on ? "active" : "muted"} title={t.locked}>
        {item.label}
      </ChipShell>
    );
  }

  return (
    <ChipShell
      // O TOM sobrevive ao desabilitado (diferente do `ChoiceCard`, que larga a
      // moldura de escolha): aqui o accent é o único readout de "esta coluna está
      // fixada" — apagá-lo faria o bloco desabilitado mentir sobre o que está
      // gravado. Quem diz que não dá para mexer é o `disabled` nativo, o cursor e o
      // motivo escrito sob o bloco.
      tone={on ? "active" : "muted"}
      disabled={disabled}
      onClick={() => (on ? onRemove?.(item.key) : onAdd?.(item.key))}
      ariaLabel={actionLabel}
      ariaPressed={variant === "toggle" ? on : undefined}
      // O `+` é convite a clicar: fora quando o clique não existe.
      leading={on || disabled ? undefined : <AddIcon sx={{ fontSize: 14 }} />}
    >
      {item.label}
    </ChipShell>
  );
}

type ChipShellProps = {
  tone: "active" | "muted";
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  /** Só faz sentido com `onClick` (é o atributo nativo do `<button>`). */
  disabled?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  /**
   * Explicação do chip travado. Atributo nativo, e não `<Tooltip>`: o chip já é
   * um alvo denso e o Tooltip do MUI acrescenta handlers de pointer que competem
   * com a alça de arraste do vizinho.
   */
  title?: string;
  nodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
};

/**
 * A pílula do frame (`.pill`): borda fina, raio 5px, mono-linha, 0.68rem.
 *
 * `active` = accent sobre `accent.primarySubtle`. `muted` = `text.tertiary` sobre
 * fundo sutil — **nunca `text.disabled`**, que mede ~2,1:1 e apagaria o nome da
 * coluna, que é a única informação do chip (§15).
 */
function ChipShell({
  tone,
  children,
  leading,
  trailing,
  onClick,
  disabled = false,
  ariaLabel,
  ariaPressed,
  title,
  nodeRef,
  style,
}: ChipShellProps) {
  const active = tone === "active";
  const interactive = Boolean(onClick) && !disabled;

  return (
    <Box
      ref={nodeRef}
      style={style}
      component={onClick ? "button" : "span"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      // `undefined` no `<span>`: um atributo `disabled` num elemento que não é
      // controle de formulário só renderiza lixo no DOM.
      disabled={onClick ? disabled : undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.875,
        py: 0.375,
        borderRadius: "5px",
        border: 1,
        borderColor: active ? "accent.primary" : "border.subtle",
        bgcolor: active ? "accent.primarySubtle" : "background.subtle",
        color: active ? "accent.primary" : "text.tertiary",
        fontFamily: "inherit",
        fontSize: "0.68rem",
        fontWeight: 500,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        ...(interactive
          ? {
              cursor: "pointer",
              "&:hover": { borderColor: active ? "accent.primary" : "border.strong" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "accent.primary",
                outlineOffset: "1px",
              },
            }
          : {}),
        // Só o cursor muda no desabilitado: nada de `opacity`, que derrubaria o
        // contraste do rótulo — a única informação do chip — abaixo do legível
        // (mesmo motivo pelo qual `muted` é `text.tertiary` e nunca `text.disabled`).
        ...(disabled && onClick ? { cursor: "not-allowed" } : {}),
      }}
    >
      {leading}
      {/*
        O CORPO. `<span>` sem handler, de propósito — ver o cabeçalho do arquivo.
        `pointer-events: none` não é usado aqui porque o chip precisa continuar
        recebendo o `title` do modo travado.
      */}
      <Box component="span">{children}</Box>
      {trailing}
    </Box>
  );
}
