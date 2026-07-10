import Header from "@/components/layout/Header";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import WeeklyDigestCard from "@/components/settings/WeeklyDigestCard";
import PushNotificationCard from "@/components/settings/PushNotificationCard";

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" subtitle="App configuration" />
      <main className="flex-1 p-6 space-y-6 animate-fade-in max-w-2xl">
        <PushNotificationCard />
        <WeeklyDigestCard />
        <ChangePasswordForm />
      </main>
    </>
  );
}
