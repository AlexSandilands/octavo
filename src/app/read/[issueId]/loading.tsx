// Reader skeleton: a page-shaped card centred on the stage, echoing the
// flipbook (desktop) / column (mobile) the real issue renders into.
export default function ReaderLoading() {
  return (
    <div className="bg-newsprint flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-3xl">
        <div className="bg-sheet mx-auto aspect-[5/7] w-full max-w-[520px] animate-pulse rounded-[3px] p-10">
          <div className="bg-hairline mx-auto h-3 w-24 rounded-ui" />
          <div className="bg-hairline mx-auto mt-16 h-9 w-3/4 rounded-ui" />
          <div className="bg-hairline mx-auto mt-4 h-9 w-1/2 rounded-ui" />
          <div className="bg-hairline mx-auto mt-14 h-40 w-4/5 rounded-ui" />
          <div className="bg-hairline mx-auto mt-10 h-3 w-40 rounded-ui" />
        </div>
        <p className="text-grey-soft mt-6 text-center font-ui text-sm">
          Opening the issue…
        </p>
      </div>
    </div>
  );
}
