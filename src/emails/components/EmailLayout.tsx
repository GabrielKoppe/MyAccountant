import { Body, Container, Head, Html, Preview, Section, Tailwind } from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-md rounded bg-white p-8 shadow">
            <Section>
              <p className="text-xl font-bold text-blue-700">MyAccountant</p>
            </Section>
            {children}
            <Section className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
              Você recebeu este email porque tem uma conta no MyAccountant. Se não foi você,
              ignore.
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
