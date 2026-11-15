export interface UsuarioAutenticado {
  id: string;
  sid: string;
  perfis: string[];
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expira_em: number;
}
