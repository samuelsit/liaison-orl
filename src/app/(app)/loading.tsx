"use client";

import { usePathname } from "next/navigation";
import {
  CardSkeleton,
  EditorSkeleton,
  FilterBarSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
  SkeletonPage,
  StatTilesSkeleton,
} from "@/components/layout/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Chargement par défaut de l'application, à la forme de l'écran demandé (accueil, liste,
 * fiche, éditeur, compte) pour éviter tout saut de mise en page. Les sections qui ont
 * leur propre loading.tsx l'emportent sur celui-ci.
 */
export default function Loading() {
  const pathname = usePathname();

  if (pathname === "/") return <HomeSkeleton />;

  if (/^\/documents\/[^/]+/.test(pathname)) {
    return (
      <SkeletonPage size="wide">
        <EditorSkeleton />
      </SkeletonPage>
    );
  }

  if (pathname === "/compte") {
    return (
      <SkeletonPage size="narrow">
        <PageHeaderSkeleton />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </SkeletonPage>
    );
  }

  if (pathname.startsWith("/admin")) {
    return (
      <SkeletonPage>
        <PageHeaderSkeleton description={false} />
        <StatTilesSkeleton count={6} />
        <CardSkeleton rows={5} />
      </SkeletonPage>
    );
  }

  if (/^\/(patients|prescripteurs|envois)\/[^/]+/.test(pathname)) {
    return (
      <SkeletonPage>
        <PageHeaderSkeleton breadcrumb entity actions={2} />
        <CardSkeleton rows={4} />
      </SkeletonPage>
    );
  }

  return (
    <SkeletonPage>
      <PageHeaderSkeleton actions={1} />
      <FilterBarSkeleton />
      <ListSkeleton rows={8} />
    </SkeletonPage>
  );
}

/** Accueil : date et salutation, deux tuiles de création, sections « À finir » / « Prêts à envoyer », envois récents. */
function HomeSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-56 sm:h-9" />
        </div>
        <Skeleton className="h-8 w-44 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex min-h-24 flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <Skeleton className="size-11 rounded-lg" />
            <div className="w-full space-y-2">
              <Skeleton className="h-5 w-3/4 max-w-48" />
              <Skeleton className="h-3.5 w-full max-w-64 max-sm:hidden" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={2} />
      </div>
      <CardSkeleton rows={5} />
    </SkeletonPage>
  );
}
