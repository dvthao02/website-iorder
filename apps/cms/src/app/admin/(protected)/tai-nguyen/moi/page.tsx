import { redirect } from "next/navigation";

export default function NewResourcePage() {
  redirect("/admin/tai-nguyen?create=1");
}
