import { FilterBarSkeleton, ListSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/layout/skeletons";

/** Chargement de la liste des envois : même géométrie que la page (en-tête, barre d'outils, lignes). */
export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton />
      <FilterBarSkeleton segments={3} />
      <ListSkeleton rows={8} />
    </SkeletonPage>
  );
}
