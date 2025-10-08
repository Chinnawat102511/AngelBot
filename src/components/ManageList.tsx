import { useEffect, useState } from "react";
import { listLicensesApi, viewLicenseApi, downloadLicenseApi, LicenseListItem, License } from "../api";

export default function ManageList() {
  const [items, setItems] = useState<LicenseListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<License | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listLicensesApi();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onView = async (id: string) => {
    try {
      setLoading(true);
      const data = await viewLicenseApi(id);
      setSelected(data);
    } catch (e: any) {
      setError(e?.message || "View failed");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async (id: string) => {
    try { await downloadLicenseApi(id); }
    catch (e: any) { setError(e?.message || "Download failed"); }
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2>🗂 Manage Licenses</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={load} disabled={loading}>Reload</button>
      </div>

      {error && <p style={{ color: "crimson" }}>❌ {error}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 8 }}>ID</th>
              <th style={{ padding: 8 }}>Owner</th>
              <th style={{ padding: 8 }}>Plan</th>
              <th style={{ padding: 8 }}>Issued</th>
              <th style={{ padding: 8 }}>Expires</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} style={{ borderTop: "1px solid #e5e5e5" }}>
                <td style={{ padding: 8, fontFamily: "monospace" }}>{r.id}</td>
                <td style={{ padding: 8 }}>{r.owner}</td>
                <td style={{ padding: 8 }}>{r.plan}</td>
                <td style={{ padding: 8 }}>{new Date(r.issuedAt).toLocaleString()}</td>
                <td style={{ padding: 8 }}>{new Date(r.expiresAt).toLocaleString()}</td>
                <td style={{ padding: 8, color: r.valid ? "green" : "crimson" }}>
                  {r.valid ? "valid" : "expired"}
                </td>
                <td style={{ padding: 8, display: "flex", gap: 6 }}>
                  <button onClick={() => onView(r.id)} disabled={loading}>View</button>
                  <button onClick={() => onDownload(r.id)} disabled={loading}>Download</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>No licenses</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ marginBottom: 6 }}>JSON: {selected.id}</h3>
          <pre style={{
            background: "var(--code-bg)",
            color: "var(--code-fg)",
            padding: 12,
            borderRadius: 8,
            overflow: "auto"
          }}>
{JSON.stringify(selected, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
