// src/pages/Home.tsx
import VerifyCard from "../components/VerifyCard";
import GenerateForm from "../components/GenerateForm";
import ForecastPanel from "../components/ForecastPanel";

export default function Home() {
  return (
    <div className="grid gap-6">
      {/* แถวบน: Verify + Forecast */}
      <div className="grid gap-6 md:grid-cols-2">
        <VerifyCard />
        <ForecastPanel />
      </div>

      {/* แถวล่าง: Generate License */}
      <GenerateForm />
    </div>
  );
}
