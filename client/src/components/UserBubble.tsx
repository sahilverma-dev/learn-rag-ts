export default function UserBubble({ text }: { text: string }) {
  return (
    <div
      className="flex justify-end pl-10 sm:pl-24"
      style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <div className="rounded-xl bg-field px-3.5 py-2 text-[13px] leading-relaxed text-ink shadow-hairline">
        {text}
      </div>
    </div>
  );
}