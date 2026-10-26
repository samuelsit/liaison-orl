import { FilterBarSkeleton, ListSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/layout/skeletons";

/** Chargement de la liste des documents : même géométrie que la page (en-tête, barre d'outils, lignes). */
export default function Loading() {
  return (
    <SkeletonPage>
      <PageHeaderSkeleton description={false} actions={1} />
      <FilterBarSkeleton segments={5} />
      <ListSkeleton rows={8} />
    </SkeletonPage>
  );
}
