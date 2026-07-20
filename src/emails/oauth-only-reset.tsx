import { Heading, Text } from "@react-email/components";

import { EmailLayout } from "@/emails/components/EmailLayout";

export type OAuthOnlyResetEmailProps = Record<string, never>;

export function OAuthOnlyResetEmail() {
  return (
    <EmailLayout preview="Sobre o acesso à sua conta MyAccountant">
      <Heading className="text-2xl font-bold text-gray-900">Você usa login com Google</Heading>
      <Text className="text-gray-700">
        Recebemos um pedido de redefinição de senha, mas sua conta não tem senha — você entra pelo
        botão <strong>Entrar com Google</strong>. Use-o na tela de login.
      </Text>
      <Text className="text-sm text-gray-600">
        Se você não fez este pedido, pode ignorar este email.
      </Text>
    </EmailLayout>
  );
}

export const oauthOnlyResetEmailTemplate = {
  subject: "Acesso à sua conta — MyAccountant",
  Component: OAuthOnlyResetEmail,
};

export default OAuthOnlyResetEmail;
