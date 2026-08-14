// Avatar - photo or initials fallback. size controls the circle; used for
// players, coaches, and users throughout the app.

export function Avatar({
  name,
  src,
  size = 40,
  style,
}: {
  name: string;
  src?: string | null;
  size?: number;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    ...style,
  };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={{ ...base, objectFit: "cover", border: "1px solid var(--border)" }}
      />
    );
  }

  return (
    <div
      style={{
        ...base,
        background: "var(--primary)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: Math.round(size * 0.4),
        letterSpacing: "-0.02em",
      }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}