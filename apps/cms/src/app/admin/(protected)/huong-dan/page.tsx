import { redirect } from "next/navigation";

export default function AdministratorGuidesPage() {
  redirect("/admin/tai-nguyen?tab=guides");
}
