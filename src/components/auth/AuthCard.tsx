import type { ReactNode } from "react";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { layout } from "@/lib/design-tokens";

type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Slot inferior (ex.: link "Esqueci minha senha"), centralizado. */
  footer?: ReactNode;
};

/**
 * Moldura padrão das telas de autenticação (login, signup, recuperar senha).
 * Card do tema (elevation 0 + borda), título + descrição consistentes e ritmo
 * vertical via tokens de layout. O padding interno vem do tema (layout.card).
 */
export function AuthCard({ title, description, children, footer }: Props) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={layout.stack}>
          <Stack spacing={layout.micro}>
            <Typography variant="h5">{title}</Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}
          </Stack>

          {children}

          {footer ? (
            <Stack alignItems="center" sx={{ pt: layout.micro }}>
              {footer}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
