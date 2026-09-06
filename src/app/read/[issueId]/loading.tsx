import { Skeleton } from "@/components/skeleton";

// Reader skeleton: a page-shaped sheet on the newsprint stage, echoing the
// flipbook (desktop) / column (mobile) the real issue renders into.
export default function ReaderLoading() {
  return (
    <div
      className="bg-newsprint flex min-h-screen items-center justify-center px-5"
      role="status"
      aria-busy
    >
      <div className="w-full max-w-3xl">
        <div className="bg-sheet border-lead mx-auto aspect-[5/7] w-full max-w-[520px] border p-10">
          <Skeleton className="mx-auto h-3 w-24" />
          <Skeleton className="mx-auto mt-16 h-9 w-3/4" />
          <Skeleton className="mx-auto mt-4 h-9 w-1/2" />
          <Skeleton className="mx-auto mt-14 h-40 w-4/5" />
          <Skeleton className="mx-auto mt-10 h-3 w-40" />
        </div>
        <p className="text-grey mt-6 text-center font-ui text-[16px]">
          Opening the issue…
        </p>
      </div>
    </div>
  );
}
