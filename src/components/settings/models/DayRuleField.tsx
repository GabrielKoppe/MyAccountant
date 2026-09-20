"use client";

import { useMemo } from "react";

import {
  SettingsSelect,
  type SettingsSelectOption,
} from "@/components/settings/table/SettingsSelect";
import {
  DAY_RULE_FIRST_BUSINESS,
  DAY_RULE_LAST,
  formatDayRule,
  parseDayRule,
} from "@/lib/day-rule";
import { m } from "@/lib/messages";

const t = m.settings.presentation.models.transactions.dayRule;

/**
 * Opções do campo Dia (Spec 69 §2.2).
 *
 * **As relativas vêm primeiro, e não no fim da lista de 31.** São elas a novidade
 * da spec e a razão de o campo existir — enterradas depois de "dia 31" o usuário
 * nunca as encontraria. Depois delas, os 31 dias fixos na ordem natural.
 */
function buildOptions(): SettingsSelectOption[] {
  const relative: SettingsSelectOption[] = [
    { value: DAY_RULE_LAST, label: t.last },
    { value: DAY_RULE_FIRST_BUSINESS, label: t.firstBusiness },
  ];
  const fixed: SettingsSelectOption[] = Array.from({ length: 31 }, (_, index) => ({
    value: String(index + 1),
    label: t.fixed(index + 1),
  }));
  return [...relative, ...fixed];
}

export type DayRuleFieldProps = {
  /** `"5"` | `"last"` | `"firstBusiness"`. */
  value: string;
  onChange: (dayRule: string) => void;
  disabled?: boolean;
};

/**
 * O campo "Dia" de uma transação de modelo — relativo, não uma data.
 *
 * O valor gravado é `dayRule` (`"5"`, `"last"`, `"firstBusiness"`); quem resolve
 * para a data real do mês em que a tabela nascer é `resolveDayRule`, na criação
 * do mês. A coluna legada `day` é mantida em espelho pelo serviço — a UI não
 * precisa saber disso.
 */
export function DayRuleField({ value, onChange, disabled = false }: DayRuleFieldProps) {
  // 33 opções montadas uma vez por montagem do campo, não a cada tecla digitada
  // em outra célula da mesma linha.
  const options = useMemo(() => buildOptions(), []);

  return (
    <SettingsSelect
      fullWidth
      value={value}
      onChange={(event) => onChange(String(event.target.value))}
      options={options}
      disabled={disabled}
      inputProps={{ "aria-label": t.label }}
      // Menu alto: com 33 opções o default do MUI cresce até o rodapé da janela.
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 280 } } } }}
    />
  );
}

/** Rótulo de leitura — "dia 5", "último dia", "primeiro dia útil". */
export function dayRuleLabel(dayRule: string | null, fallbackDay: number): string {
  return formatDayRule(parseDayRule(dayRule, fallbackDay));
}
