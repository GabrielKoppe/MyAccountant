"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";

import { completeOnboardingAction } from "@/actions/onboarding";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { StepDone } from "./StepDone";
import { StepMonthPage } from "./StepMonthPage";
import { StepSections, type OnboardingSection } from "./StepSections";
import { StepSettings } from "./StepSettings";

const STEPS = [
  m.setup.steps.sections,
  m.setup.steps.monthPage,
  m.setup.steps.settings,
  m.setup.steps.done,
] as const;

type Props = {
  accountId: string;
  lastMonth: { year: number; month: number } | null;
};

export function OnboardingWizard({ accountId, lastMonth }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [activeStep, setActiveStep] = useState(0);
  const [sections, setSections] = useState<OnboardingSection[]>([]);

  async function advance() {
    if (activeStep === STEPS.length - 2) {
      const result = await completeOnboardingAction(accountId, {});
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    }
    setActiveStep((prev) => prev + 1);
  }

  const stepTitles: Record<number, string> = {
    0: m.setup.sections.title,
    1: m.setup.monthPage.title,
    2: m.setup.settings.title,
    3: m.setup.done.title,
  };

  return (
    <Container maxWidth="sm" sx={{ py: layout.page }}>
      {/* Cabeçalho */}
      <Box sx={{ textAlign: "center", mb: layout.section }}>
        <Typography variant="h2" gutterBottom>
          {m.setup.steps.done === STEPS[activeStep] ? m.setup.done.title : "Configurar minha conta"}
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: layout.section }}>
        {STEPS.map((label, index) => (
          <Step key={label} completed={index < activeStep}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Conteúdo da etapa */}
      <Card>
        <CardContent sx={{ p: layout.card }}>
          {activeStep < STEPS.length - 1 && (
            <Typography variant="h4" gutterBottom>
              {stepTitles[activeStep]}
            </Typography>
          )}

          {activeStep === 0 && (
            <StepSections
              accountId={accountId}
              sections={sections}
              onSectionAdded={(s) => setSections((prev) => [...prev, s])}
              onSectionRemoved={(id) => setSections((prev) => prev.filter((s) => s.id !== id))}
              onNext={advance}
            />
          )}
          {activeStep === 1 && <StepMonthPage onNext={advance} />}
          {activeStep === 2 && <StepSettings onNext={advance} />}
          {activeStep === 3 && (
            <StepDone accountId={accountId} sections={sections} lastMonth={lastMonth} />
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
