"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SectionCountType } from "@prisma/client";
import type { KeyboardEvent } from "react";

import { RowActionsMenu } from "@/components/settings/RowActionsMenu";
import { SortableRow } from "@/components/settings/SortableRows";
import { StatusCell } from "@/components/settings/StatusCell";
import {
  SettingsEditActions,
  SettingsRowField,
} from "@/components/settings/table/SettingsRowField";
import { SETTINGS_MONO_SX, SettingsSelect } from "@/components/settings/table/SettingsSelect";
import {
  SettingsCell,
  SettingsGripCell,
  SettingsMenuCell,
  SettingsRow as SettingsTableRow,
} from "@/components/settings/table/SettingsTable";
import type { AccentColorKey } from "@/lib/accent-colors";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { SECTION_COUNT_TYPES } from "@/lib/schemas/settings";
import { resolveActive } from "@/lib/settings-status";

import { ColorDot } from "../ColorDot";

import { SectionColorPicker } from "./SectionColorPicker";
import { SectionKindChip } from "./SectionKindChip";

/**
 * Larguras das colunas de CONTEÚDO (Spec 68, revisão de estilo) — compartilhadas com o
 * cabeçalho em `SectionsManager`. A alça e o menu não entram aqui: vêm prontas de
 * `SETTINGS_GRIP_WIDTH`/`SETTINGS_MENU_WIDTH` (`settings-table-tokens.ts`), a mesma
 * medida das outras três páginas da família.
 */
export const SECTION_COLUMN_WIDTHS = {
  kind: 140,
  models: 88,
  status: 160,
} as const;

export type SectionRowData = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
  color: string | null;
  lastUsedAt: Date | string | null;
  modelsCount: number;
};

export type SectionDraft = {
  name: string;
  countType: SectionCountType;
  color: AccentColorKey | null;
};

type Props = {
  section: SectionRowData;
  /** Posição na lista atual — semeia o fallback de cor (Spec 68 §7.4). */
  index: number;
  editing: boolean;
  draft: SectionDraft | null;
  onDraftChange: (next: SectionDraft) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onToggleActive: (next: boolean) => void;
  /** Menu "Desativar" — pede confirmação (M8) antes de chamar `onToggleActive(false)`. */
  onRequestDeactivate: () => void;
  /** Menu "Ver uso" (Spec 68 §2.6 / M3) — abre o `UsageDialog` para esta seção. */
  onViewUsage: () => void;
  onDelete: () => void;
  /** true durante um `useTransition` da página — desabilita o Switch (evita clique duplo). */
  disabled?: boolean;
};

/**
 * Uma linha da tabela de Seções (Spec 68 §2.1 / §7.5 "01 · Seções").
 *
 * Alterna entre visualização e edição inline: não existe mais modal de formulário
 * (item 7 do pacote P2) — "Editar" no menu da linha troca as células de Nome e Tipo por
 * campos, com Enter/Esc no mesmo espírito do `SettingsGhostRow` (mas não é uma linha-
 * fantasma: aqui a linha JÁ existe, só o modo de exibição muda).
 *
 * Moldura (altura, padding, tipografia, ícones) vem inteira de `@/components/settings/
 * table` — a revisão de estilo da Spec 68 fixou essas medidas num módulo só,
 * compartilhado pelas quatro páginas da família Estrutura.
 */
export function SectionRow({
  section,
  index,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onToggleActive,
  onRequestDeactivate,
  onViewUsage,
  onDelete,
  disabled,
}: Props) {
  const t = m.settings.structure.sections;
  const active = resolveActive({ kind: "isActive", isActive: section.isActive });
  const canCommit = !!draft && draft.name.trim().length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!editing) return;
    // Um filho já tratou a tecla (Select aberto escolhendo opção, por exemplo):
    // tratar de novo aqui gravaria a linha junto com a escolha do usuário.
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
      onCancelEdit();
      return;
    }
    if (event.key !== "Enter") return;
    if (!canCommit) return;
    event.preventDefault();
    onCommitEdit();
  }

  return (
    <SortableRow id={section.id} name={section.name} disabled={editing}>
      {({ setNodeRef, style, handle, isDragging }) => (
        <SettingsTableRow
          ref={setNodeRef}
          editing={editing}
          onKeyDown={handleKeyDown}
          sx={{
            opacity: isDragging ? 0.5 : active ? 1 : 0.6,
            transform: style.transform,
            transition: style.transition,
          }}
        >
          <SettingsGripCell>{handle}</SettingsGripCell>

          <SettingsCell>
            {editing && draft ? (
              <Stack direction="row" spacing={layout.inline} alignItems="center">
                <SectionColorPicker
                  value={draft.color}
                  fallbackIndex={index}
                  onChange={(next) => onDraftChange({ ...draft, color: next })}
                />
                <SettingsRowField
                  autoFocus
                  value={draft.name}
                  onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                  inputProps={{ "aria-label": t.columnName }}
                />
              </Stack>
            ) : (
              <Stack direction="row" spacing={layout.inline} alignItems="center" minWidth={0}>
                <ColorDot colorKey={section.color} fallbackIndex={index} />
                <Typography variant="body2" fontWeight={500} noWrap>
                  {section.name}
                </Typography>
              </Stack>
            )}
          </SettingsCell>

          <SettingsCell>
            {editing && draft ? (
              <SettingsSelect
                fullWidth
                value={draft.countType}
                onChange={(event) =>
                  onDraftChange({ ...draft, countType: event.target.value as SectionCountType })
                }
                options={SECTION_COUNT_TYPES.map((type) => ({
                  value: type,
                  label: t.kindLabels[type],
                }))}
                inputProps={{ "aria-label": t.columnKind }}
              />
            ) : (
              <SectionKindChip countType={section.countType} />
            )}
          </SettingsCell>

          <SettingsCell>
            <Typography component="span" sx={SETTINGS_MONO_SX}>
              {section.modelsCount > 0 ? section.modelsCount : t.modelsEmpty}
            </Typography>
          </SettingsCell>

          <SettingsCell>
            <StatusCell
              active={active}
              lastUsedAt={section.lastUsedAt}
              gender="f"
              name={section.name}
              disabled={disabled}
              onToggle={onToggleActive}
            />
          </SettingsCell>

          <SettingsMenuCell>
            {editing ? (
              <SettingsEditActions
                onCancel={onCancelEdit}
                onCommit={onCommitEdit}
                canCommit={canCommit}
                name={section.name}
              />
            ) : (
              <RowActionsMenu
                name={section.name}
                active={active}
                actions={{
                  edit: onStartEdit,
                  toggleActive: active ? onRequestDeactivate : () => onToggleActive(true),
                  viewUsage: onViewUsage,
                  delete: onDelete,
                }}
              />
            )}
          </SettingsMenuCell>
        </SettingsTableRow>
      )}
    </SortableRow>
  );
}
