import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchLatestLicense, uploadLicenseFile, type LicenseState } from "../lib/license";

type Ctx = {
  state: LicenseState;
  refresh: () => Promise<void>;
  upload: (file: File) => Promise<void>;
};

const LicenseCtx = createContext<Ctx | null>(null);

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LicenseState>({ status: "loading" });

  const refresh = async () => {
    setState({ status: "loading" });
    const s = await fetchLatestLicense();
    setState(s);
  };

  const upload = async (file: File) => {
    setState({ status: "loading" });
    const s = await uploadLicenseFile(file);
    setState(s);
  };

  useEffect(() => { void refresh(); }, []);

  return (
    <LicenseCtx.Provider value={{ state, refresh, upload }}>
      {children}
    </LicenseCtx.Provider>
  );
};

export function useLicense() {
  const ctx = useContext(LicenseCtx);
  if (!ctx) throw new Error("useLicense must be used inside <LicenseProvider>");
  return ctx;
}
