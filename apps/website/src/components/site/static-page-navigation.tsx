import { Container } from "@/components/ui";
import { BreadcrumbTrail, type Crumb } from "./page-hero";
import { getT } from "@/lib/messages";

export async function StaticPageNavigation({ crumbs, sections }: { crumbs: Crumb[]; sections: Array<{ id: string; label: string }> }) {
  const t = await getT();
  return <div className="static-page-navigation" data-testid="static-page-navigation">
    <Container>
      <BreadcrumbTrail crumbs={crumbs} />
      {sections.length ? <nav aria-label={t("common.contentTocTitle")} data-testid="static-section-nav"><ul>
        {sections.map(section => <li key={section.id}><a data-testid="static-section-link" href={`#${section.id}`}>{section.label}</a></li>)}
      </ul></nav> : null}
    </Container>
  </div>;
}
