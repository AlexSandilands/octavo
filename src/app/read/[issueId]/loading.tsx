// Reader skeleton: a lit page-shaped sheet centred on the dark ground, echoing
// the flipbook (desktop) / column (mobile) the real issue renders into.
export default function ReaderLoading() {
  return (
    <div className="bg-ground flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-3xl">
        <div className="bg-page shadow-glow mx-auto aspect-[640/900] w-full max-w-[480px] animate-pulse rounded-[3px] p-10">
          <div className="bg-line-soft mx-auto h-3 w-24 rounded" />
          <div className="bg-line-soft mx-auto mt-16 h-9 w-3/4 rounded" />
          <div className="bg-line-soft mx-auto mt-4 h-9 w-1/2 rounded" />
          <div className="bg-line-soft mx-auto mt-14 h-40 w-4/5 rounded" />
          <div className="bg-line-soft mx-auto mt-10 h-3 w-40 rounded" />
        </div>
        <p className="text-chrome-muted mt-6 text-center font-ui text-[15px]">
          Opening the issue…
        </p>
      </div>
    </div>
  );
}
