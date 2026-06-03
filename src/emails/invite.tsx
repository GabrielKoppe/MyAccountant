import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout } from "@/emails/components/EmailLayout";

export type InviteEmailProps = {
  inviterName: string;
  accountName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
};

export function InviteEmail({
  inviterName,
  accountName,
  role,
  acceptUrl,
  expiresInDays,
}: InviteEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} convidou você para ${accountName}`}>
      <Heading className="text-2xl font-bold text-gray-900">Você foi convidado!</Heading>
      <Text className="text-gray-700">
        <strong>{inviterName}</strong> convidou você para participar da conta{" "}
        <strong>{accountName}</strong> no MyAccountant como <strong>{role}</strong>.
      </Text>
      <Button
        href={acceptUrl}
        className="my-4 inline-block rounded bg-blue-600 px-6 py-3 text-white font-medium"
      >
        Aceitar convite
      </Button>
      <Text className="text-sm text-gray-600">
        O convite expira em {expiresInDays} dias. Se você não esperava este convite, pode ignorá-lo.
      </Text>
    </EmailLayout>
  );
}

export const inviteEmailTemplate = {
  subject: (props: InviteEmailProps) =>
    `${props.inviterName} convidou você para ${props.accountName} no MyAccountant`,
  Component: InviteEmail,
};

export default InviteEmail;
