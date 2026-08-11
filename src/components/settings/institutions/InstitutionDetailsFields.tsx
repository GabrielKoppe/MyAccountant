"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SettingsRowField } from "@/components/settings/table/SettingsRowField";
import { layout, typography } from "@/lib/design-tokens";
import { detailFieldsFor, type InstitutionDetails } from "@/lib/institution-details";
import { m } from "@/lib/messages";
import type { InstitutionKindValue } from "@/lib/schemas/settings";

const t = m.settings.structure.institutions;

/**
 * Célula "Detalhes" da lista (Spec 68 §2.3 / §7.3, EST-05).
 *
 * União discriminada por `mode`, não um `editing?: boolean` solto: leitura e edição
 * têm formas de dado incompatíveis (texto formatado vs. `TextField`s controlados +
 * `onChange`), e um prop opcional deixaria o TypeScript aceitar a combinação errada
 * (`mode: "read"` com `onChange`, por exemplo) sem avisar.
 *
 * Consulta SEMPRE `detailFieldsFor(kind)` — nunca reimplementa o vínculo tipo → campos
 * que mora em `@/lib/institution-details` (fonte única, compartilhada com o schema Zod
 * e o service, que fazem o descarte de verdade no servidor).
 */
type ReadProps = {
  mode: "read";
  kind: InstitutionKindValue | null;
  values: InstitutionDetails;
};

type EditProps = {
  mode: "edit";
  kind: InstitutionKindValue | null;
  values: InstitutionDetails;
  onChange: (patch: Partial<InstitutionDetails>) => void;
};

type Props = ReadProps | EditProps;

/** Texto esmaecido em itálico — "—", "defina o tipo…", "corretora não tem detalhes". */
function MutedNote({ children }: { children: string }) {
  return (
    <Typography variant="caption" sx={{ color: "text.tertiary", fontStyle: "italic" }}>
      {children}
    </Typography>
  );
}

/** Valor formatado (fonte mono, como no frame) — "•••• 4471 · fecha 8 / vence 15". */
function MonoValue({ children }: { children: string }) {
  return (
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", fontFamily: typography.fontFamily.mono }}
    >
      {children}
    </Typography>
  );
}

function ReadDetails({ kind, values }: Omit<ReadProps, "mode">) {
  if (!kind) return <MutedNote>{t.detailsEmpty}</MutedNote>;

  switch (kind) {
    case "card": {
      const text = t.cardDetails(
        values.last4 ?? null,
        values.closingDay ?? null,
        values.dueDay ?? null,
      );
      return text ? <MonoValue>{text}</MonoValue> : <MutedNote>{t.detailsEmpty}</MutedNote>;
    }
    case "bank": {
      const text = t.bankDetails(values.branch ?? null, values.accountNo ?? null);
      return text ? <MonoValue>{text}</MonoValue> : <MutedNote>{t.detailsEmpty}</MutedNote>;
    }
    case "company":
      return values.taxId ? (
        <MonoValue>{t.companyDetails(values.taxId)}</MonoValue>
      ) : (
        <MutedNote>{t.detailsEmpty}</MutedNote>
      );
    case "wallet":
    case "broker":
      // Nenhum campo se aplica — explica em vez de deixar a célula vazia (§2.3).
      return <MutedNote>{t.noDetailsFor(t.kindLabels[kind])}</MutedNote>;
  }
}

function EditDetails({ kind, values, onChange }: Omit<EditProps, "mode">) {
  if (!kind) return <MutedNote>{t.kindUnsetHint}</MutedNote>;

  const fields = detailFieldsFor(kind);
  if (fields.length === 0) return <MutedNote>{t.noDetailsFor(t.kindLabels[kind])}</MutedNote>;

  return (
    <Stack direction="row" spacing={layout.inline} flexWrap="wrap" useFlexGap>
      {fields.includes("last4") && (
        <SettingsRowField
          label={t.fields.last4}
          value={values.last4 ?? ""}
          onChange={(e) =>
            onChange({ last4: e.target.value.replace(/\D/g, "").slice(0, 4) || null })
          }
          inputProps={{ inputMode: "numeric", maxLength: 4 }}
          sx={{ width: 84 }}
        />
      )}
      {fields.includes("closingDay") && (
        <SettingsRowField
          type="number"
          label={t.fields.closingDay}
          value={values.closingDay ?? ""}
          onChange={(e) =>
            onChange({ closingDay: e.target.value === "" ? null : Number(e.target.value) })
          }
          inputProps={{ min: 1, max: 28 }}
          sx={{ width: 96 }}
        />
      )}
      {fields.includes("dueDay") && (
        <SettingsRowField
          type="number"
          label={t.fields.dueDay}
          value={values.dueDay ?? ""}
          onChange={(e) =>
            onChange({ dueDay: e.target.value === "" ? null : Number(e.target.value) })
          }
          inputProps={{ min: 1, max: 28 }}
          sx={{ width: 96 }}
        />
      )}
      {fields.includes("branch") && (
        <SettingsRowField
          label={t.fields.branch}
          value={values.branch ?? ""}
          onChange={(e) => onChange({ branch: e.target.value || null })}
          sx={{ width: 104 }}
        />
      )}
      {fields.includes("accountNo") && (
        <SettingsRowField
          label={t.fields.accountNo}
          value={values.accountNo ?? ""}
          onChange={(e) => onChange({ accountNo: e.target.value || null })}
          sx={{ width: 124 }}
        />
      )}
      {fields.includes("taxId") && (
        <SettingsRowField
          label={t.fields.taxId}
          value={values.taxId ?? ""}
          onChange={(e) => onChange({ taxId: e.target.value || null })}
          sx={{ width: 168 }}
        />
      )}
    </Stack>
  );
}

export function InstitutionDetailsFields(props: Props) {
  if (props.mode === "read") return <ReadDetails kind={props.kind} values={props.values} />;
  return <EditDetails kind={props.kind} values={props.values} onChange={props.onChange} />;
}
