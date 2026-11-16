-- Em qual comunidade o TLCista serve (informado por ele no cadastro). A cidade já existe em membros.
ALTER TABLE membros ADD COLUMN comunidade text;
