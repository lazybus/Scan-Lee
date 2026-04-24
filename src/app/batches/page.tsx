import { ImageBatchesManager } from "@/components/image-batches-manager";
import { ImageBatchesUnavailableError, listImageBatches } from "@/lib/image-batches";

export const dynamic = "force-dynamic";

async function loadBatchesPageState() {
  try {
    return {
      batches: await listImageBatches(),
      unavailable: false,
    };
  } catch (error) {
    if (!(error instanceof ImageBatchesUnavailableError)) {
      throw error;
    }

    return {
      batches: [],
      unavailable: true,
    };
  }
}

export default async function BatchesPage() {
  const { batches, unavailable } = await loadBatchesPageState();

  if (unavailable) {
    return (
      <section className="paper-panel p-6 sm:p-8">
        <p className="data-label">Image Batches Unavailable</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Apply the latest database migration</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
          The app code now expects the new image batch tables, but your Supabase database has not
          been migrated yet. Run the latest migration, then reload this page.
        </p>
        <div className="mt-6 border-2 border-[var(--line)] bg-[var(--panel-strong)] p-5 font-mono text-sm text-[var(--ink)]">
          supabase/migrations/202604150001_add_image_batches.sql
        </div>
      </section>
    );
  }

  return <ImageBatchesManager initialBatches={batches} />;
}