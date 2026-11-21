import {
  navigationDocumentSchema,
  navigationLocationSchema,
  navigationSchema,
  type NavigationDocument,
  type NavigationLocation,
  type NavigationTarget,
} from "./navigation.contract";
import {
  NavigationWriteConflictError,
  readNavigation,
  readNavigationById,
  listPublishedNavigationTargets,
  resolvePublishedNavigationItems,
  writeNavigation,
} from "./navigation.repository";

const locationName: Record<NavigationLocation, string> = {
  header: "Điều hướng chính",
  header_cta: "Nút kêu gọi hành động header",
  footer: "Điều hướng chân trang",
};

export class NavigationVersionConflictError extends Error {
  constructor() {
    super("Menu đã được cập nhật ở một phiên làm việc khác. Vui lòng tải lại trang trước khi lưu tiếp.");
  }
}

type NavigationRepository = {
  readNavigation: typeof readNavigation;
  readNavigationById: typeof readNavigationById;
  listPublishedNavigationTargets?: typeof listPublishedNavigationTargets;
  resolvePublishedNavigationItems?: typeof resolvePublishedNavigationItems;
  writeNavigation: typeof writeNavigation;
};

function toDocument(record: NonNullable<Awaited<ReturnType<typeof readNavigation>>>): NavigationDocument {
  return navigationDocumentSchema.parse({
    id: record.menu.id,
    location: record.menu.location,
    version: record.menu.version,
    items: record.items.map((row) => ({
      key: row.id,
      parentKey: row.parentId,
      label: row.label,
      url: row.url,
      linkType: row.linkType as NavigationDocument["items"][number]["linkType"],
      contentId: row.contentId,
      target: row.target,
      isEnabled: row.isEnabled,
    })),
  });
}

export function createNavigationService(repository: NavigationRepository) {
  async function getNavigation(location: NavigationLocation = "header") {
    const document = await getAdminNavigation(location);
    return document.id ? (repository.resolvePublishedNavigationItems ? repository.resolvePublishedNavigationItems(document.items) : document.items) : null;
  }

  async function getPublishedNavigationTargets(): Promise<NavigationTarget[]> {
    return repository.listPublishedNavigationTargets ? repository.listPublishedNavigationTargets() : [];
  }

  async function getAdminNavigation(location: NavigationLocation): Promise<NavigationDocument> {
    const parsedLocation = navigationLocationSchema.parse(location);
    const record = await repository.readNavigation(parsedLocation);
    return record ? toDocument(record) : { id: null, location: parsedLocation, version: 0, items: [] };
  }

  async function getAdminNavigationById(id: string): Promise<NavigationDocument | null> {
    const record = await repository.readNavigationById(id);
    return record ? toDocument(record) : null;
  }

  async function saveNavigation(
    location: NavigationLocation,
    input: unknown,
    userId: string,
    options: { expectedVersion?: number; changeNote?: string } = {},
  ) {
    const parsedLocation = navigationLocationSchema.parse(location);
    const items = navigationSchema.parse(input);
    try {
      return await repository.writeNavigation({
        location: parsedLocation,
        name: locationName[parsedLocation],
        items,
        userId,
        expectedVersion: options.expectedVersion,
        changeNote: options.changeNote?.trim() || "Cập nhật menu",
      });
    } catch (error) {
      if (error instanceof NavigationWriteConflictError) throw new NavigationVersionConflictError();
      throw error;
    }
  }

  return { getNavigation, getAdminNavigation, getAdminNavigationById, getPublishedNavigationTargets, saveNavigation };
}

const navigationService = createNavigationService({ readNavigation, readNavigationById, listPublishedNavigationTargets, resolvePublishedNavigationItems, writeNavigation });

export const getNavigation = navigationService.getNavigation;
export const getAdminNavigation = navigationService.getAdminNavigation;
export const getAdminNavigationById = navigationService.getAdminNavigationById;
export const getPublishedNavigationTargets = navigationService.getPublishedNavigationTargets;
export const saveNavigation = navigationService.saveNavigation;
