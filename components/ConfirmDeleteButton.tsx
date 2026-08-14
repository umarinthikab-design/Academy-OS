"use client";

// Delete/remove action button that confirms before submitting. Uses the
// design-system danger button by default; call sites can override `style`.

export function ConfirmDeleteButton({
  action,
  confirmMessage,
  label = "Remove",
  buttonStyle,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  label?: string;
  buttonStyle?: React.CSSProperties;
}) {
  return (
    <form
      action={async () => {
        if (window.confirm(confirmMessage)) {
          await action();
        }
      }}
    >
      <button
        type="submit"
        style={
          buttonStyle ?? {
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "1px solid var(--error)",
            color: "var(--error)",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            padding: "5px 12px",
            transition: "all var(--transition)",
          }
        }
      >
        {label}
      </button>
    </form>
  );
}