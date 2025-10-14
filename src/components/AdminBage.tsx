export default function AdminBadge() {
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-[2px] rounded-full"
      style={{ background: "#e8fff3", border: "1px solid #34d399", color: "#065f46" }}
      title="Admin session active"
    >
      ● Admin
    </span>
  );
}
