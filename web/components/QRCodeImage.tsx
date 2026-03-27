"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeImage({
  data,
  size = 280,
  className,
  alt,
}: {
  data: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setDataUrl);
  }, [data, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }

  return <img src={dataUrl} alt={alt ?? "QR code"} className={className} />;
}
