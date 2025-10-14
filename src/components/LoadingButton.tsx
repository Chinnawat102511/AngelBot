type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export default function LoadingButton({ loading, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={loading || disabled}
      className={`px-3 py-1 text-sm border rounded hover:bg-gray-100 dark:hover:bg-gray-800 inline-flex items-center gap-2 ${rest.className || ""}`}
    >
      {loading && (
        <span
          style={{
            width: 14, height: 14, borderRadius: "50%",
            border: "2px solid currentColor", borderRightColor: "transparent",
            display: "inline-block", animation: "ab-spin .6s linear infinite",
          }}
        />
      )}
      <span>{children}</span>
      <style>{`@keyframes ab-spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}
