/** Deixa só os dígitos ("123.456.789-09" vira "12345678909"). */
export const soDigitos = (v: string): string => v.replace(/\D/g, '');

/** Confere os dois dígitos verificadores; recusa sequências repetidas (111.111.111-11 etc.). */
export function cpfValido(valor: string): boolean {
  const c = soDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const digito = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(c.slice(0, 9), 10) === Number(c[9]) && digito(c.slice(0, 10), 11) === Number(c[10]);
}

/** 12345678909 -> ***.456.789-** (formato da especificação). */
export function mascararCpf(cpf: string): string {
  const c = soDigitos(cpf);
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}
