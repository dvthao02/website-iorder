import { Container } from "@/components/ui";
import { BreadcrumbTrail, type Crumb } from "./page-hero";

export function StaticPageNavigation({ crumbs, sections }: { crumbs: Crumb[]; sections: Array<{ id: string; label: string }> }) {
  return <div className="static-page-navigation" data-testid="static-page-navigation">
    <Container>
      <BreadcrumbTrail crumbs={crumbs} />
      {sections.length ? <nav aria-label="Nội dung trong trang" data-testid="static-section-nav"><ul>
        {sections.map(section => <li key={section.id}><a data-testid="static-section-link" href={`#${section.id}`}>{section.label}</a></li>)}
      </ul></nav> : null}
    </Container>
  </div>;
}
