import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getProductEditor, updateProduct } from "@/lib/catalog";

export const Route = createFileRoute("/_app/products/$id")({
  loader: ({ params }) => getProductEditor({ data: params.id }),
  component: EditProduct,
});

function EditProduct() {
  const navigate = useNavigate();
  const { categories, product, variants: initialVariants } = Route.useLoaderData();
  const saveProduct = useServerFn(updateProduct);
  const [submitting, setSubmitting] = useState(false);
  const [variants, setVariants] = useState<ProductVariantForm[]>(
    initialVariants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      priceDelta: String(variant.priceDelta),
      stock: String(variant.stock),
    })),
  );

  if (!product) throw notFound();
  const currentProduct = product;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const result = await saveProduct({
        data: {
          id: currentProduct.id,
          name: String(form.get("name") ?? ""),
          sku: String(form.get("sku") ?? ""),
          barcode: String(form.get("barcode") ?? ""),
          categoryId: String(form.get("categoryId") ?? ""),
          unit: String(form.get("unit") ?? ""),
          price: Number(form.get("price") ?? 0),
          cost: Number(form.get("cost") ?? 0),
          stock: Number(form.get("stock") ?? 0),
          minStock: Number(form.get("minStock") ?? 0),
          active: form.get("active") === "on",
          variants: variants
            .filter((variant) => variant.name.trim())
            .map((variant) => ({
              name: variant.name,
              sku: variant.sku,
              priceDelta: Number(variant.priceDelta || 0),
              stock: Number(variant.stock || 0),
              active: true,
            })),
        },
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Produk berhasil diperbarui");
      navigate({ to: "/products" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke produk
      </Link>
      <h2 className="font-display text-2xl font-bold">Edit Produk</h2>
      <p className="mt-1 text-sm text-muted-foreground">Perubahan tersimpan untuk tenant ini.</p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Informasi Dasar">
            <Field label="Nama Produk *">
              <input name="name" required defaultValue={currentProduct.name} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU *">
                <input name="sku" required defaultValue={currentProduct.sku} className={inputCls} />
              </Field>
              <Field label="Barcode">
                <input name="barcode" defaultValue={currentProduct.barcode} className={inputCls} />
              </Field>
            </div>
            <Field label="Kategori *">
              <select
                name="categoryId"
                className={inputCls}
                required
                defaultValue={currentProduct.categoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Satuan *">
              <input name="unit" required defaultValue={currentProduct.unit} className={inputCls} />
            </Field>
          </Card>

          <Card title="Harga & Stok">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Harga Jual *">
                <input
                  name="price"
                  required
                  type="number"
                  min={0}
                  defaultValue={currentProduct.price}
                  className={inputCls}
                />
              </Field>
              <Field label="Harga Modal">
                <input
                  name="cost"
                  type="number"
                  min={0}
                  defaultValue={currentProduct.cost}
                  className={inputCls}
                />
              </Field>
              <Field label="Stok">
                <input
                  name="stock"
                  type="number"
                  min={0}
                  defaultValue={currentProduct.stock}
                  className={inputCls}
                />
              </Field>
              <Field label="Stok Minimum">
                <input
                  name="minStock"
                  type="number"
                  min={0}
                  defaultValue={currentProduct.minStock}
                  className={inputCls}
                />
              </Field>
            </div>
          </Card>

          <Card title="Varian">
            <VariantEditor variants={variants} setVariants={setVariants} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <label className="flex items-center justify-between">
              <span className="text-sm">Aktif untuk dijual</span>
              <input
                name="active"
                type="checkbox"
                defaultChecked={currentProduct.active}
                className="h-5 w-9 rounded-full"
              />
            </label>
          </Card>
          <div className="flex gap-2">
            <Link
              to="/products"
              className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium hover:bg-accent"
            >
              Batal
            </Link>
            <button
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

type ProductVariantForm = {
  id: string;
  name: string;
  sku: string;
  priceDelta: string;
  stock: string;
};

function VariantEditor({
  variants,
  setVariants,
}: {
  variants: ProductVariantForm[];
  setVariants: React.Dispatch<React.SetStateAction<ProductVariantForm[]>>;
}) {
  return (
    <div className="space-y-3">
      {variants.map((variant, index) => (
        <div key={variant.id} className="rounded-lg border border-border bg-background p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Varian {index + 1}</div>
            <button
              type="button"
              onClick={() => setVariants((items) => items.filter((item) => item.id !== variant.id))}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama">
              <input
                value={variant.name}
                onChange={(e) =>
                  updateVariant(index, { ...variant, name: e.target.value }, setVariants)
                }
                className={inputCls}
              />
            </Field>
            <Field label="SKU Varian">
              <input
                value={variant.sku}
                onChange={(e) =>
                  updateVariant(index, { ...variant, sku: e.target.value }, setVariants)
                }
                className={inputCls}
              />
            </Field>
            <Field label="Tambahan Harga">
              <input
                type="number"
                value={variant.priceDelta}
                onChange={(e) =>
                  updateVariant(index, { ...variant, priceDelta: e.target.value }, setVariants)
                }
                className={inputCls}
              />
            </Field>
            <Field label="Stok Varian">
              <input
                type="number"
                min={0}
                value={variant.stock}
                onChange={(e) =>
                  updateVariant(index, { ...variant, stock: e.target.value }, setVariants)
                }
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setVariants((items) => [...items, createEmptyVariant()])}
        className="rounded-md border border-dashed border-border px-3 py-2 text-sm hover:bg-accent"
      >
        <Plus className="mr-1 inline h-4 w-4" /> Tambah Varian
      </button>
    </div>
  );
}

function createEmptyVariant(): ProductVariantForm {
  return {
    id: crypto.randomUUID(),
    name: "",
    sku: "",
    priceDelta: "0",
    stock: "0",
  };
}

function updateVariant(
  index: number,
  next: ProductVariantForm,
  setVariants: React.Dispatch<React.SetStateAction<ProductVariantForm[]>>,
) {
  setVariants((items) => items.map((item, itemIndex) => (itemIndex === index ? next : item)));
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h3 className="font-display font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
