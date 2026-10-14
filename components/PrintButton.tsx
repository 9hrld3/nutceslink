"use client";

export default function PrintButton({ label = "Imprimir / guardar PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn btn-primary no-print">
      {label}
    </button>
  );
}
