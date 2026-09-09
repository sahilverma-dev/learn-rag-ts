/* Pixel-grid loading state, adapted from the reference Harness. */

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

export default function LoadingState({
  label = "Churning",
  variant = "Dots",
}: {
  label?: string;
  variant?: string;
}) {
  const round = variant === "Dots";
  const delays = variant === "Orbit" ? chevron : chevron;

  return (
    <div role="status" className="flex w-fit items-center gap-2.5">
      <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]">
        {delays.map((delay, index) => (
          <span
            key={index}
            className={`size-[4px] bg-ink ${round ? "rounded-full" : "rounded-[1px]"}`}
            style={{
              opacity: 0.15,
              animation: `pixel-on 650ms ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </span>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
    </div>
  );
}