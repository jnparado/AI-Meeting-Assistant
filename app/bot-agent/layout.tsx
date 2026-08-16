export default function BotAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {children}
    </div>
  );
}
