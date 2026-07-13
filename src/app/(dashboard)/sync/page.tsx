// Redirect /sync → /settings (Google Sheets sync moved there)
import { redirect } from "next/navigation";

export default function SyncPage() {
  redirect("/settings");
}
