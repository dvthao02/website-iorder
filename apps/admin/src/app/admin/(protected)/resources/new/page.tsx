import { redirect } from "next/navigation";

export default function NewResourcePage() {
  redirect("/admin/resources?create=1");
}
