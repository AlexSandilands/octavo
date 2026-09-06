// Reader skeleton: a page-shaped card centred on the stage, echoing the
// flipbook (desktop) / column (mobile) the real issue renders into.
export default function ReaderLoading() {
  return (
    <div
      role="status"
      aria-label="Opening the issue"
      className="bg-stage-ui flex min-h-dvh items-center justify-center px-5"
    >
      <div className="w-full max-w-3xl">
        <div className="bg-page shadow-card mx-auto aspect-[5/7] w-full max-w-[520px] rounded-[3px] p-10">
          <div className="skeleton mx-auto h-3 w-24" />
          <div className="skeleton mx-auto mt-16 h-9 w-3/4" />
          <div className="skeleton mx-auto mt-4 h-9 w-1/2" />
          <div className="skeleton mx-auto mt-14 h-40 w-4/5" />
          <div className="skeleton mx-auto mt-10 h-3 w-40" />
        </div>
        <p className="text-fg-muted mt-6 text-center font-ui text-[16px] font-bold">
          Opening the issue…
        </p>
      </div>
    </div>
  );
}
