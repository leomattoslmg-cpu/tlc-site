import Link from 'next/link';

const ITENS = [
  { href: '/portal/admin/eventos', rotulo: 'Eventos' },
  { href: '/portal/admin/qrcode', rotulo: 'QR Code' },
  { href: '/portal/admin/membros', rotulo: 'Cadastro' },
  { href: '/portal/admin/relatorios', rotulo: 'Planilhas' },
  { href: '/portal/admin/auditoria', rotulo: 'Auditoria' },
];

export function AdminNav({ atual }: { atual: string }) {
  return (
    <nav aria-label="Administração" className="nao-imprimir mb-6 flex flex-wrap gap-2">
      <Link href="/portal" className="btn-secundario min-h-[44px] px-4">← Meu portal</Link>
      {ITENS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={atual === i.href ? 'page' : undefined} className={`${atual === i.href ? 'btn-primario' : 'btn-secundario'} min-h-[44px] px-4`}>
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}

export function SemAcesso() {
  return (
    <div className="cartao p-6">
      <h1 className="text-xl">Sem acesso</h1>
      <p className="mt-2 text-texto-apoio">Esta área é da coordenação e da secretaria. Se precisar dela, fale com a administração do TLC. Se acabou de entrar, tente recarregar a página.</p>
    </div>
  );
}
