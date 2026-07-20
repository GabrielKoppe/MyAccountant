import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout } from "@/emails/components/EmailLayout";

export type PasswordResetEmailProps = {
  resetUrl: string;
  expiresInMinutes: number;
};

export function PasswordResetEmail({ resetUrl, expiresInMinutes }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Redefinição de senha do MyAccountant">
      <Heading className="text-2xl font-bold text-gray-900">Redefinir senha</Heading>
      <Text className="text-gray-700">
        Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova.
      </Text>
      <Button
        href={resetUrl}
        className="my-4 inline-block rounded bg-blue-600 px-6 py-3 text-white font-medium"
      >
        Redefinir senha
      </Button>
      <Text className="text-sm text-gray-600">
        O link expira em {expiresInMinutes} minutos. Se você não pediu isso, ignore este email — sua
        senha continua a mesma.
      </Text>
    </EmailLayout>
  );
}

export const passwordResetEmailTemplate = {
  subject: "Redefinição de senha — MyAccountant",
  Component: PasswordResetEmail,
};

export default PasswordResetEmail;
