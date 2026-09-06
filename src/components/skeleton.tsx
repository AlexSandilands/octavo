// A grey bar standing in for text or a picture while a page loads. The
// skeletons are drawn with the same rules the real page uses, so the layout
// arrives before the words do. Pulses only when motion is welcome.
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-newsprint-deep rounded-ui motion-safe:animate-pulse ${className}`}
    />
  );
}
