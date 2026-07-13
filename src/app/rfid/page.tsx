import { redirect } from "next/navigation";

export default function HiddenRoutePage() {
  redirect("/admin");
}
