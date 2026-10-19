import { redirect } from "next/navigation";

// Old reset links use this route. All password recovery now requires SMS verification.
export default function Page() {
  redirect("/auth/forgot-password");
}
