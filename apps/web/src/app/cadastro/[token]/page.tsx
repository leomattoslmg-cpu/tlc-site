import { redirect } from 'next/navigation';

// QR Codes de cadastro antigos: o cadastro agora é aberto, então levam para a página de cadastro.
export default function CadastroAntigo() {
  redirect('/cadastro');
}
