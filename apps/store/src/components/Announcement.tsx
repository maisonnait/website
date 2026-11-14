/** One line set by the house in the back office (settings.announcement). Empty: nothing shows. */
export function Announcement({ text }: { text: string | null | undefined }) {
  const line = text?.trim();
  if (!line) return null;
  return (
    <p className="announce" dir="auto">
      {line}
    </p>
  );
}
