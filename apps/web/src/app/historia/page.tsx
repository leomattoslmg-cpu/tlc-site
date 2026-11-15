import type { Metadata } from 'next';
import { PaginaTexto } from '@/components/pagina-texto';

export const metadata: Metadata = { title: 'História do TLC' };
export const revalidate = 300;

// Texto padrão (usado enquanto o painel não tiver uma versão própria). Fatos conferidos no site oficial do TLC e na Wikipédia.
const HISTORIA = [
  'O TLC, Treinamento de Liderança Cristã, nasceu em 1967, em Campinas (SP), criado pelo padre jesuíta Haroldo Rahm (Harold Joseph Rahm). Nascido no Texas (EUA), ele chegou ao Brasil em 1964.',
  'Junto com um grupo de leigos, jovens e adultos, o padre Haroldo criou um retiro cristão para formar líderes capazes de fazer a diferença na Igreja e na sociedade. A proposta reuniu a espiritualidade dos Exercícios Espirituais de Santo Inácio de Loyola, a experiência de movimentos como a Legião de Maria e a Ação Católica, e os documentos do Concílio Vaticano II.',
  'O movimento se espalhou por todo o Brasil e chegou à Itália e à Argentina. Em 2017, o TLC celebrou o Jubileu de 50 anos. O seu lema é “Sempre Mais Alto”.',
  'Em Ponta Porã - MS, seguimos essa missão: formar líderes para servir. Medo de nada, só amor!',
];

const FONTES = [
  { rotulo: 'TLC Nacional: nosso fundador', href: 'https://tlc.org.br/nosso-fundador/' },
  { rotulo: 'Wikipédia: Treinamento de Liderança Cristã', href: 'https://pt.wikipedia.org/wiki/Treinamento_de_Lideran%C3%A7a_Crist%C3%A3' },
];

export default function Historia() {
  return <PaginaTexto slug="historia" titulo="História do TLC" padrao={HISTORIA} fontes={FONTES} />;
}
