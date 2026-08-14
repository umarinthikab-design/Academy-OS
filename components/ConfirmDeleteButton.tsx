"use client";

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
            background: "none",
            border: "none",
            color: "#E63946",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
          }
        }
      >
        {label}
      </button>
    </form>
  );
}
