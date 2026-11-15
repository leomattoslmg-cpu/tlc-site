-- Login somente por CPF: todo membro precisa ter CPF, inclusive menores a partir de 13 anos.
-- Substitui a regra original do RN-MEM-10 (menor sem CPF podia ser cadastrado sem ele).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM membros WHERE cpf_cifrado IS NULL AND anonimizado_em IS NULL) THEN
    RAISE EXCEPTION 'Existem membros sem CPF. Informe o CPF deles antes de aplicar esta migração.';
  END IF;
END $$;

-- Só registros anonimizados (LGPD) podem ficar sem CPF.
ALTER TABLE membros
  ADD CONSTRAINT membros_cpf_obrigatorio CHECK (anonimizado_em IS NOT NULL OR cpf_cifrado IS NOT NULL);

-- Regras de idade que dependem da data de hoje (não cabem em CHECK):
--   * idade mínima de 13 anos (RN-MEM-09);
--   * CPF obrigatório para todos, a qualquer idade (RN-MEM-10 revisada).
CREATE OR REPLACE FUNCTION membros_regras_idade() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.anonimizado_em IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.data_nascimento > (current_date - INTERVAL '13 years')::date THEN
    RAISE EXCEPTION 'Idade mínima de 13 anos não atendida' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.cpf_cifrado IS NULL THEN
    RAISE EXCEPTION 'CPF é obrigatório para todos os membros' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
