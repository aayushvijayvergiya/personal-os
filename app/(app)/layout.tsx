import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col gap-1 p-1">
      <div className="flex flex-1 gap-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}
