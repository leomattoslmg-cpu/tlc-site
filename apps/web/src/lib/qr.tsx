import QRCode from 'qrcode';

/** QR Code em SVG (nítido na tela e na impressão). Sempre preto sobre branco, para os leitores lerem bem. */
export async function Qr({ texto, tamanho = 280, rotulo }: { texto: string; tamanho?: number; rotulo: string }) {
  const svg = await QRCode.toString(texto, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  return (
    <div
      role="img"
      aria-label={rotulo}
      className="inline-block rounded-cartao bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: tamanho, height: tamanho }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
