import type { Metadata } from 'next';
import { PaginaTexto } from '@/components/pagina-texto';

export const metadata: Metadata = { title: 'História do TLC' };
export const revalidate = 300;

// Texto fornecido pelo TLC Ponta Porã. Aparece enquanto o painel não tiver uma versão própria da página.
const HISTORIA = [
  'O Treinamento de Liderança Cristã (TLC) é um movimento da Igreja Católica fundado em 1967 pelo Padre Haroldo Rahm, em Campinas (SP). Inspirado nos valores cristãos e nos ensinamentos do Concílio Vaticano II, o movimento nasceu com a missão de formar jovens líderes comprometidos com a fé, a comunidade e o serviço ao próximo.',
  'Ao longo das décadas, o TLC expandiu-se para diversas dioceses do Brasil e também para outros países, tornando-se uma importante escola de formação humana, espiritual e comunitária para milhares de jovens.',
  'Em Ponta Porã, o TLC tornou-se uma referência na evangelização da juventude, promovendo encontros, retiros e atividades que fortalecem a amizade, a fé e o protagonismo cristão. Em 2017, o movimento comemorou seus 50 anos de existência, celebrando uma trajetória marcada pela transformação de vidas e pelo compromisso com os valores do Evangelho.',
  'Hoje, o TLC de Ponta Porã continua sua missão de acolher, formar e enviar jovens para serem testemunhas de Cristo em suas famílias, comunidades e na sociedade.',
  'Medo de nada, só amor.',
];

export default function Historia() {
  return <PaginaTexto slug="historia" titulo="História do TLC" padrao={HISTORIA} />;
}
