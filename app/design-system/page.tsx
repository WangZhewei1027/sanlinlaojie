import { redirect } from "next/navigation";
import { stories } from "./stories";

export default function DesignSystemPage() {
  redirect(`/design-system/${stories[0].id}`);
}
