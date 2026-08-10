import Box from "@mui/material/Box";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ForecastSettingsForm } from "@/components/settings/ForecastSettingsForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { containers } from "@/lib/design-tokens";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { forecastSettingsSchema } from "@/lib/schemas/forecast";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.settings.nav.forecast);
}

export default async function ForecastSettingsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const settings = await prisma.accountSettings.findUnique({
    where: { accountId },
    select: {
      forecastHorizonMonths: true,
      forecastScenario: true,
      forecastOptimisticPct: true,
      forecastConservativePct: true,
      forecastVariableWindow: true,
      forecastStartBalanceCents: true,
    },
  });

  if (!settings) redirect("/home");

  // Fonte única (schema Zod) preenche defaults e valida o shape vindo do banco.
  const parsed = forecastSettingsSchema.parse(settings);

  return (
    // Spec 67 §2.2/§7.5: cabeçalho (breadcrumb + título + propósito) vem do shell.
    // Sem chip de contagem e sem ação primária — a página é um formulário, e o
    // botão de salvar continua sendo o do próprio `ForecastSettingsForm`
    // (migrar isso para o rodapé `dirtyCount` é escopo da Spec 71).
    <SettingsPageShell
      family="Planejamento"
      title={m.settings.nav.forecast}
      purpose={m.settings.purposes.forecast}
    >
      {/* O container antigo de Configurações limitava a largura em `containers.md`;
          como o shell ocupa a página inteira, a restrição passa a ser do CONTEÚDO —
          formulário largo demais fica ilegível. */}
      <Box sx={{ maxWidth: containers.md }}>
        <ForecastSettingsForm
          accountId={accountId}
          defaultValues={{
            ...parsed,
            // BigInt não serializa nativo RSC→Client — envia como string|null.
            forecastStartBalanceCents:
              parsed.forecastStartBalanceCents !== null
                ? parsed.forecastStartBalanceCents.toString()
                : null,
          }}
        />
      </Box>
    </SettingsPageShell>
  );
}
