import { SupportingManager } from "@/components/admin/supporting-manager";
import { getPartners, getTestimonials } from "@/lib/backend";
export const dynamic = "force-dynamic";
export default async function SupportingAdmin() {
  const [partners, testimonials] = await Promise.all([getPartners(), getTestimonials()]);
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <SupportingManager partners={partners} testimonials={testimonials} />
  </main>;
}
